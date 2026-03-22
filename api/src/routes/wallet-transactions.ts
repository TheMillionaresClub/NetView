import { Router } from "express";
import { getWalletInfoWasm } from "../lib/wasm-loader.js";
import { paymentGate } from "@ton-x402/middleware";
import { getPaymentConfig } from "../lib/payment-config.js";
import { webToExpress } from "../lib/web-adapter.js";

const router = Router();
const API_KEY = process.env.RPC_API_KEY ?? null;
const PAGE_SIZE = 100;
const PAGE_DELAY_MS = 600;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Payment configuration ──────────────────────────────────────
// Regular fetch (<=100 txns): 0.01 TON
// Bulk fetch (>100 txns):     0.02 TON (2x)
const REGULAR_AMOUNT = "10000000";   // 0.01 TON in nanoTON
const BULK_AMOUNT    = "20000000";   // 0.02 TON in nanoTON

// ── Lazy-init gated handlers ───────────────────────────────────
let regularGate: ReturnType<typeof paymentGate> | null = null;
let bulkGate: ReturnType<typeof paymentGate> | null = null;

function getRegularGate() {
    if (!regularGate) {
        regularGate = paymentGate(
            async (req) => {
                const url = new URL(req.url);
                const address = url.searchParams.get("address");
                const limit = url.searchParams.get("limit");
                const lt = url.searchParams.get("lt");
                const hash = url.searchParams.get("hash");

                if (!address) {
                    return Response.json({ error: "Missing ?address= query parameter" }, { status: 400 });
                }

                const pageSize = Math.min(Number(limit) || PAGE_SIZE, PAGE_SIZE);

                try {
                    const bg = await getWalletInfoWasm();
                    const result = await bg.get_transactions(address, pageSize, lt ?? null, hash ?? null, API_KEY);

                    return Response.json({
                        ok: true,
                        result: {
                            address,
                            count: result.transactions?.length ?? 0,
                            transactions: result.transactions ?? [],
                            next_lt: result.next_lt ?? null,
                            next_hash: result.next_hash ?? null,
                        },
                    });
                } catch (err) {
                    console.error("wallet-transactions error:", err);
                    return Response.json({ error: (err as Error).message }, { status: 500 });
                }
            },
            {
                config: getPaymentConfig({
                    amount: REGULAR_AMOUNT,
                    description: "Wallet Transactions (0.01 TON)",
                }),
            },
        );
    }
    return regularGate;
}

function getBulkGate() {
    if (!bulkGate) {
        bulkGate = paymentGate(
            async (req) => {
                const url = new URL(req.url);
                const address = url.searchParams.get("address");
                const limit = url.searchParams.get("limit");

                if (!address) {
                    return Response.json({ error: "Missing ?address= query parameter" }, { status: 400 });
                }

                const totalLimit = Math.min(Number(limit) || PAGE_SIZE, 10_000);

                try {
                    const bg = await getWalletInfoWasm();
                    let fetched = 0;
                    let lt: string | null = null;
                    let hash: string | null = null;
                    const allTransactions: unknown[] = [];

                    while (fetched < totalLimit) {
                        const pageSize = Math.min(totalLimit - fetched, PAGE_SIZE);
                        const result: any = await bg.get_transactions(address, pageSize, lt, hash, API_KEY);

                        const txs: unknown[] = result.transactions ?? [];
                        if (txs.length > 0) {
                            allTransactions.push(...txs);
                            fetched += txs.length;
                        }

                        lt = result.next_lt ?? null;
                        hash = result.next_hash ?? null;

                        if (!lt || txs.length === 0) break;
                        await sleep(PAGE_DELAY_MS);
                    }

                    return Response.json({
                        ok: true,
                        result: {
                            address,
                            count: allTransactions.length,
                            transactions: allTransactions,
                        },
                    });
                } catch (err) {
                    console.error("wallet-transactions bulk error:", err);
                    return Response.json({ error: (err as Error).message }, { status: 500 });
                }
            },
            {
                config: getPaymentConfig({
                    amount: BULK_AMOUNT,
                    description: "Bulk Wallet Transactions (0.02 TON)",
                }),
            },
        );
    }
    return bulkGate;
}

// ── GET /api/wallet-transactions?address=...&limit=...
// Payment-gated: 0.01 TON for up to 100 transactions
router.get("/", webToExpress((req) => getRegularGate()(req)));

// ── GET /api/wallet-transactions/bulk?address=...&limit=...
// Payment-gated: 0.02 TON for up to 10,000 transactions (fetched server-side)
router.get("/bulk", webToExpress((req) => getBulkGate()(req)));

// ── GET /api/wallet-transactions/stream?address=...&limit=...
// SSE stream (kept for backwards compatibility, NOT payment-gated)
router.get("/stream", async (req, res) => {
    const { address, limit } = req.query as Record<string, string>;

    if (!address) {
        return res.status(400).json({ error: "Missing ?address= query parameter" });
    }

    const totalLimit = Math.min(Number(limit) || PAGE_SIZE, 10_000);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.flushHeaders();

    const send = (event: string, data: unknown) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
        const bg = await getWalletInfoWasm();
        let fetched = 0;
        let lt: string | null = null;
        let hash: string | null = null;

        while (fetched < totalLimit) {
            const pageSize = Math.min(totalLimit - fetched, PAGE_SIZE);
            const result: any = await bg.get_transactions(address, pageSize, lt, hash, API_KEY);

            const txs: unknown[] = result.transactions ?? [];
            if (txs.length > 0) {
                fetched += txs.length;
                send("page", { transactions: txs, fetched, total: totalLimit });
            }

            lt = result.next_lt ?? null;
            hash = result.next_hash ?? null;

            if (!lt || txs.length === 0) break;
            await sleep(PAGE_DELAY_MS);
        }

        send("done", { total: fetched });
    } catch (err) {
        console.error("wallet-transactions stream error:", err);
        send("error", { error: (err as Error).message });
    } finally {
        res.end();
    }
});

export default router;
