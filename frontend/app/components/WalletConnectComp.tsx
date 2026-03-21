"use client";

import { useState, useCallback } from "react";
import { getWalletKit } from "../services/WalletConnect";

type Status = "disconnected" | "connecting" | "connected" | "error";

export default function WalletConnectComp() {
  const [status, setStatus] = useState<Status>("disconnected");
  const [uri, setUri] = useState("");
  const [peerName, setPeerName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    if (!uri.startsWith("wc:")) {
      setError("Paste a valid WalletConnect URI (starts with wc:)");
      return;
    }

    setStatus("connecting");
    setError(null);

    try {
      const kit = await getWalletKit();

      kit.on("session_proposal", async (proposal) => {
        setPeerName(proposal.params.proposer.metadata.name);
        setStatus("connected");
      });

      await kit.pair({ uri });
    } catch (err) {
      setError((err as Error).message);
      setStatus("error");
    }
  }, [uri]);

  const disconnect = useCallback(async () => {
    setStatus("disconnected");
    setPeerName(null);
    setUri("");
  }, []);

  return (
    <div className="flex items-center gap-3">
      {status === "disconnected" || status === "error" ? (
        <>
          <input
            value={uri}
            onChange={(e) => setUri(e.target.value)}
            placeholder="wc:..."
            className="bg-surface-container-low px-3 py-1.5 text-xs font-headline tracking-widest uppercase text-on-surface-variant placeholder:text-on-surface-variant/50 outline-none w-44 md:w-56"
          />
          <button
            onClick={connect}
            className="bg-[#00E5FF] text-[#0B0E11] px-3 py-1.5 text-[10px] font-headline font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all"
          >
            Connect
          </button>
          {error && (
            <span className="text-error text-[10px] max-w-[160px] truncate">
              {error}
            </span>
          )}
        </>
      ) : status === "connecting" ? (
        <span className="text-[10px] text-secondary font-headline uppercase tracking-widest animate-pulse">
          Connecting…
        </span>
      ) : (
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-primary-container rounded-full" />
          <span className="text-[10px] text-primary font-headline uppercase tracking-widest">
            {peerName ?? "Connected"}
          </span>
          <button
            onClick={disconnect}
            className="text-error text-[10px] font-headline uppercase tracking-widest hover:underline ml-2"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
