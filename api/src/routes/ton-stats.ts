import { Router } from "express";
import { getTonStatsWasm } from "../lib/wasm-loader-stats.js";

const router = Router();

const TONAPI_KEY = process.env.TONAPI_KEY ?? undefined;
const CMC_KEY = process.env.COINMARKETCAP_KEY ?? undefined;

// ── Helper: fetch stats from WASM ───────────────────────────────
async function fetchStats(options?: {
    txLimit?: number;
    jettonLimit?: number;
    poolLimit?: number;
    enabledSources?: string[];
}) {
    const bg = await getTonStatsWasm();
    const request = JSON.stringify({
        tonapi_key: TONAPI_KEY ?? null,
        coinmarketcap_key: CMC_KEY ?? null,
        tx_limit: options?.txLimit ?? 50,
        jetton_limit: options?.jettonLimit ?? 100,
        pool_limit: options?.poolLimit ?? 20,
        enabled_sources: options?.enabledSources ?? null,
    });
    const raw: string = await bg.get_ton_stats(request);
    return JSON.parse(raw);
}

// ── GET /api/ton-stats — returns full snapshot ──────────────────
// Payment gating is handled client-side via TonConnect.
// The frontend requires a wallet payment before calling this endpoint.
router.get("/", async (req, res) => {
    try {
        const result = await fetchStats();
        return res.json({ ok: true, result });
    } catch (err) {
        console.error("ton-stats error:", err);
        return res.status(500).json({ error: (err as Error).message ?? String(err) });
    }
});

// ── GET /api/ton-stats/stream — SSE endpoint for real-time updates ──
router.get("/stream", async (req, res) => {
    // Set up SSE
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
    });

    const sendEvent = (data: unknown) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Send initial snapshot
    try {
        const result = await fetchStats();
        sendEvent({ type: "snapshot", data: result });
    } catch (err) {
        sendEvent({ type: "error", error: (err as Error).message });
    }

    // Poll every 30 seconds for updates
    const interval = setInterval(async () => {
        try {
            const result = await fetchStats();
            sendEvent({ type: "update", data: result });
        } catch (err) {
            sendEvent({ type: "error", error: (err as Error).message });
        }
    }, 30_000);

    // Cleanup on close
    req.on("close", () => {
        clearInterval(interval);
        res.end();
    });
});

// ── GET /api/ton-stats/version ──────────────────────────────────
router.get("/version", async (_req, res) => {
    try {
        const bg = await getTonStatsWasm();
        return res.json({ ok: true, version: bg.ton_stats_version() });
    } catch (err) {
        return res.status(500).json({ error: (err as Error).message ?? String(err) });
    }
});

export default router;
