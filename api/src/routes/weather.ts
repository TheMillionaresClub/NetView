import { Router } from "express";
import { paymentGate } from "@ton-x402/middleware";
import { getPaymentConfig } from "../lib/payment-config.js";
import { webToExpress } from "../lib/web-adapter.js";

const router = Router();

const handler = (_request: Request) => {
    return Response.json({
        location: "Lausanne, Switzerland",
        temperature: 22,
        unit: "celsius",
        conditions: "Partly cloudy",
        humidity: 45,
        timestamp: new Date().toISOString(),
    });
};

const gatedHandler = paymentGate(handler, {
    config: getPaymentConfig({
        amount: "10000000", // 0.01 BSA USD (9 decimals)
        asset:
            process.env.JETTON_MASTER_ADDRESS ||
            "kQCd6G7c_HUBkgwtmGzpdqvHIQoNkYOEE0kSWoc5v57hPPnW",
        description: "Premium weather data (0.01 BSA USD)",
        decimals: 9,
    }),
});

router.get("/", webToExpress(gatedHandler));

export default router;
