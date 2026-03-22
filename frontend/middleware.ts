import { NextRequest, NextResponse } from "next/server";

/**
 * Middleware that adds the ngrok-skip-browser-warning header to all incoming
 * requests. Ngrok's free tier shows an interstitial HTML page for requests
 * that don't include this header, which breaks external services (like
 * TON Wallet) that try to fetch our API routes / manifest.
 */
export function middleware(request: NextRequest) {
  // Clone the request headers and inject the ngrok bypass header so that
  // ngrok never returns the interstitial for any of our routes.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("ngrok-skip-browser-warning", "true");

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Also set CORS headers so the wallet app can fetch the manifest
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "*");

  return response;
}

export const config = {
  matcher: ["/api/:path*", "/tonconnect-manifest.json"],
};
