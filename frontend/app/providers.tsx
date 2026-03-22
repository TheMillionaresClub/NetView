"use client";

import { TonConnectUIProvider } from "@tonconnect/ui-react";

const manifestUrl =
  process.env.NEXT_PUBLIC_TONCONNECT_MANIFEST_URL ??
  `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/tonconnect-manifest.json`;

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TonConnectUIProvider
      manifestUrl={manifestUrl}
      actionsConfiguration={{ skipRedirectUrl: true }}
    >
      {children}
    </TonConnectUIProvider>
  );
}
