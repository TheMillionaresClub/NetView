"use client";

import { useState } from "react";
import TopNavBar from "./components/TopNavBar";
import SideNavBar from "./components/SideNavBar";
import BubbleMap from "./components/BubbleMap";
import BottomBar from "./components/BottomBar";

export default function Home() {
  const [searchTerm, setSearchTerm] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [inputValue, setInputValue] = useState("");

  const handleLoadWallet = () => {
    const addr = inputValue.trim();
    if (!addr) return;
    setManualAddress(addr);
  };

  const handleClear = () => {
    setManualAddress("");
    setInputValue("");
  };

  return (
    <>
      <TopNavBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
      <SideNavBar />

      {/* Test Wallet Input Bar */}
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
        {manualAddress && (
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
        )}
        {manualAddress && (
          <span style={{ fontSize: 10, color: "#4a6080", fontFamily: "'Share Tech Mono', monospace" }}>
            {manualAddress.slice(0, 8)}...{manualAddress.slice(-6)}
          </span>
        )}
      </div>

      <BubbleMap
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        manualAddress={manualAddress}
        setManualAddress={setManualAddress}
      />
      <BottomBar />

      {/* Atmosphere Overlay */}
      <div className="fixed inset-0 pointer-events-none border-[20px] border-surface-container-lowest/20 z-[60]" />
    </>
  );
}
