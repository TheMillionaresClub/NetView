import { Router } from "express";
import { getWalletInfoWasm } from "../lib/wasm-loader.js";

const router = Router();
const API_KEY = process.env.RPC_API_KEY ?? null;
const PAGE_SIZE = 100;
const PAGE_DELAY_MS = 600;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── GET /api/wallet-transactions?address=...&limit=...&lt=...&hash=...
// Single-page fetch (max 100). Returns cursor fields for manual pagination.
router.get("/", async (req, res) => {
    const { address, limit, lt = null, hash = null } = req.query as Record<string, string | null>;

    if (!address) {
        return res.status(400).json({ error: "Missing ?address= query parameter" });
    }

    const pageSize = Math.min(Number(limit) || PAGE_SIZE, PAGE_SIZE);

    try {
        const bg = await getWalletInfoWasm();
        const result = await bg.get_transactions(address, pageSize, lt, hash, API_KEY);

        return res.json({
            ok: true,
            result: {
                address,
                count: result.transactions?.length ?? 0,
                transactions: result.transactions ?? [],
                next_lt:   result.next_lt   ?? null,
                next_hash: result.next_hash ?? null,
            },
        });
    } catch (err) {
        console.error("wallet-transactions error:", err);
        return res.status(500).json({ error: (err as Error).message });
    }
});

// ── GET /api/wallet-transactions/stream?address=...&limit=...
// SSE stream — paginates automatically, sending one event per page.
// Events:
//   event: page   data: { transactions: [...], fetched: N, total: N }
//   event: done   data: { total: N }
//   event: error  data: { error: "..." }
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
            const result = await bg.get_transactions(address, pageSize, lt, hash, API_KEY);

            const txs: unknown[] = result.transactions ?? [];
            if (txs.length > 0) {
                fetched += txs.length;
                send("page", { transactions: txs, fetched, total: totalLimit });
            }

            lt   = result.next_lt   ?? null;
            hash = result.next_hash ?? null;

            // No more pages, or empty result
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
