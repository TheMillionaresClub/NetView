import { Router } from "express";
import { getWalletInfoWasm } from "../lib/wasm-loader.js";

const router = Router();

// GET /api/normalize-address?address=...
// Returns the canonical bounceable form (EQ…) of any TON address.
router.get("/", async (req, res) => {
    const { address } = req.query as Record<string, string>;

    if (!address) {
        return res.status(400).json({ error: "Missing ?address= query parameter" });
    }

    try {
        const bg = await getWalletInfoWasm();
        const normalized: string = bg.normalize_address(address);
        return res.json({ ok: true, address: normalized });
    } catch (err) {
        return res.status(500).json({ error: (err as Error).message ?? String(err) });
    }
});

export default router;
