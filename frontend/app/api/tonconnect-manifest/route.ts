import { NextRequest, NextResponse } from "next/server";

/**
 * Dynamically serve the TonConnect manifest with the correct `url`
 * based on the incoming request origin. This ensures wallet connection
 * works regardless of whether the app is accessed via localhost or ngrok.
 */
export function GET(req: NextRequest) {
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3002";
  const origin = `${proto}://${host}`;

  const manifest = {
    url: origin,
    name: "NetView",
    iconUrl:
      "https://raw.githubusercontent.com/theshadow76/public-data/refs/heads/main/epfl/hackathons/2026/NetView/image.png",
  };

  return NextResponse.json(manifest, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Cache-Control": "no-store",
    },
  });
}

export function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
