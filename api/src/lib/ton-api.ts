/**
 * ton-api.ts  —  Shared helper for transaction fetching via tonapi.io
 * Uses tonapi v2 for both mainnet and testnet (same key works on both).
 */

const TONAPI_KEY = process.env.TONAPI_KEY ?? undefined;

function tonapiBase(network?: string): string {
    return (network ?? "testnet") === "mainnet"
        ? "https://tonapi.io/v2"
        : "https://testnet.tonapi.io/v2";
}

export function getBaseUrl(network?: string): string {
    return tonapiBase(network);
}

export function getApiKey(): string {
    return TONAPI_KEY ?? "";
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
 * Fetch up to `limit` transactions for an address via tonapi v2.
 */
export async function getTransactions(
    address: string,
    limit: number = 50,
    network?: string,
): Promise<Tx[]> {
    const base = tonapiBase(network);
    const url = `${base}/blockchain/accounts/${encodeURIComponent(address)}/transactions?limit=${Math.min(limit, 256)}&sort_order=desc`;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (TONAPI_KEY) headers["Authorization"] = `Bearer ${TONAPI_KEY}`;

    const resp = await fetch(url, { headers });
    if (resp.status === 404) return [];
    if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        throw new Error(`tonapi ${resp.status}: ${body.slice(0, 200)}`);
    }

    const data: any = await resp.json();

    // Map tonapi format → the Tx interface wallet-network.ts expects
    return (data.transactions ?? []).map((tx: any): Tx => ({
        utime: tx.utime ?? 0,
        transaction_id: {
            lt: String(tx.lt ?? "0"),
            hash: tx.hash ?? "",
        },
        in_msg: tx.in_msg
            ? {
                source: tx.in_msg.source?.address ?? "",
                destination: address,
                value: String(tx.in_msg.value ?? "0"),
            }
            : undefined,
        out_msgs: (tx.out_msgs ?? []).map((m: any) => ({
            source: address,
            destination: m.destination?.address ?? "",
            value: String(m.value ?? "0"),
        })),
    }));
}

/**
 * Extract unique addresses this wallet has interacted with.
 */
export function extractInteractedAddresses(
    txs: Tx[],
    selfAddress: string,
): Set<string> {
    const addrs = new Set<string>();
    for (const tx of txs) {
        if (tx.in_msg?.source && tx.in_msg.source !== selfAddress) addrs.add(tx.in_msg.source);
        for (const msg of tx.out_msgs ?? []) {
            if (msg.destination && msg.destination !== selfAddress) addrs.add(msg.destination);
        }
    }
    return addrs;
}
