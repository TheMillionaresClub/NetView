"use client";

import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { useEffect, useState } from "react";

/**
 * Defer rendering TonConnectUIProvider until we're on the client so the SDK
 * is never initialized with a relative/empty manifest URL.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [manifestUrl, setManifestUrl] = useState("");
  const [twaReturn, setTwaReturn] = useState<`${string}://${string}` | undefined>(undefined);

  useEffect(() => {
    // Absolute manifest URL — use the dynamic API route so the manifest `url`
    // field always matches the actual origin (ngrok / vercel / any host).
    const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    setManifestUrl(`${base}/api/tonconnect-manifest`);

    // If running inside a Telegram mini-app, set the return URL so the wallet
    // redirects back after approval.
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      setTwaReturn(`${window.location.origin}/` as `${string}://${string}`);
    }

    setReady(true);
  }, []);

  // Don't render children until the provider is ready — child components use
  // TonConnect hooks that crash without the provider in the tree.
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
