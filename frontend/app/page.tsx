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
        <div style={{ textAlign: "center", maxWidth: 520, padding: "0 24px" }}>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 900,
              color: "#fff",
              marginBottom: 8,
              letterSpacing: 2,
            }}
          >
            NetView
          </h1>
          <p style={{ fontSize: 13, color: "#4a6080", marginBottom: 40 }}>
            Enter a TON wallet address to explore its transaction network
          </p>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleLoadWallet(); }}
              placeholder="EQ… or 0Q… wallet address"
              style={{
                flex: 1,
                background: "#0f1923",
                border: "1px solid #1c2d42",
                borderRadius: 8,
                padding: "14px 16px",
                color: "#c8d8ec",
                fontSize: 14,
                fontFamily: "'Share Tech Mono', monospace",
                outline: "none",
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
      <TopNavBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
      <SideNavBar />

      {/* Address bar */}
      <div
        style={{
          position: "fixed",
          top: 56,
          left: 80,
          right: 0,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 16px",
          background: "rgba(11,14,17,0.95)",
          borderBottom: "1px solid #1c2d42",
        }}
      >
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleLoadWallet(); }}
          placeholder="Enter wallet address..."
          style={{
            flex: 1,
            background: "#0f1923",
            border: "1px solid #1c2d42",
            borderRadius: 4,
            padding: "6px 12px",
            color: "#c8d8ec",
            fontSize: 12,
            fontFamily: "'Share Tech Mono', monospace",
            outline: "none",
          }}
        />
        <button
          onClick={handleLoadWallet}
          style={{
            background: "#00e5ff",
            color: "#0b0e11",
            border: "none",
            borderRadius: 4,
            padding: "6px 16px",
            fontSize: 11,
            fontWeight: 700,
            fontFamily: "'Share Tech Mono', monospace",
            cursor: "pointer",
            letterSpacing: 1,
          }}
        >
          LOAD
        </button>
        <button
          onClick={handleClear}
          style={{
            background: "transparent",
            color: "#ef4444",
            border: "1px solid #ef4444",
            borderRadius: 4,
            padding: "6px 16px",
            fontSize: 11,
            fontWeight: 700,
            fontFamily: "'Share Tech Mono', monospace",
            cursor: "pointer",
            letterSpacing: 1,
          }}
        >
          CLEAR
        </button>
        <span style={{ fontSize: 10, color: "#4a6080", fontFamily: "'Share Tech Mono', monospace" }}>
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

      <div className="fixed inset-0 pointer-events-none border-[20px] border-surface-container-lowest/20 z-[60]" />
    </>
  );
}
