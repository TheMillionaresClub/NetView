"use client";

import { useEffect, useRef } from "react";

/* ════════════════════════════════════════════════════════
   TYPES — miroir exact du data.json
════════════════════════════════════════════════════════ */
export interface TopToken {
  symbol: string;
  balance: number;
}

export interface RecentTransaction {
  action: string;
  amount: number;
  token: string;
  time: string;
}

export interface WalletData {
  id: string;
  name: string;
  type: "primary" | "whale" | "trader" | "degen" | "investor" | string;
  totalVolume: number;
  totalTransactions: number;
  topTokens: TopToken[];
  recentTransactions: RecentTransaction[];
}

interface Props {
  wallet: WalletData | null;
  onClose: () => void;
}

/* ════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════ */
function fmtUSD(v: number): string {
  if (v >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
  return "$" + v.toLocaleString();
}

function fmtBalance(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
  if (v < 1)    return v.toFixed(4);
  return v.toLocaleString();
}

function fmtTx(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toString();
}

/* couleur + label par type de wallet */
const TYPE_THEME: Record<string, { color: string; bg: string; label: string; emoji: string }> = {
  primary:  { color: "#fb923c", bg: "rgba(249,115,22,.12)",  label: "PRIMARY",  emoji: "◉" },
  whale:    { color: "#a855f7", bg: "rgba(168,85,247,.12)",  label: "WHALE",    emoji: "◎" },
  trader:   { color: "#3b82f6", bg: "rgba(59,130,246,.12)",  label: "TRADER",   emoji: "⟳" },
  degen:    { color: "#22c55e", bg: "rgba(34,197,94,.12)",   label: "DEGEN",    emoji: "⚡" },
  investor: { color: "#06b6d4", bg: "rgba(6,182,212,.12)",   label: "INVESTOR", emoji: "◈" },
};

/* couleur action */
const ACTION_COLOR: Record<string, string> = {
  SWAP:     "#ffd740",
  BUY:      "#00e676",
  RECEIVE:  "#00e676",
  DEPOSIT:  "#00e676",
  POOL_ADD: "#00e676",
  STAKE:    "#00e5ff",
  ROUTE:    "#00e5ff",
  SEND:     "#ff1744",
  WITHDRAW: "#ff1744",
  APPROVE:  "#4a6080",
};

function actionColor(a: string): string {
  return ACTION_COLOR[a.toUpperCase()] ?? "#c8d8ec";
}

/* icône direction par action */
function actionArrow(a: string): string {
  const out = ["SEND", "WITHDRAW", "POOL_ADD"];
  const neu = ["APPROVE", "STAKE", "ROUTE"];
  if (out.includes(a.toUpperCase())) return "↗";
  if (neu.includes(a.toUpperCase())) return "↔";
  return "↙";
}

/* couleur fond flèche */
function arrowBg(a: string): string {
  const out = ["SEND", "WITHDRAW", "POOL_ADD"];
  const neu = ["APPROVE", "STAKE", "ROUTE"];
  if (out.includes(a.toUpperCase())) return "rgba(255,23,68,.12)";
  if (neu.includes(a.toUpperCase())) return "rgba(0,229,255,.1)";
  return "rgba(0,230,118,.12)";
}

/* max balance pour la barre de token */
function maxBalance(tokens: TopToken[]): number {
  return Math.max(...tokens.map((t) => t.balance), 1);
}

/* couleur token */
const TOKEN_COLORS: Record<string, string> = {
  ETH: "#627EEA", WBTC: "#F7931A", BTC: "#F7931A",
  USDT: "#26A17B", USDC: "#2775CA", DAI: "#F5AC37",
  SOL: "#9945FF", BNB: "#F3BA2F", LINK: "#2A5ADA",
  PEPE: "#00B84A", WIF: "#9945FF",
};
function tokenColor(sym: string): string {
  return TOKEN_COLORS[sym.toUpperCase()] ?? "#c8d8ec";
}
const TOKEN_ICONS: Record<string, string> = {
  ETH: "Ξ", WBTC: "₿", BTC: "₿", USDT: "₮", USDC: "$",
  DAI: "◈", SOL: "◎", BNB: "⬡", LINK: "⬡", PEPE: "🐸", WIF: "🐕",
};
function tokenIcon(sym: string): string {
  return TOKEN_ICONS[sym.toUpperCase()] ?? sym[0];
}

/* ════════════════════════════════════════════════════════
   COMPOSANT
════════════════════════════════════════════════════════ */
export default function DetailPanel({ wallet, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);

  /* clic extérieur → fermer */
  useEffect(() => {
    if (!wallet) return;
    const h = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) onClose();
    };
    const t = setTimeout(() => document.addEventListener("mousedown", h), 80);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", h); };
  }, [wallet, onClose]);

  /* Escape → fermer */
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  if (!wallet) return null;

  const theme  = TYPE_THEME[wallet.type] ?? TYPE_THEME.investor;
  const maxBal = maxBalance(wallet.topTokens);

  return (
    <>
      {/* ── backdrop ── */}
      <div className="dp-backdrop" onClick={onClose} />

      {/* ── carte ── */}
      <div ref={cardRef} className="dp-card">

        {/* barre couleur */}
        <div style={{ height: 3, background: theme.color, flexShrink: 0 }} />

        {/* ═══ HEADER ═══ */}
        <div className="dp-header">
          <div className="dp-avatar" style={{ background: theme.bg, border: `1.5px solid ${theme.color}` }}>
            <span style={{ color: theme.color, fontSize: 22 }}>{theme.emoji}</span>
          </div>
          <div className="dp-header-info">
            <div className="dp-wallet-name">{wallet.name}</div>
            <div className="dp-wallet-id">{wallet.id}</div>
            <span className="dp-badge" style={{ color: theme.color, borderColor: theme.color, background: theme.bg }}>
              {theme.label}
            </span>
          </div>
          <button className="dp-close" onClick={onClose}>✕</button>
        </div>

        {/* ═══ BODY ═══ */}
        <div className="dp-body">

          {/* ── COL GAUCHE ── */}
          <div className="dp-col">

            {/* TOTAL VOLUME */}
            <div className="dp-block">
              <div className="dp-block-label">TOTAL VOLUME</div>
              <div className="dp-big-number" style={{ color: theme.color }}>
                {fmtUSD(wallet.totalVolume)}
              </div>
            </div>

            {/* NB TRANSACTIONS */}
            <div className="dp-block">
              <div className="dp-block-label">NB TRANSACTIONS</div>
              <div className="dp-big-number">{fmtTx(wallet.totalTransactions)}</div>
              <div className="dp-sub-text">transactions confirmées</div>
            </div>

            {/* TOP TOKENS */}
            <div className="dp-block" style={{ borderBottom: "none" }}>
              <div className="dp-block-label">TOP {wallet.topTokens.length} TOKENS</div>
              <div className="dp-token-list">
                {wallet.topTokens.map((t, i) => {
                  const col = tokenColor(t.symbol);
                  const pct = Math.round((t.balance / maxBal) * 100);
                  return (
                    <div key={t.symbol} className="dp-token-row">
                      <div className="dp-token-rank" style={{ color: i === 0 ? "#ffd740" : "#4a6080" }}>
                        #{i + 1}
                      </div>
                      <div className="dp-token-icon" style={{ background: col + "22", color: col }}>
                        {tokenIcon(t.symbol)}
                      </div>
                      <div className="dp-token-info">
                        <div className="dp-token-sym">{t.symbol}</div>
                        <div className="dp-token-bar-wrap">
                          <div className="dp-token-bar-bg">
                            <div className="dp-token-bar-fill" style={{ width: pct + "%", background: col }} />
                          </div>
                          <span className="dp-token-pct">{pct}%</span>
                        </div>
                      </div>
                      <div className="dp-token-balance">{fmtBalance(t.balance)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="dp-col-sep" />

          {/* ── COL DROITE : RECENT TRANSACTIONS ── */}
          <div className="dp-col dp-col-right">
            <div className="dp-block-label" style={{ padding: "14px 16px 8px" }}>
              RECENT TRANSACTIONS
            </div>
            <div className="dp-tx-list">
              {wallet.recentTransactions.map((tx, i) => {
                const col   = actionColor(tx.action);
                const arrow = actionArrow(tx.action);
                const bg    = arrowBg(tx.action);
                return (
                  <div key={i} className="dp-tx-row">
                    <div className="dp-tx-arrow" style={{ background: bg, color: col }}>
                      {arrow}
                    </div>
                    <div className="dp-tx-detail">
                      <div className="dp-tx-action" style={{ color: col }}>{tx.action}</div>
                      <div className="dp-tx-token">{tx.token}</div>
                    </div>
                    <div className="dp-tx-right">
                      <div className="dp-tx-amount">
                        {tx.amount > 0 ? fmtBalance(tx.amount) : "—"} {tx.token}
                      </div>
                      <div className="dp-tx-usd">
                        {tx.amount > 0 ? fmtUSD(tx.amount) : ""}
                      </div>
                      <div className="dp-tx-time">{tx.time}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ═══ FOOTER ═══ */}
        <div className="dp-footer">
          <span className="dp-footer-meta">
            {wallet.totalTransactions} txns · {wallet.topTokens.length} tokens
          </span>
          <button
            className="dp-explorer-btn"
            onClick={() => {
              const tg = (window as any).Telegram?.WebApp;
              const url = `https://etherscan.io/search?q=${wallet.id}`;
              if (tg) tg.openLink?.(url);
              else window.open(url, "_blank");
            }}
          >
            VIEW ON EXPLORER ↗
          </button>
        </div>
      </div>

      <style>{CSS}</style>
    </>
  );
}

/* ════════════════════════════════════════════════════════
   CSS
════════════════════════════════════════════════════════ */
const CSS = `
@keyframes dp-in {
  from { opacity:0; transform:translateX(-50%) translateY(20px) scale(.97); }
  to   { opacity:1; transform:translateX(-50%) translateY(0)    scale(1);   }
}

.dp-backdrop {
  position: fixed; inset: 0;
  background: rgba(4,9,18,.65);
  backdrop-filter: blur(5px);
  z-index: 200;
}

.dp-card {
  position: fixed;
  bottom: 62px; left: 50%;
  transform: translateX(-50%);
  width: min(700px, calc(100vw - 20px));
  max-height: calc(100vh - 110px);
  background: #0b1421;
  border: 1px solid #1c2d42;
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  z-index: 201;
  box-shadow: 0 32px 80px rgba(0,0,0,.85), 0 0 0 1px rgba(255,255,255,.04);
  animation: dp-in .2s cubic-bezier(.4,0,.2,1) both;
}

/* header */
.dp-header {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 14px 16px 12px;
  border-bottom: 1px solid #1c2d42;
}
.dp-avatar {
  width: 46px; height: 46px; border-radius: 12px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.dp-header-info { flex: 1; min-width: 0; }
.dp-wallet-name { font-size: 18px; font-weight: 700; color: #fff; line-height: 1.2; }
.dp-wallet-id   { font-family: 'Share Tech Mono',monospace; font-size: 10px; color: #4a6080; margin-top: 2px; }
.dp-badge {
  display: inline-block; margin-top: 6px;
  font-size: 8px; font-weight: 700; letter-spacing: 1.5px;
  padding: 2px 8px; border: 1px solid; border-radius: 2px;
}
.dp-close {
  background: none; border: none; color: #4a6080;
  font-size: 18px; cursor: pointer; padding: 0 4px; line-height: 1;
  transition: color .15s; flex-shrink: 0;
}
.dp-close:hover { color: #fff; }

/* body — 2 colonnes */
.dp-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.dp-col {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #1c2d42 transparent;
}
.dp-col::-webkit-scrollbar { width: 2px; }
.dp-col::-webkit-scrollbar-thumb { background: #1c2d42; }
.dp-col-right { flex: 1.1; }
.dp-col-sep { width: 1px; background: #1c2d42; flex-shrink: 0; }

/* blocks col gauche */
.dp-block {
  padding: 14px 16px;
  border-bottom: 1px solid #1c2d42;
}
.dp-block-label {
  font-size: 8px; letter-spacing: 2px; color: #4a6080;
  font-weight: 700; margin-bottom: 8px; text-transform: uppercase;
}
.dp-big-number {
  font-family: 'Share Tech Mono', monospace;
  font-size: 30px; font-weight: 700; color: #c8d8ec;
  letter-spacing: -1px; line-height: 1;
}
.dp-sub-text { font-size: 10px; color: #4a6080; margin-top: 4px; }

/* tokens */
.dp-token-list { display: flex; flex-direction: column; gap: 10px; }
.dp-token-row  { display: flex; align-items: center; gap: 8px; }
.dp-token-rank {
  font-family: 'Share Tech Mono', monospace;
  font-size: 10px; font-weight: 700; width: 20px; text-align: center; flex-shrink: 0;
}
.dp-token-icon {
  width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700;
}
.dp-token-info { flex: 1; min-width: 0; }
.dp-token-sym  { font-size: 11px; font-weight: 700; color: #c8d8ec; margin-bottom: 3px; }
.dp-token-bar-wrap { display: flex; align-items: center; gap: 6px; }
.dp-token-bar-bg   { flex: 1; height: 4px; background: #1c2d42; border-radius: 2px; }
.dp-token-bar-fill { height: 100%; border-radius: 2px; transition: width .5s ease; }
.dp-token-pct  { font-family: 'Share Tech Mono', monospace; font-size: 9px; color: #4a6080; flex-shrink: 0; }
.dp-token-balance {
  font-family: 'Share Tech Mono', monospace;
  font-size: 10px; color: #7a9ab8; text-align: right; flex-shrink: 0;
}

/* transactions col droite */
.dp-tx-list { display: flex; flex-direction: column; padding: 0 0 8px; }
.dp-tx-row  {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 9px 16px;
  border-bottom: 1px solid rgba(28,45,66,.5);
  transition: background .1s;
}
.dp-tx-row:hover { background: rgba(0,229,255,.03); }
.dp-tx-arrow {
  width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; margin-top: 1px;
}
.dp-tx-detail { flex: 1; min-width: 0; }
.dp-tx-action {
  font-size: 11px; font-weight: 700; letter-spacing: .5px;
}
.dp-tx-token  {
  font-family: 'Share Tech Mono', monospace;
  font-size: 9px; color: #4a6080; margin-top: 1px;
}
.dp-tx-right  { text-align: right; flex-shrink: 0; }
.dp-tx-amount {
  font-family: 'Share Tech Mono', monospace;
  font-size: 10px; font-weight: 700; color: #c8d8ec;
}
.dp-tx-usd  {
  font-family: 'Share Tech Mono', monospace;
  font-size: 9px; color: #4a6080; margin-top: 1px;
}
.dp-tx-time { font-size: 9px; color: #4a6080; margin-top: 2px; }

/* footer */
.dp-footer {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 16px;
  background: rgba(5,10,20,.6);
  border-top: 1px solid #1c2d42;
  flex-shrink: 0;
}
.dp-footer-meta {
  font-family: 'Share Tech Mono', monospace; font-size: 9px; color: #253548;
}
.dp-explorer-btn {
  background: none; border: 1px solid #1c2d42; color: #4a6080;
  font-family: 'Share Tech Mono', monospace; font-size: 9px; letter-spacing: 1px;
  padding: 5px 12px; border-radius: 3px; cursor: pointer; transition: all .15s;
}
.dp-explorer-btn:hover { border-color: #00e5ff; color: #00e5ff; }
`;
