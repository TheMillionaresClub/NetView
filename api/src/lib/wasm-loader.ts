import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";

// ── Lazy WASM singleton shared across all routes ────────────────
let bgModule: any = null;

export async function getWalletInfoWasm(): Promise<any> {
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
