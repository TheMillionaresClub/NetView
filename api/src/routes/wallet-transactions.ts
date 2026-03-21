import { Router } from "express";
import { getWalletInfoWasm } from "../lib/wasm-loader.js";

const router = Router();

// GET /api/wallet-transactions?address=...&limit=...
router.get("/", async (req, res) => {
    const { address, limit } = req.query;

    if (!address || typeof address !== "string") {
        return res
            .status(400)
            .json({ error: "Missing ?address= query parameter" });
    }

    const txLimit = Math.min(Number(limit) || 50, 500);
    const apiKey = process.env.RPC_API_KEY ?? null;

    try {
        const bg = await getWalletInfoWasm();
        const transactions = await bg.get_transactions(address, txLimit, apiKey);

        return res.json({
            ok: true,
            result: {
                address,
                count: Array.isArray(transactions) ? transactions.length : 0,
                transactions,
            },
        });
    } catch (err) {
        console.error("wallet-transactions error:", err);
        return res.status(500).json({ error: (err as Error).message });
    }
});

export default router;
