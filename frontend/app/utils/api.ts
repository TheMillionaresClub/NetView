/**
 * Central API base URL.
 *
 * In production / local dev the Next.js rewrites proxy /api/* to the Express
 * server, so we use an empty string (same-origin).  This avoids CORS issues
 * and ngrok's browser interstitial entirely.
 *
 * Set NEXT_PUBLIC_API_URL only if the Express API is on a different domain
 * that properly handles CORS (e.g. a real deployment).
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";
