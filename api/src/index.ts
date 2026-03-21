import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import jokeRouter from "./routes/joke.js";
import weatherRouter from "./routes/weather.js";
import premiumContentRouter from "./routes/premium-content.js";
import facilitatorRouter from "./routes/facilitator.js";

dotenv.config();

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

app.listen(PORT, () => {
    console.log(`Express API server running on http://localhost:${PORT}`);
});

export default app;
