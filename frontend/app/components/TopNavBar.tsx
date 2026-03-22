"use client";

import Image from "next/image";
import TonWalletComp from "./TonWalletComp";
import { useTonWallet, useIsConnectionRestored } from "@tonconnect/ui-react";

export default function TopNavBar({
  searchTerm,
  setSearchTerm,
  onMenuToggle,
}: {
  searchTerm?: string;
  setSearchTerm?: (val: string) => void;
  onMenuToggle?: () => void;
}) {
  const restored = useIsConnectionRestored();
  const wallet   = useTonWallet();
  const chain    = wallet?.account?.chain;
  const isTestnet = chain === "-3";

  return (
    <header className="fixed top-0 w-full z-50 flex justify-between items-center px-3 sm:px-4 h-14 bg-[#111417] border-none">
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Hamburger menu - mobile only */}
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="sm:hidden flex items-center justify-center w-9 h-9 text-[#4a6080] hover:text-white transition-colors"
            aria-label="Toggle navigation"
          >
            <span className="material-symbols-outlined text-xl">menu</span>
          </button>
        )}
        <Image src="/image.png" alt="NetView" width={28} height={28} className="object-contain" />
        <span className="text-lg sm:text-xl font-bold text-[#00E5FF] font-headline uppercase tracking-tighter">
          NetView
        </span>
        {/* network badge — only shown when connected */}
        {restored && chain && (
          <span
            className="text-[8px] font-bold tracking-widest px-2 py-0.5 border font-mono"
            style={
              isTestnet
                ? { color: "#ffd740", borderColor: "#ffd740", background: "rgba(255,215,64,.1)" }
                : { color: "#00e676", borderColor: "#00e676", background: "rgba(0,230,118,.1)" }
            }
          >
            {isTestnet ? "TESTNET" : "MAINNET"}
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
