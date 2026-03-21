"use client";

import { CHAIN, TonConnectUIProvider } from "@tonconnect/ui-react";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TonConnectUIProvider
      manifestUrl="/tonconnect-manifest.json"
      network={CHAIN.TESTNET}
    >
      {children}
    </TonConnectUIProvider>
  );
}
