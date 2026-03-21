import { Router } from "express";
import {
    createVerifyHandler,
    createSettleHandler,
} from "@ton-x402/facilitator";
import { webToExpress } from "../lib/web-adapter.js";

const router = Router();

const config = {
    tonRpcUrl:
        process.env.TON_RPC_URL ??
        "https://testnet.toncenter.com/api/v2/jsonRPC",
    tonApiKey: process.env.RPC_API_KEY,
};

const verifyHandler = createVerifyHandler(config);
const settleHandler = createSettleHandler(config);

router.post("/verify", webToExpress(verifyHandler));
router.post("/settle", webToExpress(settleHandler));

export default router;
