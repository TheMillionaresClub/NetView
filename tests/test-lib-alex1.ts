import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

async function main() {
  // Load the WASM glue code
  const bg = await import("wallet-info/wallet_info_bg.js");

  // Read and instantiate the WASM binary manually (Node.js can't import .wasm directly)
  const wasmPath = resolve(
    fileURLToPath(import.meta.url),
    "../../packages/wallet-info/wallet_info_bg.wasm"
  );
  const wasmBytes = await readFile(wasmPath);
  const wasmModule = await WebAssembly.instantiate(wasmBytes, {
    "./wallet_info_bg.js": bg,
  });

  // Inject the WASM exports into the glue code
  bg.__wbg_set_wasm(wasmModule.instance.exports);

  // Now call the exported function
  const address = "kQDMo9xJIt6qMhYJg5luhIK18XkRJVKUPeOgrA0ORJoTgewC";
  const info = await bg.get_address_information(address);

  // The function returns a string — could be JSON or raw value
  console.log("Raw result:", info);

  try {
    const parsed = JSON.parse(info);
    console.log("Parsed:", JSON.stringify(parsed, null, 2));
  } catch {
    // Raw value (e.g. balance in nanotons)
    const tons = Number(info) / 1e9;
    console.log("Balance:", tons.toFixed(4), "TON");
  }
}

main().catch(console.error);