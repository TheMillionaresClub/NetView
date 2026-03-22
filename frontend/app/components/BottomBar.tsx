"use client";

import { useState, useEffect } from "react";
import { toPng } from "html-to-image";
import { useTonAddress, useTonWallet, useTonConnectModal, useIsConnectionRestored } from "@tonconnect/ui-react";

/* ── formatters ── */
function fmtAddr(addr: string, long = false) {
  if (long) return `${addr.slice(0, 12)}…${addr.slice(-10)}`;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

function fmtTon(nano: number): string {
  const ton = nano / 1e9;
  if (ton >= 1e6) return (ton / 1e6).toFixed(2) + "M";
  if (ton >= 1e3) return (ton / 1e3).toFixed(1) + "K";
  if (ton < 0.001 && ton > 0) return ton.toFixed(6);
  return ton.toFixed(3);
}

interface OnChainStats {
  balanceNano: number | null;
  totalTxFetched: number;
  counterpartyCount: number;
  topCounterparty: { address: string; txCount: number; volumeNano: number } | null;
  lastActivity: number | null;
}

/* ════════════════════════════════════════════════════════ */

export default function BottomBar() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const restored   = useIsConnectionRestored();
  const address    = useTonAddress(true);   // user-friendly (EQ…)
  const rawAddress = useTonAddress(false);
  const wallet     = useTonWallet();
  const { open }   = useTonConnectModal();
  const connected  = !!rawAddress;

  /* chain: "-239" = mainnet, "-3" = testnet */
  const chain      = wallet?.account?.chain;
  const isTestnet  = chain === "-3";
  const networkLabel = !chain ? null : isTestnet ? "TESTNET" : "MAINNET";
  const networkColor = isTestnet ? "#ffd740" : "#00e676";

  const appName    = wallet?.device?.appName ?? "TON Wallet";
  const platform   = wallet?.device?.platform ?? "";

  /* ── on-chain stats ── */
  const [stats, setStats] = useState<OnChainStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (!rawAddress) { setStats(null); return; }

    let cancelled = false;
    (async () => {
      setStatsLoading(true);
      try {
        const res = await fetch(
          `http://localhost:3001/api/wallet-network?address=${encodeURIComponent(rawAddress)}&limit=50`
        );
        if (!res.ok) throw new Error("API " + res.status);
        const json = await res.json();
        if (!json.ok || cancelled) return;

        const r = json.result as {
          center: string;
          balanceNano: number | null;
          totalTxFetched: number;
          counterparties: { address: string; sentNano: number; receivedNano: number; txCount: number; lastSeen: number }[];
        };

        const cps = r.counterparties ?? [];
        const top = cps.length > 0
          ? cps.reduce((a, b) => (a.txCount > b.txCount ? a : b))
          : null;

        const lastActivity = cps.length > 0
          ? Math.max(...cps.map(c => c.lastSeen))
          : null;

        if (!cancelled) {
          setStats({
            balanceNano: r.balanceNano,
            totalTxFetched: r.totalTxFetched,
            counterpartyCount: cps.length,
            topCounterparty: top ? { address: top.address, txCount: top.txCount, volumeNano: top.sentNano + top.receivedNano } : null,
            lastActivity,
          });
        }
      } catch (err) {
        console.error("BottomBar stats fetch error:", err);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [rawAddress]);

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

  /* ── not connected ── */
  if (!restored || !connected) {
    return (
      <footer style={{ height: collapsed ? "auto" : "42vh" }} className="fixed bottom-0 left-0 sm:left-20 right-0 w-auto z-50 flex flex-col bg-[#0a1018] border-t border-[#1c2d42] transition-all duration-300">
        {/* collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute -top-7 left-1/2 -translate-x-1/2 z-10 bg-[#0a1018] border border-b-0 border-[#1c2d42] rounded-t-lg px-4 py-1 text-[#4a6080] hover:text-white transition-colors"
          title={collapsed ? "Expand panel" : "Collapse panel"}
        >
          <span className="material-symbols-outlined text-sm" style={{ display: "block", transform: collapsed ? "rotate(180deg)" : "none", transition: "transform 0.3s" }}>expand_more</span>
        </button>
        <div style={{ height: 2, background: "linear-gradient(90deg, #1c2d42 0%, transparent 60%)", flexShrink: 0 }} />
        {collapsed ? null : (
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
        )}
      </footer>
    );
  }

  /* ── connected ── */
  return (
    <footer style={{ height: collapsed ? "auto" : "42vh" }} className="fixed bottom-0 left-0 sm:left-20 right-0 w-auto z-50 flex flex-col bg-[#0a1018] border-t border-[#1c2d42] transition-all duration-300">
      {/* collapse toggle */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="absolute -top-7 left-1/2 -translate-x-1/2 z-10 bg-[#0a1018] border border-b-0 border-[#1c2d42] rounded-t-lg px-4 py-1 text-[#4a6080] hover:text-white transition-colors"
        title={collapsed ? "Expand panel" : "Collapse panel"}
      >
        <span className="material-symbols-outlined text-sm" style={{ display: "block", transform: collapsed ? "rotate(180deg)" : "none", transition: "transform 0.3s" }}>expand_more</span>
      </button>

      {/* accent line */}
      <div style={{ height: 2, background: `linear-gradient(90deg, ${networkColor} 0%, transparent 60%)`, flexShrink: 0 }} />

      {/* header strip */}
      {!collapsed && (<>
      <div className="flex items-center justify-between px-3 sm:px-5 py-2 sm:py-2.5 border-b border-[#1c2d42] shrink-0 gap-2 min-w-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 overflow-hidden">
          {/* wallet avatar — hidden on mobile to save space */}
          <div style={{ background: `${networkColor}18`, border: `1.5px solid ${networkColor}`, width: 32, height: 32, borderRadius: 8 }}
               className="hidden sm:flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-lg" style={{ color: networkColor }}>account_balance_wallet</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="text-white font-bold text-xs sm:text-sm font-headline uppercase tracking-wide truncate">{appName}</span>
              {platform && (
                <span className="hidden sm:inline text-[9px] font-mono text-[#4a6080]">· {platform}</span>
              )}
            </div>
            <div className="font-mono text-[10px] text-[#4a6080] mt-0.5 truncate select-all">{fmtAddr(address, true)}</div>
          </div>
          {networkLabel && (
            <span className="text-[8px] font-bold tracking-widest px-1.5 sm:px-2 py-0.5 border shrink-0"
                  style={{ color: networkColor, borderColor: networkColor, background: `${networkColor}18` }}>
              {networkLabel}
            </span>
          )}
        </div>

        {/* share */}
        <button
          onClick={handleShare}
          disabled={busy}
          className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-4 py-1.5 text-[10px] font-headline font-bold uppercase tracking-widest text-[#0B0E11] bg-[#00E5FF] hover:brightness-110 active:scale-95 transition-all disabled:opacity-60 shrink-0"
        >
          <span className="material-symbols-outlined text-sm">
            {busy ? "progress_activity" : done ? "check" : "share"}
          </span>
          <span className="hidden sm:inline">{busy ? "Capturing…" : done ? "Saved!" : "Share View"}</span>
        </button>
      </div>

      {/* body: desktop = 3 cols side-by-side, mobile = scrollable single column */}
      <div className="flex-1 min-h-0 overflow-y-auto sm:overflow-hidden sm:flex">

        {/* ── COL 1 / ROW 1: account info ── */}
        <div className="flex flex-col justify-center gap-3 sm:gap-5 px-4 sm:px-6 py-3 sm:py-4 border-b sm:border-b-0 sm:border-r border-[#1c2d42] sm:w-72 sm:shrink-0">
          <div>
            <div className="text-[8px] font-bold tracking-[2px] text-[#4a6080] uppercase mb-1 sm:mb-2">Wallet Address</div>
            <div className="font-mono text-[11px] sm:text-xs text-[#c8d8ec] break-all leading-relaxed select-all">
              {address}
            </div>
          </div>
          <div>
            <div className="text-[8px] font-bold tracking-[2px] text-[#4a6080] uppercase mb-1 sm:mb-2">Raw Address</div>
            <div className="font-mono text-[10px] text-[#4a6080] break-all leading-relaxed select-all">
              {rawAddress}
            </div>
          </div>
        </div>

        {/* ── COL 2 / ROW 2: wallet app + network ── */}
        <div className="flex flex-row sm:flex-col justify-around sm:justify-center gap-4 sm:gap-5 px-4 sm:px-6 py-3 sm:py-4 border-b sm:border-b-0 sm:border-r border-[#1c2d42] sm:w-56 sm:shrink-0">
          <div>
            <div className="text-[8px] font-bold tracking-[2px] text-[#4a6080] uppercase mb-1 sm:mb-2">Wallet App</div>
            <div className="font-bold text-base sm:text-lg text-[#c8d8ec] font-headline uppercase tracking-wide">{appName}</div>
            {platform && <div className="text-[10px] text-[#4a6080] mt-0.5 capitalize">{platform}</div>}
          </div>
          <div>
            <div className="text-[8px] font-bold tracking-[2px] text-[#4a6080] uppercase mb-1 sm:mb-2">Network</div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: networkColor }} />
              <span className="font-mono font-bold text-sm" style={{ color: networkColor }}>{networkLabel}</span>
            </div>
            <div className="font-mono text-[9px] text-[#4a6080] mt-0.5">chain {chain}</div>
          </div>
        </div>

        {/* ── COL 3 / ROW 3: on-chain activity ── */}
        <div className="flex flex-col flex-1 min-w-0 py-3 sm:py-0">
          <div className="text-[8px] font-bold tracking-[2px] text-[#4a6080] uppercase px-4 sm:px-5 pt-1 sm:pt-4 pb-2 shrink-0 flex items-center gap-2">
            On-chain Activity
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#00e676" }} />
          </div>

          {statsLoading && !stats && (
            <div className="flex-1 flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-[#1c2d42] border-t-[#00E5FF] rounded-full animate-spin" />
              <span className="font-mono text-[9px] text-[#4a6080] uppercase tracking-widest">Fetching…</span>
            </div>
          )}

          {stats && (
            <div className="flex-1 flex flex-col justify-center gap-3 sm:gap-4 px-4 sm:px-5">
              {/* Balance */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                     style={{ background: "rgba(0,152,234,.12)", border: "1px solid rgba(0,152,234,.25)" }}>
                  <span className="material-symbols-outlined text-base" style={{ color: "#0098EA" }}>account_balance</span>
                </div>
                <div className="min-w-0">
                  <div className="text-[8px] font-bold tracking-[2px] text-[#4a6080] uppercase">Balance</div>
                  <div className="font-mono text-sm font-bold" style={{ color: "#0098EA" }}>
                    {stats.balanceNano !== null ? fmtTon(stats.balanceNano) + " TON" : "—"}
                  </div>
                </div>
              </div>

              {/* Tx count + counterparties row */}
              <div className="flex gap-4 sm:gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                       style={{ background: "rgba(168,85,247,.12)", border: "1px solid rgba(168,85,247,.25)" }}>
                    <span className="material-symbols-outlined text-base" style={{ color: "#a855f7" }}>receipt_long</span>
                  </div>
                  <div>
                    <div className="text-[8px] font-bold tracking-[2px] text-[#4a6080] uppercase">Transactions</div>
                    <div className="font-mono text-sm font-bold text-[#c8d8ec]">{stats.totalTxFetched}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                       style={{ background: "rgba(6,182,212,.12)", border: "1px solid rgba(6,182,212,.25)" }}>
                    <span className="material-symbols-outlined text-base" style={{ color: "#06b6d4" }}>group</span>
                  </div>
                  <div>
                    <div className="text-[8px] font-bold tracking-[2px] text-[#4a6080] uppercase">Wallets</div>
                    <div className="font-mono text-sm font-bold text-[#c8d8ec]">{stats.counterpartyCount}</div>
                  </div>
                </div>
              </div>

              {/* Top counterparty */}
              {stats.topCounterparty && (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                       style={{ background: "rgba(245,158,11,.12)", border: "1px solid rgba(245,158,11,.25)" }}>
                    <span className="material-symbols-outlined text-base" style={{ color: "#f59e0b" }}>star</span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[8px] font-bold tracking-[2px] text-[#4a6080] uppercase">Top Counterparty</div>
                    <div className="font-mono text-[10px] text-[#c8d8ec] truncate">
                      {fmtAddr(stats.topCounterparty.address)}
                      <span className="text-[#4a6080]"> · </span>
                      <span className="text-[#a855f7]">{stats.topCounterparty.txCount} tx</span>
                      <span className="text-[#4a6080]"> · </span>
                      <span style={{ color: "#0098EA" }}>{fmtTon(stats.topCounterparty.volumeNano)} TON</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Last activity */}
              {stats.lastActivity && (
                <div className="font-mono text-[9px] text-[#253548] uppercase tracking-widest">
                  Last activity: {(() => {
                    const diff = Math.floor(Date.now() / 1000) - stats.lastActivity!;
                    if (diff < 60) return diff + "s ago";
                    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
                    if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
                    return Math.floor(diff / 86400) + "d ago";
                  })()}
                </div>
              )}
            </div>
          )}

          {!stats && !statsLoading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 sm:gap-3 text-center px-6 sm:px-8">
              <span className="material-symbols-outlined text-2xl sm:text-3xl text-[#1c2d42]">analytics</span>
              <p className="font-mono text-[10px] text-[#253548] uppercase tracking-widest leading-relaxed">
                No on-chain data available
              </p>
            </div>
          )}
        </div>

      </div>
      </>)}
    </footer>
  );
}
