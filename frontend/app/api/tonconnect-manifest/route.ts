import { NextRequest, NextResponse } from "next/server";

/**
 * Dynamically serves tonconnect-manifest.json with the correct `url` field
 * matching the actual origin (ngrok, vercel, etc.) instead of a hardcoded domain.
 */
export async function GET(req: NextRequest) {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    `${req.nextUrl.protocol}//${req.headers.get("host")}`;

  const manifest = {
    url: origin,
    name: "NetView",
    iconUrl:
      "https://raw.githubusercontent.com/theshadow76/public-data/refs/heads/main/epfl/hackathons/2026/NetView/image.png",
  };

  return NextResponse.json(manifest, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache",
    },
  });
}
