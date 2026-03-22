import type { Request, Response } from "express";

type WebHandler = (request: globalThis.Request) => globalThis.Response | Promise<globalThis.Response>;

/**
 * Converts an Express req/res pair into the standard Web Request/Response API
 * used by @ton-x402/middleware and @ton-x402/facilitator.
 */
export function webToExpress(handler: WebHandler) {
    return async (req: Request, res: Response): Promise<void> => {
        try {
            // Build a Web Request from Express req
            const protocol = req.protocol;
            const host = req.get("host") ?? "https://ayesha-acrotic-gingerly.ngrok-free.dev";
            const url = `${protocol}://${host}${req.originalUrl}`;

            const headers = new Headers();
            for (const [key, value] of Object.entries(req.headers)) {
                if (value) {
                    if (Array.isArray(value)) {
                        value.forEach((v) => headers.append(key, v));
                    } else {
                        headers.set(key, value);
                    }
                }
            }

            const init: RequestInit = {
                method: req.method,
                headers,
            };

            // Only add body for methods that support it
            if (req.method !== "GET" && req.method !== "HEAD") {
                init.body = JSON.stringify(req.body);
            }

            const webRequest = new globalThis.Request(url, init);

            // Call the handler
            const webResponse = await handler(webRequest);

            // Write the Web Response back to Express
            res.status(webResponse.status);

            webResponse.headers.forEach((value, key) => {
                res.setHeader(key, value);
            });

            const body = await webResponse.text();
            res.send(body);
        } catch (err) {
            console.error("webToExpress adapter error:", err);
            res.status(500).json({ error: "Internal server error" });
        }
    };
}
