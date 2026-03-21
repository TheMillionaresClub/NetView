"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/* ════════════════════════════════════════════════════════
   TYPES — mock data (still used by BubbleMap nodes)
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
  with: string;
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

/* ── On-chain types (from /api/wallet-analysis) ─────── */
interface JettonBalance {
  jetton_address: string;
  wallet_address: string;
  balance: string;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  image: string | null;
}

interface NftItem {
  address: string;
  collection_name: string | null;
  name: string | null;
  image: string | null;
  on_sale: boolean;
  verified: boolean;
}

interface TxSummary {
  hash: string;
  lt: string;
  utime: number;
  total_fees: string;
  in_msg_value: string | null;
  out_msg_count: number;
}

interface Classification {
  kind: string; // "HumanWallet" | "BotWallet" | "SmartContract" | "Exchange"
  confidence: number;
  signals: string[];
}

interface WalletProfile {
  address: string;
  state: { address: string; balance: number; status: string; wallet_type: string | null; seqno: number | null; is_wallet: boolean } | null;
  info: { wallet_type: string | null; seqno: number | null; account_state: string } | null;
  jettons: JettonBalance[];
  nfts: NftItem[];
  dns_names: { name: string; category: string; value: string }[];
  recent_transactions: TxSummary[];
  classification: Classification;
}

interface Props {
  wallet: WalletData | null;
  onClose: () => void;
  isUnlocked?: boolean;
  onUnlock?: () => void;
}

/* ════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════ */
function fmtTon(nano: number): string {
  const ton = nano / 1e9;
  if (ton >= 1e6) return (ton / 1e6).toFixed(2) + "M";
  if (ton >= 1e3) return (ton / 1e3).toFixed(1) + "K";
  if (ton < 0.001) return ton.toFixed(6);
  return ton.toFixed(3);
}

function fmtBalance(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
  if (v < 1) return v.toFixed(4);
  return v.toLocaleString();
}

function fmtJetton(raw: string, decimals: number | null): string {
  const d = decimals ?? 9;
  const v = Number(raw) / Math.pow(10, d);
  return fmtBalance(v);
}

function fmtTx(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toString();
}

function timeAgo(utime: number): string {
  const diff = Math.floor(Date.now() / 1000) - utime;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fmtNano(v: string): string {
  const n = Number(v) / 1e9;
  if (n === 0) return "0";
  if (n < 0.001) return n.toFixed(6);
  return n.toFixed(3);
}

function shortAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

const KIND_THEME: Record<string, { color: string; bg: string; label: string; emoji: string }> = {
  HumanWallet:   { color: "#06b6d4", bg: "rgba(6,182,212,.12)",   label: "HUMAN WALLET",   emoji: "👤" },
  BotWallet:     { color: "#f59e0b", bg: "rgba(245,158,11,.12)",  label: "BOT WALLET",     emoji: "🤖" },
  SmartContract: { color: "#a855f7", bg: "rgba(168,85,247,.12)",  label: "SMART CONTRACT", emoji: "📜" },
  Exchange:      { color: "#3b82f6", bg: "rgba(59,130,246,.12)",  label: "EXCHANGE",       emoji: "🏛" },
  Unknown:       { color: "#64748b", bg: "rgba(100,116,139,.12)", label: "UNKNOWN",        emoji: "❓" },
};

const TYPE_THEME: Record<string, { color: string; bg: string; label: string; emoji: string }> = {
  primary:  { color: "#fb923c", bg: "rgba(249,115,22,.12)",  label: "PRIMARY",  emoji: "◉" },
  whale:    { color: "#a855f7", bg: "rgba(168,85,247,.12)",  label: "WHALE",    emoji: "◎" },
  trader:   { color: "#3b82f6", bg: "rgba(59,130,246,.12)",  label: "TRADER",   emoji: "⟳" },
  degen:    { color: "#22c55e", bg: "rgba(34,197,94,.12)",   label: "DEGEN",    emoji: "⚡" },
  investor: { color: "#06b6d4", bg: "rgba(6,182,212,.12)",   label: "INVESTOR", emoji: "◈" },
};

const TOKEN_COLORS: Record<string, string> = {
  TON: "#0098EA", ETH: "#627EEA", WBTC: "#F7931A", BTC: "#F7931A",
  USDT: "#26A17B", USDC: "#2775CA", DAI: "#F5AC37",
  SOL: "#9945FF", BNB: "#F3BA2F", LINK: "#2A5ADA",
  PEPE: "#00B84A", WIF: "#9945FF", STON: "#0098EA",
  JUSDT: "#26A17B", JUSDC: "#2775CA",
};
function tokenColor(sym: string): string {
  return TOKEN_COLORS[sym.toUpperCase()] ?? "#c8d8ec";
}

/* ════════════════════════════════════════════════════════
   COMPOSANT
════════════════════════════════════════════════════════ */
export default function DetailPanel({ wallet, onClose, isUnlocked = false, onUnlock }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [profile, setProfile] = useState<WalletProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── Fetch on-chain profile when wallet changes ── */
  const fetchProfile = useCallback(async (address: string) => {
    setLoading(true);
    setError(null);
    setProfile(null);
    try {
      const res = await fetch(
        `http://localhost:3001/api/wallet-analysis?address=${encodeURIComponent(address)}&network=testnet`
      );
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      if (data.ok) {
        setProfile(data.result);
      } else {
        throw new Error(data.error ?? "Unknown error");
      }
    } catch (err: any) {
      setError(err.message ?? "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!wallet || wallet.id === "me") return;
    if (!isUnlocked) return;
    fetchProfile(wallet.id);
  }, [wallet?.id, isUnlocked, fetchProfile]);

  /* ── Click outside / Escape to close ── */
  useEffect(() => {
    if (!wallet) return;
    const h = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) onClose();
    };
    const t = setTimeout(() => document.addEventListener("mousedown", h), 80);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", h); };
  }, [wallet, onClose]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  if (!wallet) return null;

  const fallbackTheme = TYPE_THEME[wallet.type] ?? TYPE_THEME.investor;
  const onchainKind = profile?.classification?.kind ?? null;
  const theme = onchainKind ? (KIND_THEME[onchainKind] ?? KIND_THEME.Unknown) : fallbackTheme;
  const isMe = wallet.id === "me";
  const locked = !isMe && !isUnlocked;

  // Derived on-chain values
  const balanceNano = profile?.state?.balance ?? 0;
  const status = profile?.state?.status ?? profile?.info?.account_state ?? "—";
  const txCount = profile?.recent_transactions?.length ?? 0;
  const jettons = profile?.jettons ?? [];
  const nfts = profile?.nfts ?? [];
  const txs = profile?.recent_transactions ?? [];
  const confidence = profile?.classification?.confidence ?? 0;

  return (
    <>
      <div className="dp-backdrop" onClick={onClose} />

      <div ref={cardRef} className="dp-card">

        {/* accent bar */}
        <div style={{ height: 3, background: locked ? "#1c2d42" : theme.color, flexShrink: 0 }} />

        {/* HEADER */}
        <div className="dp-header">
          <div className="dp-avatar" style={{
            background: locked ? "rgba(28,45,66,.4)" : theme.bg,
            border: `1.5px solid ${locked ? "#1c2d42" : theme.color}`,
          }}>
            <span style={{ color: locked ? "#4a6080" : theme.color, fontSize: 22 }}>
              {locked ? "🔒" : theme.emoji}
            </span>
          </div>
          <div className="dp-header-info">
            <div className="dp-wallet-name">{wallet.name}</div>
            <div className="dp-wallet-id">{wallet.id}</div>
            {!locked && (
              <span className="dp-badge" style={{ color: theme.color, borderColor: theme.color, background: theme.bg }}>
                {onchainKind ? theme.label : (TYPE_THEME[wallet.type]?.label ?? "WALLET")}
                {onchainKind && ` · ${Math.round(confidence * 100)}%`}
              </span>
            )}
          </div>
          <button className="dp-close" onClick={onClose}>✕</button>
        </div>

        {/* LOCKED BODY */}
        {locked ? (
          <div className="dp-locked-body">
            <div className="dp-lock-icon">🔒</div>
            <div className="dp-lock-title">PAY TO VIEW</div>
            <div className="dp-lock-sub">Unlock this wallet&apos;s links and on-chain activity</div>
            <button className="dp-unlock-btn" onClick={onUnlock}>
              Unlock · 0.01 TON ↗
            </button>
          </div>
        ) : loading ? (
          /* LOADING STATE */
          <div className="dp-locked-body">
            <div className="dp-spinner" />
            <div className="dp-lock-title">LOADING ON-CHAIN DATA</div>
            <div className="dp-lock-sub">Fetching wallet analysis from TON…</div>
          </div>
        ) : error ? (
          /* ERROR STATE */
          <div className="dp-locked-body">
            <div className="dp-lock-icon">⚠️</div>
            <div className="dp-lock-title">ANALYSIS FAILED</div>
            <div className="dp-lock-sub">{error}</div>
            <button className="dp-unlock-btn" onClick={() => fetchProfile(wallet.id)}>
              Retry ↻
            </button>
          </div>
        ) : (
          <>
            {/* UNLOCKED BODY — REAL ON-CHAIN DATA */}
            <div className="dp-body">

              {/* left col */}
              <div className="dp-col">
                {/* Balance */}
                <div className="dp-block">
                  <div className="dp-block-label">TON BALANCE</div>
                  <div className="dp-big-number" style={{ color: "#0098EA" }}>
                    {fmtTon(balanceNano)} TON
                  </div>
                  <div className="dp-sub-text">
                    Status: <span style={{ color: status === "active" ? "#22c55e" : "#f59e0b" }}>{status}</span>
                    {profile?.state?.wallet_type && ` · ${profile.state.wallet_type}`}
                  </div>
                </div>

                {/* Transaction count */}
                <div className="dp-block">
                  <div className="dp-block-label">RECENT TRANSACTIONS</div>
                  <div className="dp-big-number">{fmtTx(txCount)}</div>
                  <div className="dp-sub-text">last 100 on-chain txns</div>
                </div>

                {/* Jetton holdings */}
                <div className="dp-block" style={{ borderBottom: nfts.length > 0 ? undefined : "none" }}>
                  <div className="dp-block-label">
                    JETTON HOLDINGS {jettons.length > 0 && `(${jettons.length})`}
                  </div>
                  {jettons.length === 0 ? (
                    <div className="dp-sub-text">No jettons found</div>
                  ) : (
                    <div className="dp-token-list">
                      {jettons.slice(0, 8).map((j, i) => {
                        const sym = j.symbol ?? "???";
                        const col = tokenColor(sym);
                        const bal = fmtJetton(j.balance, j.decimals);
                        return (
                          <div key={j.jetton_address} className="dp-token-row">
                            <div className="dp-token-rank" style={{ color: i === 0 ? "#ffd740" : "#4a6080" }}>
                              #{i + 1}
                            </div>
                            {j.image ? (
                              <img src={j.image} alt={sym} className="dp-token-img" />
                            ) : (
                              <div className="dp-token-icon" style={{ background: col + "22", color: col }}>
                                {sym[0]}
                              </div>
                            )}
                            <div className="dp-token-info">
                              <div className="dp-token-sym">{sym}</div>
                              <div className="dp-token-name">{j.name ?? shortAddr(j.jetton_address)}</div>
                            </div>
                            <div className="dp-token-balance">{bal}</div>
                          </div>
                        );
                      })}
                      {jettons.length > 8 && (
                        <div className="dp-sub-text" style={{ textAlign: "center", paddingTop: 4 }}>
                          +{jettons.length - 8} more
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* NFTs */}
                {nfts.length > 0 && (
                  <div className="dp-block" style={{ borderBottom: "none" }}>
                    <div className="dp-block-label">NFTS ({nfts.length})</div>
                    <div className="dp-nft-grid">
                      {nfts.slice(0, 6).map((n) => (
                        <div key={n.address} className="dp-nft-item" title={n.name ?? n.address}>
                          {n.image ? (
                            <img src={n.image} alt={n.name ?? ""} className="dp-nft-img" />
                          ) : (
                            <div className="dp-nft-placeholder">NFT</div>
                          )}
                          <div className="dp-nft-name">{n.name ?? shortAddr(n.address)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Classification signals */}
                {profile?.classification?.signals && profile.classification.signals.length > 0 && (
                  <div className="dp-block" style={{ borderBottom: "none" }}>
                    <div className="dp-block-label">CLASSIFICATION SIGNALS</div>
                    {profile.classification.signals.map((s, i) => (
                      <div key={i} className="dp-signal">• {s}</div>
                    ))}
                  </div>
                )}
              </div>

              <div className="dp-col-sep" />

              {/* right col — real transactions */}
              <div className="dp-col dp-col-right">
                <div className="dp-block-label" style={{ padding: "14px 16px 8px" }}>
                  ON-CHAIN ACTIVITY
                </div>
                <div className="dp-tx-list">
                  {txs.length === 0 ? (
                    <div className="dp-sub-text" style={{ padding: "16px", textAlign: "center" }}>
                      No transactions found
                    </div>
                  ) : txs.map((tx, i) => {
                    const hasInbound = tx.in_msg_value && tx.in_msg_value !== "0";
                    const isOutbound = tx.out_msg_count > 0;
                    const direction = hasInbound && !isOutbound ? "IN" : isOutbound ? "OUT" : "INTERNAL";
                    const col = direction === "IN" ? "#00e676" : direction === "OUT" ? "#ff1744" : "#00e5ff";
                    const arrow = direction === "IN" ? "↙" : direction === "OUT" ? "↗" : "↔";
                    const bg = direction === "IN" ? "rgba(0,230,118,.12)" : direction === "OUT" ? "rgba(255,23,68,.12)" : "rgba(0,229,255,.1)";
                    const value = hasInbound ? fmtNano(tx.in_msg_value!) : "—";
                    const fee = fmtNano(tx.total_fees);

                    return (
                      <div key={tx.hash} className="dp-tx-row">
                        <div className="dp-tx-arrow" style={{ background: bg, color: col }}>{arrow}</div>
                        <div className="dp-tx-detail">
                          <div className="dp-tx-action" style={{ color: col }}>{direction}</div>
                          <div className="dp-tx-token">{shortAddr(tx.hash)}</div>
                        </div>
                        <div className="dp-tx-right">
                          <div className="dp-tx-amount">
                            {value !== "—" ? `${value} TON` : `${tx.out_msg_count} msg${tx.out_msg_count > 1 ? "s" : ""}`}
                          </div>
                          <div className="dp-tx-usd">fee: {fee} TON</div>
                          <div className="dp-tx-time">{timeAgo(tx.utime)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* FOOTER */}
            <div className="dp-footer">
              <span className="dp-footer-meta">
                {txCount} txns · {jettons.length} jettons · {nfts.length} NFTs
              </span>
              <button
                className="dp-explorer-btn"
                onClick={() => {
                  const tg = (window as any).Telegram?.WebApp;
                  const url = `https://testnet.tonscan.org/address/${wallet.id}`;
                  if (tg) tg.openLink?.(url);
                  else window.open(url, "_blank");
                }}
              >
                VIEW ON EXPLORER ↗
              </button>
            </div>
          </>
        )}
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
@keyframes dp-spin {
  to { transform: rotate(360deg); }
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
  width: min(720px, calc(100vw - 20px));
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
@media (max-width: 639px) {
  .dp-card {
    bottom: 0; left: 0;
    transform: none;
    width: 100%;
    max-height: 80vh;
    border-radius: 14px 14px 0 0;
  }
}

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
.dp-wallet-id   { font-family: 'Share Tech Mono',monospace; font-size: 10px; color: #4a6080; margin-top: 2px; word-break: break-all; }
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

/* locked/loading state */
.dp-locked-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px 24px;
}
.dp-lock-icon  { font-size: 36px; opacity: .4; }
.dp-lock-title {
  font-size: 16px; font-weight: 700; letter-spacing: 3px;
  color: #4a6080; text-transform: uppercase;
}
.dp-lock-sub {
  font-family: 'Share Tech Mono', monospace;
  font-size: 11px; color: #253548; text-align: center;
}
.dp-unlock-btn {
  margin-top: 8px;
  background: #00e5ff; color: #0b0e11;
  border: none; cursor: pointer;
  font-family: 'Share Tech Mono', monospace;
  font-size: 11px; font-weight: 700; letter-spacing: 1px;
  padding: 9px 22px; border-radius: 4px;
  transition: filter .15s, transform .1s;
}
.dp-unlock-btn:hover  { filter: brightness(1.1); }
.dp-unlock-btn:active { transform: scale(.97); }

.dp-spinner {
  width: 36px; height: 36px;
  border: 3px solid #1c2d42;
  border-top-color: #00e5ff;
  border-radius: 50%;
  animation: dp-spin .8s linear infinite;
}

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
@media (max-width: 639px) {
  .dp-body { flex-direction: column; overflow-y: auto; }
  .dp-col  { overflow-y: visible; flex: none; }
  .dp-col-right { flex: none; }
  .dp-col-sep { width: 100%; height: 1px; }
  .dp-big-number { font-size: 22px; }
}

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
.dp-token-img {
  width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
  object-fit: cover;
}
.dp-token-info { flex: 1; min-width: 0; }
.dp-token-sym  { font-size: 11px; font-weight: 700; color: #c8d8ec; }
.dp-token-name { font-size: 9px; color: #4a6080; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dp-token-bar-wrap { display: flex; align-items: center; gap: 6px; }
.dp-token-bar-bg   { flex: 1; height: 4px; background: #1c2d42; border-radius: 2px; }
.dp-token-bar-fill { height: 100%; border-radius: 2px; transition: width .5s ease; }
.dp-token-pct  { font-family: 'Share Tech Mono', monospace; font-size: 9px; color: #4a6080; flex-shrink: 0; }
.dp-token-balance {
  font-family: 'Share Tech Mono', monospace;
  font-size: 10px; color: #7a9ab8; text-align: right; flex-shrink: 0;
}

/* NFT grid */
.dp-nft-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
}
.dp-nft-item {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
}
.dp-nft-img {
  width: 100%; aspect-ratio: 1; border-radius: 6px; object-fit: cover;
  border: 1px solid #1c2d42;
}
.dp-nft-placeholder {
  width: 100%; aspect-ratio: 1; border-radius: 6px;
  background: #1c2d42; display: flex; align-items: center; justify-content: center;
  font-size: 10px; color: #4a6080; font-weight: 700;
}
.dp-nft-name {
  font-size: 9px; color: #7a9ab8; text-align: center;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;
}

/* Classification signals */
.dp-signal {
  font-family: 'Share Tech Mono', monospace;
  font-size: 9px; color: #4a6080; margin-bottom: 4px; line-height: 1.4;
}

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
.dp-tx-action { font-size: 11px; font-weight: 700; letter-spacing: .5px; }
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
