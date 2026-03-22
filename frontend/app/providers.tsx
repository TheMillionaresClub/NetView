"use client";

import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { useEffect, useState } from "react";

// Manifest hosted on GitHub (always reachable, no ngrok interstitial).
// If you move to production with a real domain, switch back to a self-hosted URL.
const GITHUB_MANIFEST_URL =
  "https://raw.githubusercontent.com/theshadow76/public-data/main/epfl/hackathons/2026/NetView/tonconnect-manifest.json";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [manifestUrl, setManifestUrl] = useState("");
  const [twaReturn, setTwaReturn] = useState<`${string}://${string}` | undefined>(undefined);

  useEffect(() => {
    // In production (real domain, no ngrok), use self-hosted manifest.
    // During development with ngrok, use the GitHub-hosted manifest so the
    // wallet can always fetch it without ngrok's interstitial blocking it.
    const envUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (envUrl) {
      // Production / explicitly configured — self-host
      setManifestUrl(`${envUrl}/tonconnect-manifest.json`);
    } else {
      // Dev with ngrok — use GitHub-hosted manifest
      setManifestUrl(GITHUB_MANIFEST_URL);
    }

    // If running inside a Telegram mini-app, set the return URL so the wallet
    // redirects back after approval.
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      setTwaReturn(`${window.location.origin}/` as `${string}://${string}`);
    }

    setReady(true);
  }, []);

  if (!ready) {
    return null;
  }

  return (
    <TonConnectUIProvider
      manifestUrl={manifestUrl}
      actionsConfiguration={{
        twaReturnUrl: twaReturn,
      }}
    >
      {children}
    </TonConnectUIProvider>
  );
}
