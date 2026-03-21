/**
 * ton-api.ts  —  Shared helper for calling the toncenter HTTP API
 * Used by multiple routes (/wallet-info, /trace-link, etc.)
 */

const DEFAULT_API_KEY =
  process.env.RPC_API_KEY ??
  "e251fe96771c8fe3e7c93798924a1b12c600aecfcc25d4b9fa9178ca15a9050d";

const TESTNET_URL = "https://testnet.toncenter.com/api/v2";
const MAINNET_URL = "https://toncenter.com/api/v2";

export function getBaseUrl(): string {
  const net = (process.env.TON_NETWORK ?? "testnet").toLowerCase();
  return net === "mainnet" ? MAINNET_URL : TESTNET_URL;
}

export function getApiKey(): string {
  return DEFAULT_API_KEY;
}

/** Generic toncenter GET request */
export async function toncenterGet(
  method: string,
  params: Record<string, string | number>
): Promise<any> {
  const base = getBaseUrl();
  const key = getApiKey();
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) qs.set(k, String(v));
  }
  const url = `${base}/${method}?${qs}`;
  const resp = await fetch(url, {
    headers: { "X-API-Key": key, Accept: "application/json" },
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`toncenter ${resp.status}: ${body.slice(0, 200)}`);
  }
  return resp.json();
}

// ─── Transaction helpers ──────────────────────────────────────────

export interface TxMsg {
  source: string;
  destination: string;
  value: string;
  message?: string;
}

export interface Tx {
  utime: number;
  transaction_id: { lt: string; hash: string };
  in_msg?: TxMsg;
  out_msgs?: TxMsg[];
}

/**
 * Fetch up to `limit` transactions for an address.
 * Handles pagination automatically.
 */
export async function getTransactions(
  address: string,
  limit: number = 50
): Promise<Tx[]> {
  const all: Tx[] = [];
  let lastLt: string | undefined;
  let lastHash: string | undefined;
  const pageSize = Math.min(limit, 50);

  while (all.length < limit) {
    const params: Record<string, string | number> = {
      address,
      limit: pageSize,
    };
    if (lastLt) {
      params.lt = lastLt;
      params.hash = lastHash!;
    }

    let data: any;
    try {
      data = await toncenterGet("getTransactions", params);
    } catch {
      break; // pagination can fail on some hashes — return what we have
    }

    if (!data?.ok) break;
    let txs: Tx[] = data.result ?? [];
    if (!txs.length) break;

    // Deduplicate overlap with previous page
    if (lastLt && txs[0]?.transaction_id.lt === lastLt) {
      txs = txs.slice(1);
    }
    if (!txs.length) break;

    all.push(...txs);

    const last = txs[txs.length - 1];
    lastLt = last.transaction_id.lt;
    lastHash = last.transaction_id.hash;

    // Small delay to respect rate limits
    await new Promise((r) => setTimeout(r, 200));
  }

  return all.slice(0, limit);
}

/**
 * Extract unique addresses this wallet has interacted with
 * (both sent-to and received-from).
 * Returns a Set of address strings.
 */
export function extractInteractedAddresses(
  txs: Tx[],
  selfAddress: string
): Set<string> {
  const addrs = new Set<string>();

  for (const tx of txs) {
    // Incoming
    if (tx.in_msg?.source && tx.in_msg.source !== selfAddress) {
      addrs.add(tx.in_msg.source);
    }
    // Outgoing
    for (const msg of tx.out_msgs ?? []) {
      if (msg.destination && msg.destination !== selfAddress) {
        addrs.add(msg.destination);
      }
    }
  }

  return addrs;
}
