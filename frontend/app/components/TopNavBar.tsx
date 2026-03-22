"use client";

import Image from "next/image";
import TonWalletComp from "./TonWalletComp";
import { useTonWallet, useIsConnectionRestored } from "@tonconnect/ui-react";

export default function TopNavBar({
  searchTerm,
  setSearchTerm,
  network,
  setNetwork,
}: {
  searchTerm?: string;
  setSearchTerm?: (val: string) => void;
  network?: "testnet" | "mainnet";
  setNetwork?: (n: "testnet" | "mainnet") => void;
}) {
  const restored  = useIsConnectionRestored();
  const wallet    = useTonWallet();
  const chain     = wallet?.account?.chain;
  // wallet chain badge (read-only indicator of what's connected)
  const walletNet = chain === "-239" ? "mainnet" : chain === "-3" ? "testnet" : null;

  const isTestnet = (network ?? "testnet") === "testnet";

  return (
    <header className="fixed top-0 w-full z-50 flex justify-between items-center px-3 sm:px-4 h-14 bg-[#111417] border-none">
      <div className="flex items-center gap-2 sm:gap-3">
        <Image src="/image.png" alt="NetView" width={28} height={28} className="object-contain" />
        <span className="text-lg sm:text-xl font-bold text-[#00E5FF] font-headline uppercase tracking-tighter">
          NetView
        </span>

        {/* Network toggle — always visible */}
        {setNetwork ? (
          <div className="flex items-center border border-[#1c2d42] rounded overflow-hidden text-[8px] font-bold font-mono tracking-widest">
            <button
              onClick={() => setNetwork("testnet")}
              style={isTestnet
                ? { background: "rgba(255,215,64,.15)", color: "#ffd740", padding: "3px 8px", borderRight: "1px solid #1c2d42" }
                : { background: "transparent", color: "#4a6080", padding: "3px 8px", borderRight: "1px solid #1c2d42", cursor: "pointer" }}
            >
              TEST
            </button>
            <button
              onClick={() => setNetwork("mainnet")}
              style={!isTestnet
                ? { background: "rgba(0,230,118,.12)", color: "#00e676", padding: "3px 8px" }
                : { background: "transparent", color: "#4a6080", padding: "3px 8px", cursor: "pointer" }}
            >
              MAIN
            </button>
          </div>
        ) : (
          // Fallback: read-only badge when no setter provided
          restored && walletNet && (
            <span
              className="text-[8px] font-bold tracking-widest px-2 py-0.5 border font-mono"
              style={walletNet === "testnet"
                ? { color: "#ffd740", borderColor: "#ffd740", background: "rgba(255,215,64,.1)" }
                : { color: "#00e676", borderColor: "#00e676", background: "rgba(0,230,118,.1)" }}
            >
              {walletNet.toUpperCase()}
            </span>
          )
        )}

        {/* Wallet chain mismatch warning */}
        {restored && walletNet && network && walletNet !== network && (
          <span className="text-[8px] font-bold font-mono px-2 py-0.5 border border-[#f59e0b] text-[#f59e0b] rounded"
                style={{ background: "rgba(245,158,11,.1)" }}>
            wallet on {walletNet.toUpperCase()}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <TonWalletComp />
        <div className="hidden sm:flex bg-surface-container-low px-3 py-1.5 items-center gap-2">
          <span className="material-symbols-outlined text-sm text-outline">search</span>
          <input
            className="bg-transparent border-none text-xs font-headline tracking-widest focus:ring-0 w-32 md:w-64 uppercase text-on-surface-variant placeholder:text-on-surface-variant/50 outline-none"
            placeholder="SEARCH WALLET..."
            type="text"
            value={searchTerm ?? ""}
            onChange={(e) => setSearchTerm?.(e.target.value)}
          />
        </div>
      </div>
    </header>
  );
}
