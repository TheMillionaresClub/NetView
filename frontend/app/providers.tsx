"use client";

import { TonConnectUIProvider } from "@tonconnect/ui-react";

const manifestUrl ="https://gist.githubusercontent.com/theshadow76/69d6e474d2ed3906cfd92f2408da6781/raw/tonconnect-manifest.json";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      {children}
    </TonConnectUIProvider>
  );
}
