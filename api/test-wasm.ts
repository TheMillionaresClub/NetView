import express from "express";
import { getWalletInfoWasm } from "./src/lib/wasm-loader.js";

// Also load wallet-connection to see if it interferes
import { createRequire } from "node:module";
const require2 = createRequire(import.meta.url);

console.log("Loading wallet-connection...");
const wc = require2("wallet-connection");
console.log("wallet-connection loaded OK, exports:", Object.keys(wc).slice(0, 5));

const app = express();
app.get("/test", async (_req, res) => {
    try {
        const bg = await getWalletInfoWasm();
        const result = await bg.analyze_wallet(
            "0QBbtZtF0cYG5xj7JvpbUhHIkMqx3PhE4FVqAXJx9k-Ljy8_",
            "testnet",
            null
        );
        res.json({ ok: true, len: String(result).length });
    } catch (e: any) {
        console.error("Error:", e);
        res.status(500).json({ error: e.message ?? String(e) });
    }
});
app.listen(3099, () => console.log("Test server on 3099"));

