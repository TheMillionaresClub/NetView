import { Router } from "express";
import { getWalletInfoWasm } from "../lib/wasm-loader.js";

const router = Router();
const API_KEY = process.env.RPC_API_KEY ?? undefined;

// GET /api/wallet-analysis?address=...&network=mainnet|testnet
router.get("/", async (req, res) => {
    const { address, network = "testnet" } = req.query as Record<string, string>;

    if (!address) {
        return res.status(400).json({ error: "Missing ?address= query parameter" });
    }

    try {
        const bg = await getWalletInfoWasm();
        const profile = await bg.analyze_wallet(address, network, API_KEY ?? null);
        return res.json({ ok: true, result: profile });
    } catch (err) {
        console.error("wallet-analysis error:", err);
        return res.status(500).json({ error: (err as Error).message ?? String(err) });
    }
});

export default router;
