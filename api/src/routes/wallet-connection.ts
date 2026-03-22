import { Router } from "express";
import { createRequire } from "node:module";

const router = Router();

// Lazy-load the WASM module (nodejs target is self-contained)
let wasmModule: any = null;
async function getWasm() {
    if (wasmModule) return wasmModule;
    const require = createRequire(import.meta.url);
    wasmModule = require("wallet-connection");
    return wasmModule;
}

/**
 * POST /api/wallet-connection
 * Simple (non-streaming) version.
 */
router.post("/", async (req, res) => {
    const { wallet_a, wallet_b, max_depth, max_degree, batch_size, network: reqNetwork } = req.body;

    if (!wallet_a || !wallet_b) {
        return res.status(400).json({ error: "Missing wallet_a or wallet_b" });
    }

    // Only use TONAPI_KEY here – RPC_API_KEY is a toncenter key that
    // causes "illegal base32 data" 401 errors when sent to tonapi.io.
    const key = process.env.TONAPI_KEY || "";
    const network = reqNetwork || process.env.TON_NETWORK || "testnet";

    try {
        const wasm = await getWasm();
        const resultJson: string = await wasm.find_wallet_connection({
            wallet_a,
            wallet_b,
            api_key: key || undefined,
            network,
            max_depth: max_depth ?? undefined,
            max_degree: max_degree ?? undefined,
            batch_size: batch_size ?? undefined,
        });
        const result = JSON.parse(resultJson);
        return res.json({ ok: true, result });
    } catch (err: any) {
        const message =
            typeof err === "string" ? err : err?.message ?? "Unknown error";
        if (message.includes("timed out") || message.includes("Timeout")) {
            return res.status(408).json({ error: "Search timed out" });
        }
        return res.status(500).json({ error: message });
    }
});

/**
 * GET /api/wallet-connection/stream?wallet_a=...&wallet_b=...&max_depth=2
 * SSE streaming version with live progress updates.
 *
 * Events:
 *   - "progress": { nodes_explored, current_address, queue_a, queue_b, visited_a, visited_b, elapsed_ms, depth }
 *   - "result":   { found, path, depth, nodes_explored, elapsed_ms }
 *   - "error":    { error: string }
 */
router.get("/stream", async (req, res) => {
    const wallet_a = req.query.wallet_a as string;
    const wallet_b = req.query.wallet_b as string;
    const max_depth = req.query.max_depth
        ? Number(req.query.max_depth)
        : undefined;
    const streamNetwork = (req.query.network as string) || process.env.TON_NETWORK || "testnet";

    if (!wallet_a || !wallet_b) {
        return res.status(400).json({ error: "Missing wallet_a or wallet_b" });
    }

    // SSE headers
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
    });

    let cancelled = false;
    req.on("close", () => {
        cancelled = true;
    });

    // Only use TONAPI_KEY here – RPC_API_KEY is a toncenter key that
    // causes "illegal base32 data" 401 errors when sent to tonapi.io.
    const key = process.env.TONAPI_KEY || "";
    const network = streamNetwork;

    try {
        const wasm = await getWasm();

        // Progress callback: send SSE event and return false to cancel
        const onProgress = (info: any) => {
            if (cancelled) return false;
            res.write(
                `event: progress\ndata: ${JSON.stringify({
                    nodes_explored: info.nodes_explored,
                    current_address: info.current_address,
                    queue_a: info.queue_a,
                    queue_b: info.queue_b,
                    visited_a: info.visited_a,
                    visited_b: info.visited_b,
                    elapsed_ms: info.elapsed_ms,
                    depth: info.depth,
                })}\n\n`
            );
            return true; // continue
        };

        const resultJson: string =
            await wasm.find_wallet_connection_streaming(
                {
                    wallet_a,
                    wallet_b,
                    api_key: key || undefined,
                    network,
                    max_depth: max_depth ?? undefined,
                },
                onProgress
            );

        if (!cancelled) {
            const result = JSON.parse(resultJson);
            res.write(`event: result\ndata: ${JSON.stringify(result)}\n\n`);
        }
    } catch (err: any) {
        if (!cancelled) {
            const message =
                typeof err === "string"
                    ? err
                    : err?.message ?? "Unknown error";
            res.write(
                `event: error\ndata: ${JSON.stringify({ error: message })}\n\n`
            );
        }
    } finally {
        if (!cancelled) {
            res.write("event: done\ndata: {}\n\n");
        }
        res.end();
    }
});

export default router;
