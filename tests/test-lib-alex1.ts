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
  const address = "0QD6a-uyjiAX8gRmtPi2ztdeBEliw6GrBa6dQBeM8wlQfJ5K";
  const info = await bg.get_address_information(address);

  // info is a JSON string
  const parsed = JSON.parse(info);
  console.log("Balance:", parsed.balance, "Status:", parsed.status);
  console.log("Full response:", JSON.stringify(parsed, null, 2));
}

main().catch(console.error);