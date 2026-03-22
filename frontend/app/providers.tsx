"use client";

import { useEffect, useState } from "react";
import { TonConnectUIProvider } from "@tonconnect/ui-react";

/**
 * Serve the TonConnect manifest from our own API route so the `url` field
 * always matches the current app origin (works with localhost, ngrok, prod).
 *
 * We wait for the client-side mount before rendering TonConnectUIProvider so
 * the provider only initialises once with the correct manifest URL.  The old
 * approach (render with a gist fallback, then re-mount via key change) caused
 * a double-initialisation that destroyed the in-flight deep-link connection
 * flow on mobile wallets.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  const [manifestUrl, setManifestUrl] = useState<string | null>(null);

  useEffect(() => {
    setManifestUrl(`${window.location.origin}/api/tonconnect-manifest`);
  }, []);

  // Don't render the provider until we know the real origin —
  // a single mount prevents the deep-link interruption on mobile.
  if (!manifestUrl) return null;

  return (
    <TonConnectUIProvider
      manifestUrl={manifestUrl}
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
