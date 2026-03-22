import { Router } from "express";
import { getWalletScraperWasm } from "../lib/wasm-loader-scraper.js";

const router = Router();
const TONAPI_KEY = process.env.TONAPI_KEY ?? undefined;

// GET /api/wallet-scraper?address=...&network=mainnet|testnet
router.get("/", async (req, res) => {
    const { address, network = "mainnet" } = req.query as Record<string, string>;

    if (!address) {
        return res.status(400).json({ error: "Missing ?address= query parameter" });
    }

    try {
        const bg = await getWalletScraperWasm();
        const raw: string = await bg.scrape_wallet(address, network, TONAPI_KEY ?? null);
        const result = JSON.parse(raw);
        return res.json({ ok: true, result });
    } catch (err) {
        console.error("wallet-scraper error:", err);
        return res.status(500).json({ error: (err as Error).message ?? String(err) });
    }
});

// GET /api/wallet-scraper/batch?addresses=addr1,addr2&network=mainnet|testnet
router.get("/batch", async (req, res) => {
    const { addresses, network = "mainnet" } = req.query as Record<string, string>;

    if (!addresses) {
        return res.status(400).json({ error: "Missing ?addresses= query parameter (comma-separated)" });
    }

    try {
        const bg = await getWalletScraperWasm();
        const addrList = addresses.split(",").map((a) => a.trim()).filter(Boolean);
        const raw: string = await bg.scrape_wallets(JSON.stringify(addrList), network, TONAPI_KEY ?? null);
        const result = JSON.parse(raw);
        return res.json({ ok: true, result });
    } catch (err) {
        console.error("wallet-scraper/batch error:", err);
        return res.status(500).json({ error: (err as Error).message ?? String(err) });
    }
});

// GET /api/wallet-scraper/version
router.get("/version", async (_req, res) => {
    try {
        const bg = await getWalletScraperWasm();
        return res.json({ ok: true, version: bg.wallet_scraper_version() });
    } catch (err) {
        return res.status(500).json({ error: (err as Error).message ?? String(err) });
    }
});

export default router;
