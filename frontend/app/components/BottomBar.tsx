"use client";

import { useState } from "react";
import { toPng } from "html-to-image";
import { useTonAddress, useTonWallet, useTonConnectModal, useIsConnectionRestored } from "@tonconnect/ui-react";

/* ── formatters ── */
function fmtAddr(addr: string, long = false) {
  if (long) return `${addr.slice(0, 12)}…${addr.slice(-10)}`;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

/* ════════════════════════════════════════════════════════ */

export default function BottomBar() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

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

  /* ── connected ── */
  return (
    <footer style={{ height: "42vh" }} className="fixed bottom-0 left-0 w-full z-50 flex flex-col bg-[#0a1018] border-t border-[#1c2d42]">

      {/* accent line — cyan for mainnet, yellow for testnet */}
      <div style={{ height: 2, background: `linear-gradient(90deg, ${networkColor} 0%, transparent 60%)`, flexShrink: 0 }} />

      {/* header strip */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-[#1c2d42] shrink-0">
        <div className="flex items-center gap-3">
          {/* wallet avatar */}
          <div style={{ background: `${networkColor}18`, border: `1.5px solid ${networkColor}`, width: 38, height: 38, borderRadius: 10 }}
               className="flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl" style={{ color: networkColor }}>account_balance_wallet</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-sm font-headline uppercase tracking-wide">{appName}</span>
              {platform && (
                <span className="text-[9px] font-mono text-[#4a6080]">· {platform}</span>
              )}
            </div>
            <div className="font-mono text-[10px] text-[#4a6080] mt-0.5 select-all">{fmtAddr(address, true)}</div>
          </div>
          {networkLabel && (
            <span className="ml-2 text-[8px] font-bold tracking-widest px-2 py-0.5 border"
                  style={{ color: networkColor, borderColor: networkColor, background: `${networkColor}18` }}>
              {networkLabel}
            </span>
          )}
        </div>

        {/* share */}
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

      {/* body: wallet details */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── COL 1: account info ── */}
        <div className="flex flex-col justify-center gap-5 px-6 py-4 border-r border-[#1c2d42] w-72 shrink-0">
          <div>
            <div className="text-[8px] font-bold tracking-[2px] text-[#4a6080] uppercase mb-2">Wallet Address</div>
            <div className="font-mono text-xs text-[#c8d8ec] break-all leading-relaxed select-all">
              {address}
            </div>
          </div>
          <div>
            <div className="text-[8px] font-bold tracking-[2px] text-[#4a6080] uppercase mb-2">Raw Address</div>
            <div className="font-mono text-[10px] text-[#4a6080] break-all leading-relaxed select-all">
              {rawAddress}
            </div>
          </div>
        </div>

        {/* ── COL 2: wallet app + network ── */}
        <div className="flex flex-col justify-center gap-5 px-6 py-4 border-r border-[#1c2d42] w-56 shrink-0">
          <div>
            <div className="text-[8px] font-bold tracking-[2px] text-[#4a6080] uppercase mb-2">Wallet App</div>
            <div className="font-bold text-lg text-[#c8d8ec] font-headline uppercase tracking-wide">{appName}</div>
            {platform && <div className="text-[10px] text-[#4a6080] mt-1 capitalize">{platform}</div>}
          </div>
          <div>
            <div className="text-[8px] font-bold tracking-[2px] text-[#4a6080] uppercase mb-2">Network</div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: networkColor }} />
              <span className="font-mono font-bold text-sm" style={{ color: networkColor }}>
                {networkLabel}
              </span>
            </div>
            <div className="font-mono text-[9px] text-[#4a6080] mt-1">chain {chain}</div>
          </div>
        </div>

        {/* ── COL 3: activity placeholder ── */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <div className="text-[8px] font-bold tracking-[2px] text-[#4a6080] uppercase px-5 pt-4 pb-2 shrink-0">
            On-chain Activity
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
            <span className="material-symbols-outlined text-3xl text-[#1c2d42]">analytics</span>
            <p className="font-mono text-[10px] text-[#253548] uppercase tracking-widest leading-relaxed">
              Real-time on-chain data<br />coming soon
            </p>
          </div>
        </div>

      </div>
    </footer>
  );
}
