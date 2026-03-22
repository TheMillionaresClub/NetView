"use client";

import { useState, useEffect } from "react";
import { TonConnectUIProvider } from "@tonconnect/ui-react";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [manifestUrl, setManifestUrl] = useState<string>(
    typeof window !== "undefined"
      ? `${window.location.origin}/api/tonconnect-manifest`
      : "/api/tonconnect-manifest"
  );

  useEffect(() => {
    setManifestUrl(`${window.location.origin}/api/tonconnect-manifest`);
  }, []);

  return (
    <TonConnectUIProvider
      manifestUrl={manifestUrl}
    >
      {children}
    </TonConnectUIProvider>
  );
}
