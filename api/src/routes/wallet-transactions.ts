import { Router } from "express";
import { getWalletInfoWasm } from "../lib/wasm-loader.js";

const router = Router();
const API_KEY = process.env.RPC_API_KEY ?? null;
const PAGE_SIZE = 100;
const PAGE_DELAY_MS = 600;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── GET /api/wallet-transactions?address=...&limit=...&lt=...&hash=...&network=mainnet|testnet
// Single page (up to 100 transactions), no payment required
router.get("/", async (req, res) => {
    const { address, limit, lt, hash, network } = req.query as Record<string, string>;

    if (!address) {
        return res.status(400).json({ error: "Missing ?address= query parameter" });
    }

    const pageSize = Math.min(Number(limit) || PAGE_SIZE, PAGE_SIZE);

    try {
        const bg = await getWalletInfoWasm();
        const result: any = await bg.get_transactions(address, pageSize, lt ?? null, hash ?? null, API_KEY, network ?? null);

        return res.json({
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
        return res.status(500).json({ error: (err as Error).message });
    }
});

// ── GET /api/wallet-transactions/bulk?address=...&limit=...&network=mainnet|testnet
// Paginated bulk fetch (up to 10,000 transactions), no payment required
router.get("/bulk", async (req, res) => {
    const { address, limit, network } = req.query as Record<string, string>;

    if (!address) {
        return res.status(400).json({ error: "Missing ?address= query parameter" });
    }

    const totalLimit = Number(limit) || PAGE_SIZE;

    try {
        const bg = await getWalletInfoWasm();
        let fetched = 0;
        let lt: string | null = null;
        let hash: string | null = null;
        const allTransactions: unknown[] = [];

        while (fetched < totalLimit) {
            const pageSize = Math.min(totalLimit - fetched, PAGE_SIZE);
            const result: any = await bg.get_transactions(address, pageSize, lt, hash, API_KEY, network ?? null);

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

        return res.json({
            ok: true,
            result: {
                address,
                count: allTransactions.length,
                transactions: allTransactions,
            },
        });
    } catch (err) {
        console.error("wallet-transactions bulk error:", err);
        return res.status(500).json({ error: (err as Error).message });
    }
});

// ── GET /api/wallet-transactions/stream?address=...&limit=...&network=mainnet|testnet
// SSE stream, no payment required
router.get("/stream", async (req, res) => {
    const { address, limit, network } = req.query as Record<string, string>;

    if (!address) {
        return res.status(400).json({ error: "Missing ?address= query parameter" });
    }

    const totalLimit = Number(limit) || PAGE_SIZE;

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
            const result: any = await bg.get_transactions(address, pageSize, lt, hash, API_KEY, network ?? null);

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
