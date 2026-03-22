import { getWalletInfoWasm } from "./src/lib/wasm-loader.js";

console.log("Loading WASM...");
const bg = await getWalletInfoWasm();
console.log("WASM loaded OK");

console.log("Calling analyze_wallet...");
try {
    const result = await bg.analyze_wallet(
        "0QBbtZtF0cYG5xj7JvpbUhHIkMqx3PhE4FVqAXJx9k-Ljy8_",
        "testnet",
        null
    );
    console.log("Result type:", typeof result);
    console.log("Result (first 200):", String(result).substring(0, 200));
} catch (e: any) {
    console.error("Error:", e.message ?? e);
}
