"use client";

import { useEffect, useState } from "react";
import { TonConnectUIProvider } from "@tonconnect/ui-react";

/**
 * Serve the TonConnect manifest from our own API route so the `url` field
 * always matches the current app origin (works with localhost, ngrok, prod).
 * Falls back to the static Gist URL during SSR, then switches on mount.
 */
const GIST_FALLBACK =
  "https://gist.githubusercontent.com/theshadow76/69d6e474d2ed3906cfd92f2408da6781/raw/tonconnect-manifest.json";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [manifestUrl, setManifestUrl] = useState(GIST_FALLBACK);

  useEffect(() => {
    // Build the absolute URL to our dynamic manifest endpoint
    setManifestUrl(`${window.location.origin}/api/tonconnect-manifest`);
  }, []);

  return (
    <TonConnectUIProvider manifestUrl={manifestUrl} key={manifestUrl}>
      {children}
    </TonConnectUIProvider>
  );
}
