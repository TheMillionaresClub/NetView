"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TonConnectUIProvider } from "@tonconnect/ui-react";

/**
 * Serve the TonConnect manifest from our own API route so the `url` field
 * always matches the current app origin (works with localhost, ngrok, prod).
 *
 * IMPORTANT: We must NOT use `key={manifestUrl}` on the provider.
 * Changing the key destroys and recreates the TonConnectUIProvider,
 * which kills the active bridge session.  On desktop this is tolerable
 * (the QR-code flow is bridge-resilient), but on mobile the wallet has
 * already opened via deep-link and is talking to the OLD bridge — the
 * connection silently fails.
 *
 * Instead we compute the manifest URL once (synchronously where possible)
 * and only fall back to the Gist URL during SSR.
 */
const GIST_FALLBACK =
  "https://gist.githubusercontent.com/theshadow76/69d6e474d2ed3906cfd92f2408da6781/raw/tonconnect-manifest.json";

function getInitialManifestUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/tonconnect-manifest`;
  }
  return GIST_FALLBACK;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  // Stable manifest URL — computed once, never causes a provider remount.
  const manifestUrl = useMemo(getInitialManifestUrl, []);

  // actionsConfiguration tells the mobile wallet how to return to the app
  // after the user approves the connection / transaction.
  const actionsConfiguration = useMemo(
    () => ({
      returnStrategy: (typeof window !== "undefined"
        ? window.location.origin
        : "back") as "back" | `${string}://${string}`,
    }),
    [],
  );

  return (
    <TonConnectUIProvider
      manifestUrl={manifestUrl}
      actionsConfiguration={actionsConfiguration}
    >
      {children}
    </TonConnectUIProvider>
  );
}
