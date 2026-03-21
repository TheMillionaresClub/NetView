"use client";

import { useState } from "react";
import TopNavBar from "../components/TopNavBar";
import SideNavBar from "../components/SideNavBar";

const MOCK_TXS = [
  { hash: "a1b2...f3e4", from: "EQAk...R9UO", to: "EQD-...SLsq", value: "1,259.14", token: "TON", type: "transfer", time: "2 min ago", status: "confirmed" },
  { hash: "c5d6...7890", from: "EQBb...Ljy8", to: "EQCX...mK4w", value: "500.00", token: "USDT", type: "swap", time: "5 min ago", status: "confirmed" },
  { hash: "e9f0...1234", from: "EQD-...SLsq", to: "EQAk...R9UO", value: "0.164", token: "TON", type: "stake", time: "13 min ago", status: "confirmed" },
  { hash: "5678...abcd", from: "EQBb...Ljy8", to: "EQCX...mK4w", value: "25,000.00", token: "USDC", type: "transfer", time: "1 hr ago", status: "confirmed" },
  { hash: "def0...9876", from: "EQCX...mK4w", to: "EQD-...SLsq", value: "2.4", token: "WBTC", type: "swap", time: "2 hr ago", status: "confirmed" },
  { hash: "1111...2222", from: "EQAk...R9UO", to: "EQBb...Ljy8", value: "10,000.00", token: "TON", type: "transfer", time: "3 hr ago", status: "confirmed" },
  { hash: "3333...4444", from: "EQD-...SLsq", to: "EQCX...mK4w", value: "1,000.00", token: "SOL", type: "bridge", time: "5 hr ago", status: "pending" },
  { hash: "5555...6666", from: "EQCX...mK4w", to: "EQAk...R9UO", value: "50.00", token: "TON", type: "unstake", time: "8 hr ago", status: "confirmed" },
];

const TYPE_COLOR: Record<string, string> = {
  transfer: "text-primary-container",
  swap: "text-secondary",
  stake: "text-tertiary",
  unstake: "text-tertiary",
  bridge: "text-[#ffd740]",
};

const TYPE_ICON: Record<string, string> = {
  transfer: "swap_horiz",
  swap: "currency_exchange",
  stake: "lock",
  unstake: "lock_open",
  bridge: "router",
};

export default function TransactionsPage() {
  const [filter, setFilter] = useState<string>("all");

  const filtered = filter === "all"
    ? MOCK_TXS
    : MOCK_TXS.filter((tx) => tx.type === filter);

  return (
    <>
      <TopNavBar />
      <SideNavBar />
      <main className="fixed left-20 right-0 top-14 bottom-0 bg-surface-container-lowest overflow-y-auto">
        <div className="max-w-5xl mx-auto p-8">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-headline font-bold text-primary-container tracking-tight uppercase">
                Transactions
              </h1>
              <p className="text-xs text-outline mt-1 uppercase tracking-widest">
                Real-time TON network activity
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 bg-primary-container rounded-full animate-pulse" />
              <span className="text-outline uppercase tracking-widest text-[10px]">
                Live
              </span>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-2 mb-6">
            {["all", "transfer", "swap", "stake", "bridge"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 text-[10px] font-headline font-bold uppercase tracking-widest transition-all ${
                  filter === f
                    ? "bg-[#00E5FF] text-[#0B0E11]"
                    : "bg-surface-container-high text-outline hover:text-on-surface"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="bg-surface border border-surface-container-highest">
            {/* Header */}
            <div className="grid grid-cols-[120px_1fr_1fr_140px_100px_80px_80px] gap-4 px-6 py-3 border-b border-surface-container-highest text-[9px] font-headline font-bold uppercase tracking-widest text-outline">
              <span>Hash</span>
              <span>From</span>
              <span>To</span>
              <span className="text-right">Value</span>
              <span className="text-center">Type</span>
              <span className="text-right">Time</span>
              <span className="text-center">Status</span>
            </div>

            {/* Rows */}
            {filtered.map((tx, i) => (
              <div
                key={i}
                className="grid grid-cols-[120px_1fr_1fr_140px_100px_80px_80px] gap-4 px-6 py-4 border-b border-surface-container-highest/50 hover:bg-surface-container-low/30 transition-colors"
              >
                <span className="text-xs tabular-nums text-primary-container font-mono">
                  {tx.hash}
                </span>
                <span className="text-xs tabular-nums text-on-surface-variant font-mono truncate">
                  {tx.from}
                </span>
                <span className="text-xs tabular-nums text-on-surface-variant font-mono truncate">
                  {tx.to}
                </span>
                <span className="text-xs tabular-nums text-on-surface text-right font-headline">
                  {tx.value} <span className="text-outline">{tx.token}</span>
                </span>
                <div className="flex items-center justify-center gap-1">
                  <span className={`material-symbols-outlined text-sm ${TYPE_COLOR[tx.type] ?? "text-outline"}`}>
                    {TYPE_ICON[tx.type] ?? "receipt"}
                  </span>
                  <span className={`text-[10px] uppercase ${TYPE_COLOR[tx.type] ?? "text-outline"}`}>
                    {tx.type}
                  </span>
                </div>
                <span className="text-[10px] tabular-nums text-outline text-right">
                  {tx.time}
                </span>
                <div className="flex justify-center">
                  <span className={`text-[10px] px-2 py-0.5 font-bold uppercase ${
                    tx.status === "confirmed"
                      ? "bg-primary-container/10 text-primary-container"
                      : "bg-[#ffd740]/10 text-[#ffd740]"
                  }`}>
                    {tx.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
