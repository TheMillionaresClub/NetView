import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// Load env vars BEFORE importing routes (they read process.env at config time)
dotenv.config();

// Dynamic imports to ensure env vars are loaded first
const { default: jokeRouter } = await import("./routes/joke.js");
const { default: weatherRouter } = await import("./routes/weather.js");
const { default: premiumContentRouter } = await import("./routes/premium-content.js");
const { default: facilitatorRouter } = await import("./routes/facilitator.js");
const { default: walletInfoRouter } = await import("./routes/wallet-info.js");
const { default: walletTransactionsRouter } = await import("./routes/wallet-transactions.js");
const { default: traceLinkRouter } = await import("./routes/trace-link.js");
const { default: walletAnalysisRouter } = await import("./routes/wallet-analysis.js");
const { default: walletNetworkRouter } = await import("./routes/wallet-network.js");
const { default: normalizeAddressRouter } = await import("./routes/normalize-address.js");
const { default: walletConnectionRouter } = await import("./routes/wallet-connection.js");
const { default: walletScraperRouter } = await import("./routes/wallet-scraper.js");

const app = express();
const PORT = process.env.PORT ?? 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/", (_req, res) => {
    res.json({ status: "ok", message: "x402 Express API server" });
});

// Routes
app.use("/api/joke", jokeRouter);
app.use("/api/weather", weatherRouter);
app.use("/api/premium-content", premiumContentRouter);
app.use("/api/facilitator", facilitatorRouter);
app.use("/api/wallet-info", walletInfoRouter);
app.use("/api/wallet-transactions", walletTransactionsRouter);
app.use("/api/trace-link", traceLinkRouter);
app.use("/api/wallet-analysis", walletAnalysisRouter);
app.use("/api/wallet-network", walletNetworkRouter);
app.use("/api/normalize-address", normalizeAddressRouter);
app.use("/api/wallet-connection", walletConnectionRouter);
app.use("/api/wallet-scraper", walletScraperRouter);

app.listen(PORT, () => {
    console.log(`Express API server running on http://localhost:${PORT}`);
});

export default app;
