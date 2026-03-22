"use client";

import { useMemo } from "react";
import { TonConnectUIProvider } from "@tonconnect/ui-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Publicly-reachable manifest — the wallet fetches this **server-side** so it
 * must NOT point at localhost or a Next.js API route.  The static Gist works
 * from every context (desktop, mobile browser, Telegram Mini App).
 */
const MANIFEST_URL =
  "https://gist.githubusercontent.com/theshadow76/69d6e474d2ed3906cfd92f2408da6781/raw/tonconnect-manifest.json";

/** Detect Telegram Mini App context (window.Telegram.WebApp). */
function isTMA(): boolean {
  if (typeof window === "undefined") return false;
  try {
    // Check for the Telegram WebApp object. Some versions have initData as
    // an empty string even inside the mini-app, so checking for its existence
    // (not truthiness) plus the WebApp object itself is more reliable.
    const tg = (window as any).Telegram?.WebApp;
    return !!(tg && typeof tg.initDataUnsafe === "object");
  } catch {
    return false;
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export default function Providers({ children }: { children: React.ReactNode }) {
  const actionsConfiguration = useMemo(() => {
    if (isTMA()) {
      // Inside Telegram: no redirect URL — just bring the mini-app back.
      return {
        twaReturnUrl: window.location.href as `${string}://${string}`,
        returnStrategy: "back" as const,
      };
    }
    // Normal browser (desktop / mobile Safari / Chrome).
    return {
      returnStrategy: "back" as const,
    };
  }, []);

  return (
    <TonConnectUIProvider
      manifestUrl={MANIFEST_URL}
      actionsConfiguration={actionsConfiguration}
    >
      {children}
    </TonConnectUIProvider>
  );
}
