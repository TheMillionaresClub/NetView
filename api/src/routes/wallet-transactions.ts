import { Router } from "express";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";

const router = Router();

// ── Lazy WASM singleton (shared approach with wallet-info route) ──
let bgModule: any = null;

async function getWalletInfo() {
    if (bgModule) return bgModule;

    const require = createRequire(import.meta.url);
    const pkgDir = dirname(require.resolve("wallet-info/package.json"));

    const bg = await import("wallet-info/wallet_info_bg.js");

    const wasmPath = resolve(pkgDir, "wallet_info_bg.wasm");
    const wasmBytes = await readFile(wasmPath);
    const wasmModule = await WebAssembly.instantiate(wasmBytes, {
        "./wallet_info_bg.js": bg,
    });

    bg.__wbg_set_wasm(wasmModule.instance.exports);
    bgModule = bg;
    return bg;
}

// GET /api/wallet-transactions?address=...&limit=...
router.get("/", async (req, res) => {
    const { address, limit } = req.query;

    if (!address || typeof address !== "string") {
        return res
            .status(400)
            .json({ error: "Missing ?address= query parameter" });
    }

    const txLimit = Math.min(Number(limit) || 50, 200);

    try {
        const bg = await getWalletInfo();
        const transactions = await bg.get_transactions(address, txLimit);

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
