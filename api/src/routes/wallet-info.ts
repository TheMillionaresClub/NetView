import { Router } from "express";
import { getWalletInfoWasm } from "../lib/wasm-loader.js";

const router = Router();

// GET /api/wallet-info?address=...
router.get("/", async (req, res) => {
  const { address } = req.query;

  if (!address || typeof address !== "string") {
    return res.status(400).json({ error: "Missing ?address= query parameter" });
  }

  try {
    const bg = await getWalletInfoWasm();
    const raw = await bg.get_address_information(address);

    // Try to parse as JSON, otherwise return as raw balance
    try {
      const parsed = JSON.parse(raw);
      return res.json({ ok: true, result: parsed });
    } catch {
      const nanotons = Number(raw);
      return res.json({
        ok: true,
        result: {
          address,
          balance_nano: raw,
          balance_ton: (nanotons / 1e9).toFixed(9),
        },
      });
    }
  } catch (err) {
    console.error("wallet-info error:", err);
    return res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
