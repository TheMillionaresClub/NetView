"use client";

import { useState } from "react";
import TopNavBar from "./components/TopNavBar";
import SideNavBar from "./components/SideNavBar";
import BubbleMap from "./components/BubbleMap";
import BottomBar from "./components/BottomBar";
import { normalizeToBounceable } from "./utils/ton";

export default function Home() {
  const [searchTerm, setSearchTerm]     = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [inputValue, setInputValue]     = useState("");
  const [loading, setLoading]           = useState(false);

  const handleLoadWallet = async () => {
    const addr = inputValue.trim();
    if (!addr) return;
    setLoading(true);
    const normalized = await normalizeToBounceable(addr);
    setManualAddress(normalized);
    setLoading(false);
  };

  const handleClear = () => {
    setManualAddress("");
    setInputValue("");
  };

  return (
    <>
      <TopNavBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
      <SideNavBar />

      {/* Address bar */}
      <div className="fixed top-14 left-0 sm:left-20 right-0 z-[100] flex items-center gap-2 px-3 sm:px-4 py-2 bg-[rgba(11,14,17,0.95)] border-b border-[#1c2d42]">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleLoadWallet(); }}
          placeholder="Wallet address..."
          className="flex-1 min-w-0 bg-[#0f1923] border border-[#1c2d42] rounded px-2 py-1.5 text-[#c8d8ec] text-xs font-mono outline-none"
        />
        <button
          onClick={handleLoadWallet}
          disabled={loading}
          className="shrink-0 bg-[#00e5ff] text-[#0b0e11] border-none rounded px-3 py-1.5 text-[11px] font-bold font-mono cursor-pointer tracking-wider disabled:opacity-60"
        >
          LOAD
        </button>
        {/* CLEAR — text on desktop, × on mobile */}
        <button
          onClick={handleClear}
          className="shrink-0 bg-transparent text-[#ef4444] border border-[#ef4444] rounded px-3 py-1.5 text-[11px] font-bold font-mono cursor-pointer tracking-wider hidden sm:block"
        >
          CLEAR
        </button>
        <button
          onClick={handleClear}
          className="shrink-0 text-[#ef4444] border border-[#ef4444] rounded w-7 h-7 flex items-center justify-center text-sm font-bold sm:hidden"
        >
          &times;
        </button>
        <span className="hidden md:inline text-[10px] text-[#4a6080] font-mono shrink-0">
          {manualAddress ? `${manualAddress.slice(0, 8)}...${manualAddress.slice(-6)}` : ""}
        </span>
      </div>

      <BubbleMap
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        manualAddress={manualAddress}
        setManualAddress={setManualAddress}
      />
      <BottomBar />
    </>
  );
}
