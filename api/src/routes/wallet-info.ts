import { Router } from "express";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const router = Router();

// ── Lazy WASM singleton ─────────────────────────────────────────
let bgModule: any = null;

async function getWalletInfo() {
  if (bgModule) return bgModule;

  // Resolve the wallet-info package path
  const require = createRequire(import.meta.url);
  const pkgDir = dirname(require.resolve("wallet-info/package.json"));

  // Load the JS glue code
  const bg = await import("wallet-info/wallet_info_bg.js");

  // Read and instantiate the WASM binary
  const wasmPath = resolve(pkgDir, "wallet_info_bg.wasm");
  const wasmBytes = await readFile(wasmPath);
  const wasmModule = await WebAssembly.instantiate(wasmBytes, {
    "./wallet_info_bg.js": bg,
  });

  // Inject WASM exports into the glue code
  bg.__wbg_set_wasm(wasmModule.instance.exports);

  bgModule = bg;
  return bg;
}

// GET /api/wallet-info?address=...
router.get("/", async (req, res) => {
  const { address } = req.query;

  if (!address || typeof address !== "string") {
    return res.status(400).json({ error: "Missing ?address= query parameter" });
  }

  try {
    const bg = await getWalletInfo();
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
