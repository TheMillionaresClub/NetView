"use client";

import { TonConnectUIProvider } from "@tonconnect/ui-react";

/**
 * Use a publicly-hosted manifest so wallets (Tonkeeper, etc.) can always
 * fetch it — even through ngrok where the free-tier interstitial would
 * otherwise block the JSON response.
 */
const MANIFEST_URL =
  "https://gist.githubusercontent.com/theshadow76/69d6e474d2ed3906cfd92f2408da6781/raw/tonconnect-manifest.json";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TonConnectUIProvider manifestUrl={MANIFEST_URL}>
      {children}
    </TonConnectUIProvider>
  );
}
