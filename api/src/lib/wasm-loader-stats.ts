import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";

// ── Lazy WASM singleton shared across all routes ────────────────
let bgModule: any = null;

export async function getTonStatsWasm(): Promise<any> {
    if (bgModule) return bgModule;

    const require = createRequire(import.meta.url);
    const pkgDir = dirname(require.resolve("ton-stats/package.json"));

    // @ts-ignore — WASM bindgen generated module has no .d.ts
    const bg = await import("ton-stats/ton_stats_bg.js");

    const wasmPath = resolve(pkgDir, "ton_stats_bg.wasm");
    const wasmBytes = await readFile(wasmPath);
    const wasmModule = await WebAssembly.instantiate(wasmBytes, {
        "./ton_stats_bg.js": bg,
    });

    bg.__wbg_set_wasm(wasmModule.instance.exports);

    const exports = wasmModule.instance.exports as Record<string, any>;
    if (typeof exports.__wbindgen_start === "function") {
        exports.__wbindgen_start();
    }

    bgModule = bg;
    return bg;
}
