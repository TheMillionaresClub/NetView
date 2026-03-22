"use client";

import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { useEffect, useState } from "react";

function getManifestUrl() {
  // NEXT_PUBLIC_APP_URL takes priority if set
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return `${envUrl}/tonconnect-manifest.json`;

  // Derive absolute URL from window.location at runtime
  if (typeof window !== "undefined") {
    return `${window.location.origin}/tonconnect-manifest.json`;
  }

  // SSR fallback — will be replaced on hydration
  return "/tonconnect-manifest.json";
}

function getTwaReturnUrl(): `${string}://${string}` | undefined {
  if (typeof window === "undefined") return undefined;
  const tg = (window as any).Telegram?.WebApp;
  if (!tg) return undefined;
  // Build a tg:// return URL so the wallet app redirects back to this mini app
  // window.location.origin gives us the base URL of the mini app
  return `${window.location.origin}/` as `${string}://${string}`;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [manifestUrl, setManifestUrl] = useState(getManifestUrl);
  const [twaReturn, setTwaReturn] = useState<`${string}://${string}` | undefined>(undefined);

  useEffect(() => {
    // Re-derive on client to ensure absolute URL after hydration
    setManifestUrl(getManifestUrl());
    setTwaReturn(getTwaReturnUrl());
  }, []);

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
