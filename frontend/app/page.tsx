"use client";

import { useState } from "react";
import TopNavBar from "./components/TopNavBar";
import SideNavBar from "./components/SideNavBar";
import BubbleMap from "./components/BubbleMap";
import BottomBar from "./components/BottomBar";
import { normalizeToBounceable } from "./utils/ton";

export default function Home() {
  const [searchTerm, setSearchTerm] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  // No address yet → show landing screen
  if (!manualAddress) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0B0E11",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Share Tech Mono', monospace",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 520, padding: "0 20px", width: "100%" }}>
          <h1
            style={{
              fontSize: "clamp(24px, 6vw, 32px)",
              fontWeight: 900,
              color: "#fff",
              marginBottom: 8,
              letterSpacing: 2,
            }}
          >
            NetView
          </h1>
          <p style={{ fontSize: 13, color: "#4a6080", marginBottom: 32 }}>
            Enter a TON wallet address to explore its transaction network
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleLoadWallet(); }}
              placeholder="EQ… or 0Q… wallet address"
              style={{
                width: "100%",
                background: "#0f1923",
                border: "1px solid #1c2d42",
                borderRadius: 8,
                padding: "14px 16px",
                color: "#c8d8ec",
                fontSize: 14,
                fontFamily: "'Share Tech Mono', monospace",
                outline: "none",
                boxSizing: "border-box",
              }}
              autoFocus
            />
            <button
              onClick={handleLoadWallet}
              disabled={loading || !inputValue.trim()}
              style={{
                background: loading ? "#0a4a54" : "#00e5ff",
                color: "#0b0e11",
                border: "none",
                borderRadius: 8,
                padding: "14px 24px",
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "'Share Tech Mono', monospace",
                cursor: loading ? "wait" : "pointer",
                letterSpacing: 1,
                opacity: !inputValue.trim() ? 0.4 : 1,
                width: "100%",
              }}
            >
              {loading ? "..." : "EXPLORE"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Address loaded → show graph
  return (
    <>
      <TopNavBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} onMenuToggle={() => setSidebarOpen(o => !o)} />
      <SideNavBar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Address bar */}
      <div
        className="fixed top-14 left-0 sm:left-20 right-0 z-[100] flex items-center gap-2 px-3 sm:px-4 py-2 bg-[rgba(11,14,17,0.95)] border-b border-[#1c2d42]"
      >
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
          className="shrink-0 bg-[#00e5ff] text-[#0b0e11] border-none rounded px-3 py-1.5 text-[11px] font-bold font-mono cursor-pointer tracking-wider"
        >
          LOAD
        </button>
        <button
          onClick={handleClear}
          className="shrink-0 bg-transparent text-[#ef4444] border border-[#ef4444] rounded px-3 py-1.5 text-[11px] font-bold font-mono cursor-pointer tracking-wider hidden sm:block"
        >
          CLEAR
        </button>
        {/* On mobile, show a small X icon instead of CLEAR text */}
        <button
          onClick={handleClear}
          className="shrink-0 text-[#ef4444] border border-[#ef4444] rounded w-7 h-7 flex items-center justify-center text-sm font-bold sm:hidden"
        >
          &times;
        </button>
        <span className="hidden md:inline text-[10px] text-[#4a6080] font-mono shrink-0">
          {manualAddress.slice(0, 8)}...{manualAddress.slice(-6)}
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
