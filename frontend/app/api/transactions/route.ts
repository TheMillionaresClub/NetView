import { NextRequest, NextResponse } from "next/server";
import { x402Fetch } from "@ton-x402/client";
import { TonClient, WalletContractV5R1 } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";

const EXPRESS_API = process.env.EXPRESS_API_URL ?? "http://localhost:3001";
const RPC_URL = process.env.TON_RPC_URL ?? "https://testnet.toncenter.com/api/v2/jsonRPC";
const RPC_KEY = process.env.RPC_API_KEY ?? undefined;
const MNEMONIC = process.env.WALLET_MNEMONIC ?? "";

// Lazy-init wallet + client (cached across requests)
let walletConfig: {
  wallet: WalletContractV5R1;
  keypair: Awaited<ReturnType<typeof mnemonicToPrivateKey>>;
  client: TonClient;
  walletContract: ReturnType<TonClient["open"]>;
} | null = null;

async function getWalletConfig() {
  if (walletConfig) return walletConfig;

  if (!MNEMONIC) {
    throw new Error("WALLET_MNEMONIC env var not set");
  }

  const keypair = await mnemonicToPrivateKey(MNEMONIC.split(" "));
  const wallet = WalletContractV5R1.create({
    publicKey: keypair.publicKey,
    workchain: 0,
  });
  const client = new TonClient({ endpoint: RPC_URL, apiKey: RPC_KEY });
  const walletContract = client.open(wallet) as any;

  walletConfig = { wallet, keypair, client, walletContract };
  return walletConfig;
}

/**
 * POST /api/transactions
 * Body: { address: string, limit: number }
 *
 * Proxies to the Express API using x402Fetch for payment.
 * - limit <= 100: calls /api/wallet-transactions (0.01 TON)
 * - limit > 100:  calls /api/wallet-transactions/bulk (0.02 TON)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { address, limit = 30 } = body as { address: string; limit: number };

    if (!address) {
      return NextResponse.json({ error: "Missing address" }, { status: 400 });
    }

    const config = await getWalletConfig();
    const seqno = await (config.walletContract as any).getSeqno();

    // Choose endpoint based on limit
    const isBulk = limit > 100;
    const endpoint = isBulk ? "bulk" : "";
    const params = new URLSearchParams({ address, limit: String(limit) });
    const url = endpoint
      ? `${EXPRESS_API}/api/wallet-transactions/${endpoint}?${params}`
      : `${EXPRESS_API}/api/wallet-transactions?${params}`;

    const result = await x402Fetch(url, {
      wallet: config.wallet,
      keypair: config.keypair,
      seqno,
      client: config.client,
      verbose: true,
    });

    if (!result.response.ok) {
      const text = await result.response.text();
      return NextResponse.json(
        {
          error: `API returned ${result.response.status}`,
          details: text,
          paid: result.paid,
        },
        { status: result.response.status },
      );
    }

    const data = await result.response.json();

    return NextResponse.json({
      ...data,
      payment: {
        paid: result.paid,
        txHash: result.settlement?.txHash ?? null,
        network: result.settlement?.network ?? null,
        cost: isBulk ? "0.02 TON" : "0.01 TON",
      },
    });
  } catch (err) {
    console.error("proxy-transactions error:", err);
    return NextResponse.json(
      { error: (err as Error).message ?? "Unknown error" },
      { status: 500 },
    );
  }
}
