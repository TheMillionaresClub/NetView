"use client";

import { useState } from "react";
import { toPng } from "html-to-image";
import { useTonAddress, useTonConnectModal, useIsConnectionRestored } from "@tonconnect/ui-react";
import walletData from "../../public/data.json";

/* ── "me" entry provides portfolio stats in the demo dataset ── */
const ME_STATS = walletData[0];

/* ── formatters ── */
function fmtUSD(v: number) {
  if (v >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
  return "$" + v.toLocaleString();
}
function fmtBal(v: number) {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
  if (v < 1)    return v.toFixed(4);
  return v.toLocaleString();
}
function fmtTx(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toString();
}

/* ── type theme ── */
const TYPE_THEME: Record<string, { color: string; bg: string; label: string; emoji: string }> = {
  primary:  { color: "#fb923c", bg: "rgba(249,115,22,.12)",  label: "PRIMARY",  emoji: "◉" },
  whale:    { color: "#a855f7", bg: "rgba(168,85,247,.12)",  label: "WHALE",    emoji: "◎" },
  trader:   { color: "#3b82f6", bg: "rgba(59,130,246,.12)",  label: "TRADER",   emoji: "⟳" },
  degen:    { color: "#22c55e", bg: "rgba(34,197,94,.12)",   label: "DEGEN",    emoji: "⚡" },
  investor: { color: "#06b6d4", bg: "rgba(6,182,212,.12)",   label: "INVESTOR", emoji: "◈" },
};

/* ── token colors / icons ── */
const TOKEN_COLORS: Record<string, string> = {
  TON: "#00E5FF", ETH: "#627EEA", WBTC: "#F7931A", BTC: "#F7931A",
  USDT: "#26A17B", USDC: "#2775CA", DAI: "#F5AC37",
  SOL: "#9945FF", BNB: "#F3BA2F", LINK: "#2A5ADA",
};
const TOKEN_ICONS: Record<string, string> = {
  TON: "◎", ETH: "Ξ", WBTC: "₿", BTC: "₿", USDT: "₮", USDC: "$",
  DAI: "◈", SOL: "◎", BNB: "⬡",
};
const tokenColor = (s: string) => TOKEN_COLORS[s.toUpperCase()] ?? "#c8d8ec";
const tokenIcon  = (s: string) => TOKEN_ICONS[s.toUpperCase()] ?? s[0];

/* ── action colors ── */
const ACTION_COLOR: Record<string, string> = {
  SWAP: "#ffd740", BUY: "#00e676", RECEIVE: "#00e676",
  DEPOSIT: "#00e676", POOL_ADD: "#00e676", STAKE: "#00e5ff",
  ROUTE: "#00e5ff", SEND: "#ff1744", WITHDRAW: "#ff1744", APPROVE: "#4a6080",
};
const actionColor = (a: string) => ACTION_COLOR[a.toUpperCase()] ?? "#c8d8ec";
const actionArrow = (a: string) => {
  if (["SEND","WITHDRAW","POOL_ADD"].includes(a.toUpperCase())) return "↗";
  if (["APPROVE","STAKE","ROUTE"].includes(a.toUpperCase())) return "↔";
  return "↙";
};
const arrowBg = (a: string) => {
  if (["SEND","WITHDRAW","POOL_ADD"].includes(a.toUpperCase())) return "rgba(255,23,68,.15)";
  if (["APPROVE","STAKE","ROUTE"].includes(a.toUpperCase())) return "rgba(0,229,255,.1)";
  return "rgba(0,230,118,.12)";
};

/* ════════════════════════════════════════════════════════ */

export default function BottomBar() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  /* ── wallet connection ── */
  const restored  = useIsConnectionRestored();
  const address   = useTonAddress(true);   // user-friendly
  const rawAddress = useTonAddress(false);
  const { open }  = useTonConnectModal();
  const connected = !!rawAddress;

  /* truncated address for display */
  const truncated = address ? `${address.slice(0, 8)}…${address.slice(-6)}` : null;

  /* use demo stats from data.json user_1 (the "me" node) */
  const stats  = ME_STATS;
  const theme  = TYPE_THEME[stats.type] ?? TYPE_THEME.investor;
  const maxBal = Math.max(...stats.topTokens.map((t) => t.balance), 1);

  const handleShare = async () => {
    setBusy(true);
    try {
      const el = document.querySelector<HTMLElement>(".react-flow");
      if (!el) { alert("Nothing to capture — open the map first!"); return; }
      const dataUrl = await toPng(el, {
        backgroundColor: "#080d14", pixelRatio: 2, skipFonts: true,
        filter: (node) => {
          const cls = node.classList?.toString() ?? "";
          if (cls.includes("react-flow__controls")) return false;
          if (cls.includes("react-flow__minimap")) return false;
          return true;
        },
      });
      const res  = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], "netview-graph.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: "NetView — Network Graph", files: [file] });
      } else {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement("a");
        a.href = url; a.download = "netview-graph.png";
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
      }
      setDone(true);
      setTimeout(() => setDone(false), 2500);
    } catch (err: any) {
      if (err?.name !== "AbortError") console.error("Share failed:", err);
    } finally {
      setBusy(false);
    }
  };

  /* ── not connected state ── */
  if (!restored || !connected) {
    return (
      <footer style={{ height: "42vh" }} className="fixed bottom-0 left-0 w-full z-50 flex flex-col bg-[#0a1018] border-t border-[#1c2d42]">
        <div style={{ height: 2, background: "linear-gradient(90deg, #1c2d42 0%, transparent 60%)", flexShrink: 0 }} />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          {!restored ? (
            <span className="font-mono text-[11px] text-[#4a6080] uppercase tracking-widest animate-pulse">
              Restoring connection…
            </span>
          ) : (
            <>
              <span className="material-symbols-outlined text-4xl text-[#1c2d42]">account_balance_wallet</span>
              <p className="font-mono text-[11px] text-[#4a6080] uppercase tracking-widest">
                Connect your wallet to view your info
              </p>
              <button
                onClick={() => open()}
                className="bg-[#00E5FF] text-[#0B0E11] px-6 py-2 text-[10px] font-headline font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">account_balance_wallet</span>
                Connect TON
              </button>
            </>
          )}
        </div>
      </footer>
    );
  }

  /* ── connected state ── */
  return (
    <footer style={{ height: "42vh" }} className="fixed bottom-0 left-0 w-full z-50 flex flex-col bg-[#0a1018] border-t border-[#1c2d42]">

      {/* accent line */}
      <div style={{ height: 2, background: `linear-gradient(90deg, ${theme.color} 0%, transparent 60%)`, flexShrink: 0 }} />

      {/* header strip */}
      <div className="flex items-center justify-between px-5 py-2 border-b border-[#1c2d42] shrink-0">
        <div className="flex items-center gap-3">
          {/* avatar */}
          <div style={{ background: theme.bg, border: `1.5px solid ${theme.color}`, width: 36, height: 36, borderRadius: 10 }}
               className="flex items-center justify-center text-lg shrink-0">
            <span style={{ color: theme.color }}>{theme.emoji}</span>
          </div>
          <div>
            <div className="text-white font-bold text-sm font-headline uppercase tracking-wide leading-tight">
              {stats.name}
            </div>
            <div className="font-mono text-[10px] text-[#4a6080] mt-0.5">{truncated}</div>
          </div>
          <span className="ml-2 text-[8px] font-bold tracking-widest px-2 py-0.5 border"
                style={{ color: theme.color, borderColor: theme.color, background: theme.bg }}>
            {theme.label}
          </span>
        </div>

        {/* share button */}
        <button
          onClick={handleShare}
          disabled={busy}
          className="flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-headline font-bold uppercase tracking-widest text-[#0B0E11] bg-[#00E5FF] hover:brightness-110 active:scale-95 transition-all disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-sm">
            {busy ? "progress_activity" : done ? "check" : "share"}
          </span>
          {busy ? "Capturing…" : done ? "Saved!" : "Share View"}
        </button>
      </div>

      {/* body: 3 columns */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── COL 1: stats ── */}
        <div className="flex flex-col justify-center gap-4 px-6 py-4 border-r border-[#1c2d42] w-48 shrink-0">
          <div>
            <div className="text-[8px] font-bold tracking-[2px] text-[#4a6080] uppercase mb-1">Total Volume</div>
            <div className="font-mono font-bold text-2xl leading-none" style={{ color: theme.color }}>
              {fmtUSD(stats.totalVolume)}
            </div>
          </div>
          <div>
            <div className="text-[8px] font-bold tracking-[2px] text-[#4a6080] uppercase mb-1">Transactions</div>
            <div className="font-mono font-bold text-2xl leading-none text-[#c8d8ec]">
              {fmtTx(stats.totalTransactions)}
            </div>
            <div className="text-[9px] text-[#4a6080] mt-0.5">confirmed txns</div>
          </div>
          <div>
            <div className="text-[8px] font-bold tracking-[2px] text-[#4a6080] uppercase mb-1">Tokens held</div>
            <div className="font-mono font-bold text-2xl leading-none text-[#c8d8ec]">
              {stats.topTokens.length}
            </div>
          </div>
        </div>

        {/* ── COL 2: top tokens ── */}
        <div className="flex flex-col px-5 py-4 border-r border-[#1c2d42] w-64 shrink-0 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#1c2d42 transparent" }}>
          <div className="text-[8px] font-bold tracking-[2px] text-[#4a6080] uppercase mb-3">Top Tokens</div>
          <div className="flex flex-col gap-3">
            {stats.topTokens.map((t, i) => {
              const col = tokenColor(t.symbol);
              const pct = Math.round((t.balance / maxBal) * 100);
              return (
                <div key={t.symbol} className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold w-4 shrink-0"
                        style={{ color: i === 0 ? "#ffd740" : "#4a6080" }}>
                    #{i + 1}
                  </span>
                  <div className="flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold shrink-0"
                       style={{ background: col + "22", color: col }}>
                    {tokenIcon(t.symbol)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-bold text-[#c8d8ec] mb-1">{t.symbol}</div>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1 bg-[#1c2d42] rounded-sm overflow-hidden">
                        <div className="h-full rounded-sm" style={{ width: pct + "%", background: col }} />
                      </div>
                      <span className="font-mono text-[9px] text-[#4a6080]">{pct}%</span>
                    </div>
                  </div>
                  <div className="font-mono text-[10px] text-[#7a9ab8] shrink-0">{fmtBal(t.balance)}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── COL 3: recent transactions ── */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <div className="text-[8px] font-bold tracking-[2px] text-[#4a6080] uppercase px-5 pt-4 pb-2 shrink-0">
            Recent Transactions
          </div>
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#1c2d42 transparent" }}>
            {stats.recentTransactions.length === 0 ? (
              <div className="px-5 text-[10px] text-[#4a6080] font-mono">No recent transactions.</div>
            ) : (
              stats.recentTransactions.map((tx, i) => {
                const col   = actionColor(tx.action);
                const arrow = actionArrow(tx.action);
                const bg    = arrowBg(tx.action);
                return (
                  <div key={i} className="flex items-start gap-3 px-5 py-2.5 border-b border-[#1c2d42]/50 hover:bg-[#00e5ff06] transition-colors">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] shrink-0 mt-0.5"
                         style={{ background: bg, color: col }}>
                      {arrow}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold" style={{ color: col }}>{tx.action}</div>
                      <div className="font-mono text-[9px] text-[#4a6080] mt-0.5">{tx.token}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-[10px] font-bold text-[#c8d8ec]">
                        {tx.amount > 0 ? fmtBal(tx.amount) : "—"} {tx.amount > 0 ? tx.token : ""}
                      </div>
                      <div className="font-mono text-[9px] text-[#4a6080] mt-0.5">
                        {tx.amount > 0 ? fmtUSD(tx.amount) : ""}
                      </div>
                      <div className="text-[9px] text-[#4a6080] mt-0.5">{tx.time}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </footer>
  );
}
