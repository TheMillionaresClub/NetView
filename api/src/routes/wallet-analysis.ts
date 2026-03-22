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
        const raw = await bg.analyze_wallet(address, network, API_KEY ?? null);

        // serde_wasm_bindgen can produce objects with circular refs;
        // re-serialise safely via structured clone → JSON round-trip
        let result: any;
        try {
            result = typeof raw === "string" ? JSON.parse(raw) : JSON.parse(JSON.stringify(raw));
        } catch {
            result = raw;
        }

        return res.json({ ok: true, result });
    } catch (err) {
        console.error("wallet-analysis error:", err);
        return res.status(500).json({ error: (err as Error).message ?? String(err) });
    }
});

// GET /api/wallet-analysis/full?address=...&network=mainnet|testnet
// Like /wallet-analysis but also returns address_balances for all counterparties.
router.get("/full", async (req, res) => {
    const { address, network = "testnet" } = req.query as Record<string, string>;

    if (!address) {
        return res.status(400).json({ error: "Missing ?address= query parameter" });
    }

    try {
        const bg = await getWalletInfoWasm();
        const json: string = await bg.full_analysis(address, network, API_KEY ?? null);
        const result = JSON.parse(json);
        return res.json({ ok: true, result });
    } catch (err) {
        console.error("wallet-analysis/full error:", err);
        return res.status(500).json({ error: (err as Error).message ?? String(err) });
    }
});

export default router;
