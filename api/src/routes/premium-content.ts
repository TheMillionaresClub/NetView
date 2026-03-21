import { Router } from "express";
import { paymentGate } from "@ton-x402/middleware";
import { getPaymentConfig } from "../lib/payment-config.js";
import { webToExpress } from "../lib/web-adapter.js";

const router = Router();

let gatedHandler: ReturnType<typeof paymentGate> | null = null;

function getHandler() {
    if (!gatedHandler) {
        gatedHandler = paymentGate(
            async (_req) => {
                return Response.json({
                    success: true,
                    content:
                        "This is premium content only accessible after paying 1.0 Jetton!",
                    secretCode:
                        "JETTONS-ARE-AWESOME-" +
                        Math.random().toString(36).substring(7),
                });
            },
            {
                config: getPaymentConfig({
                    amount: "10000000",
                    asset:
                        process.env.JETTON_MASTER_ADDRESS ||
                        "kQCd6G7c_HUBkgwtmGzpdqvHIQoNkYOEE0kSWoc5v57hPPnW",
                    description: "Premium Content Access (0.01 BSA USD)",
                    decimals: 9,
                }),
            },
        );
    }
    return gatedHandler;
}

router.get("/", webToExpress((req) => getHandler()(req)));

export default router;
