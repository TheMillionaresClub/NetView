"use client";

import { TonConnectUIProvider } from "@tonconnect/ui-react";

/**
 * TonConnect manifest URL.
 *
 * The wallet's backend fetches this URL server-side to read the app metadata.
 * When the app is behind ngrok (free tier), the dynamic `/api/tonconnect-manifest`
 * endpoint returns ngrok's HTML interstitial instead of JSON, breaking the flow.
 *
 * Use NEXT_PUBLIC_TONCONNECT_MANIFEST_URL (a static, always-reachable gist)
 * so that the wallet can always fetch it — regardless of tunnel / hosting.
 */
const MANIFEST_URL =
  process.env.NEXT_PUBLIC_TONCONNECT_MANIFEST_URL ??
  "https://gist.githubusercontent.com/theshadow76/69d6e474d2ed3906cfd92f2408da6781/raw/tonconnect-manifest.json";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TonConnectUIProvider
      manifestUrl={MANIFEST_URL}
      actionsConfiguration={{
        // After the wallet app signs, tell it to navigate back to the browser.
        // "back" works for both regular mobile browsers and Telegram WebView.
        returnStrategy: "back",
      }}
    >
      {children}
    </TonConnectUIProvider>
  );
}
