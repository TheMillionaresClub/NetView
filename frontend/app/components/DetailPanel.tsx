"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useTonConnectUI } from "@tonconnect/ui-react";

/* ════════════════════════════════════════════════════════
   TYPES
════════════════════════════════════════════════════════ */

/** Counterparty flow summary passed from BubbleMap */
export interface CounterpartyFlow {
  address: string;
  sentNano: number;
  receivedNano: number;
  txCount: number;
  lastSeen: number;
}

/** Minimal wallet data passed from the graph node */
export interface WalletData {
  id: string;
  name: string;
  type: string;
  totalVolume: number;
  totalTransactions: number;
}

/* On-chain types (from /api/wallet-analysis Rust WalletProfile) */
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

interface RustTransaction {
  address: string;
  action: string;
  amount: number;
  timestamp: number;
  fee: number;
}

interface Classification {
  kind: string;
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
  recent_transactions: RustTransaction[];
  interacted_wallets: Record<string, string>;
  classification: Classification;
}

interface Props {
  wallet: WalletData | null;
  onClose: () => void;
  flow: CounterpartyFlow | null;
  centerAddress: string | null;
}

/* ════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════ */
function fmtTon(nano: number): string {
  const ton = nano / 1e9;
  if (ton >= 1e6) return (ton / 1e6).toFixed(2) + "M";
  if (ton >= 1e3) return (ton / 1e3).toFixed(1) + "K";
  if (ton < 0.001 && ton > 0) return ton.toFixed(6);
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

function timeAgo(utime: number): string {
  const diff = Math.floor(Date.now() / 1000) - utime;
  if (diff < 60) return diff + "s ago";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return Math.floor(diff / 86400) + "d ago";
}

function shortAddr(addr: string | undefined | null): string {
  if (!addr) return "\u2014";
  if (addr.length <= 12) return addr;
  return addr.slice(0, 6) + "\u2026" + addr.slice(-4);
}

const KIND_THEME: Record<string, { color: string; bg: string; label: string; emoji: string }> = {
  HumanWallet:   { color: "#06b6d4", bg: "rgba(6,182,212,.12)",   label: "HUMAN WALLET",   emoji: "\uD83D\uDC64" },
  BotWallet:     { color: "#f59e0b", bg: "rgba(245,158,11,.12)",  label: "BOT WALLET",     emoji: "\uD83E\uDD16" },
  SmartContract: { color: "#a855f7", bg: "rgba(168,85,247,.12)",  label: "SMART CONTRACT", emoji: "\uD83D\uDCDC" },
  Exchange:      { color: "#3b82f6", bg: "rgba(59,130,246,.12)",  label: "EXCHANGE",       emoji: "\uD83C\uDFDB" },
  Unknown:       { color: "#64748b", bg: "rgba(100,116,139,.12)", label: "UNKNOWN",        emoji: "\u2753" },
};

const TYPE_THEME: Record<string, { color: string; bg: string; label: string; emoji: string }> = {
  primary:  { color: "#fb923c", bg: "rgba(249,115,22,.12)",  label: "PRIMARY",  emoji: "\u25C9" },
  whale:    { color: "#a855f7", bg: "rgba(168,85,247,.12)",  label: "WHALE",    emoji: "\u25CE" },
  trader:   { color: "#3b82f6", bg: "rgba(59,130,246,.12)",  label: "TRADER",   emoji: "\u27F3" },
  degen:    { color: "#22c55e", bg: "rgba(34,197,94,.12)",   label: "DEGEN",    emoji: "\u26A1" },
  investor: { color: "#06b6d4", bg: "rgba(6,182,212,.12)",   label: "INVESTOR", emoji: "\u25C8" },
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
   COMPONENT
════════════════════════════════════════════════════════ */
export default function DetailPanel({ wallet, onClose, flow, centerAddress }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [profile, setProfile] = useState<WalletProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [tonConnectUI] = useTonConnectUI();

  /* Fetch full on-chain profile (analyze_wallet) */
  const fetchFullAnalysis = useCallback(async (address: string) => {
    setLoadingProfile(true);
    setProfileError(null);
    try {
      const res = await fetch(
        "http://localhost:3001/api/wallet-analysis?address=" + encodeURIComponent(address) + "&network=testnet"
      );
      if (!res.ok) throw new Error("API " + res.status);
      const data = await res.json();
      if (data.ok) {
        setProfile(data.result);
      } else {
        throw new Error(data.error ?? "Unknown error");
      }
    } catch (err: any) {
      setProfileError(err.message ?? "Failed to fetch");
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  /* Handle "Full Analysis" button: pay then fetch */
  const handleFullAnalysis = useCallback(async () => {
    if (!wallet) return;
    if (profile && profile.address === wallet.id) return;

    try {
      const response = await fetch("http://localhost:3001/api/premium-content");
      if (response.status === 402) {
        const invoice = await response.json();
        const transaction = {
          validUntil: Math.floor(Date.now() / 1000) + 60,
          messages: [{
            address: invoice.address || "0QBbtZtF0cYG5xj7JvpbUhHIkMqx3PhE4FVqAXJx9k-Ljy8_",
            amount: invoice.amount || "10000000",
            payload: invoice.payload,
          }],
        };
        await tonConnectUI.sendTransaction(transaction);
      }
    } catch {
      try {
        const tx = {
          validUntil: Math.floor(Date.now() / 1000) + 60,
          messages: [{ address: "0QBbtZtF0cYG5xj7JvpbUhHIkMqx3PhE4FVqAXJx9k-Ljy8_", amount: "10000000" }],
        };
        await tonConnectUI.sendTransaction(tx);
      } catch {
        return;
      }
    }

    await fetchFullAnalysis(wallet.id);
  }, [wallet, profile, tonConnectUI, fetchFullAnalysis]);

  /* Reset profile when wallet changes */
  useEffect(() => {
    setProfile(null);
    setProfileError(null);
  }, [wallet?.id]);

  /* Click outside / Escape to close */
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
  const isCenter = wallet.type === "primary";

  const balanceNano = profile?.state?.balance ?? null;
  const status = profile?.state?.status ?? profile?.info?.account_state ?? null;
  const jettons = profile?.jettons ?? [];
  const nfts = profile?.nfts ?? [];
  const confidence = profile?.classification?.confidence ?? 0;

  const txsWithCenter = profile?.recent_transactions?.filter(
    (tx) => centerAddress && tx.address.toLowerCase() === centerAddress.toLowerCase()
  ) ?? [];

  const otherCounterparties = profile ? aggregateCounterparties(profile.recent_transactions, centerAddress) : [];

  return (
    <>
      <div className="dp-backdrop" onClick={onClose} />

      <div ref={cardRef} className="dp-card">
        <div style={{ height: 3, background: theme.color, flexShrink: 0 }} />

        {/* HEADER */}
        <div className="dp-header">
          <div className="dp-avatar" style={{
            background: theme.bg,
            border: "1.5px solid " + theme.color,
          }}>
            <span style={{ color: theme.color, fontSize: 22 }}>
              {theme.emoji}
            </span>
          </div>
          <div className="dp-header-info">
            <div className="dp-wallet-name">{wallet.name}</div>
            <div className="dp-wallet-id">{wallet.id}</div>
            {onchainKind ? (
              <span className="dp-badge" style={{ color: theme.color, borderColor: theme.color, background: theme.bg }}>
                {theme.label} \u00B7 {Math.round(confidence * 100)}%
              </span>
            ) : (
              <span className="dp-badge" style={{ color: fallbackTheme.color, borderColor: fallbackTheme.color, background: fallbackTheme.bg }}>
                {fallbackTheme.label}
              </span>
            )}
          </div>
          <button className="dp-close" onClick={onClose}>\u2715</button>
        </div>

        {/* BODY */}
        <div className="dp-body">
          <div className="dp-col">

            {/* Flow with Center */}
            {flow && !isCenter && (
              <div className="dp-block">
                <div className="dp-block-label">TRANSACTION FLOW WITH YOUR WALLET</div>
                <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div className="dp-sub-text">SENT TO THIS WALLET</div>
                    <div className="dp-flow-value" style={{ color: "#ef4444" }}>
                      \u2191 {fmtTon(flow.sentNano)} TON
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="dp-sub-text">RECEIVED FROM THIS WALLET</div>
                    <div className="dp-flow-value" style={{ color: "#22c55e" }}>
                      \u2193 {fmtTon(flow.receivedNano)} TON
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div className="dp-sub-text">TRANSACTIONS</div>
                    <div className="dp-flow-value" style={{ color: "#c8d8ec" }}>
                      {flow.txCount}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="dp-sub-text">LAST SEEN</div>
                    <div className="dp-flow-value" style={{ color: "#c8d8ec" }}>
                      {timeAgo(flow.lastSeen)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Balance (from full profile) */}
            {balanceNano !== null && (
              <div className="dp-block">
                <div className="dp-block-label">TON BALANCE</div>
                <div className="dp-big-number" style={{ color: "#0098EA" }}>
                  {fmtTon(balanceNano)} TON
                </div>
                {status && (
                  <div className="dp-sub-text">
                    Status: <span style={{ color: status === "active" ? "#22c55e" : "#f59e0b" }}>{status}</span>
                    {profile?.state?.wallet_type && (" \u00B7 " + profile.state.wallet_type)}
                  </div>
                )}
              </div>
            )}

            {/* Full Analysis Button (if not yet loaded) */}
            {!profile && !loadingProfile && (
              <div className="dp-block" style={{ textAlign: "center", padding: "20px 16px" }}>
                <div className="dp-block-label" style={{ marginBottom: 12 }}>FULL ON-CHAIN ANALYSIS</div>
                <div className="dp-sub-text" style={{ marginBottom: 16 }}>
                  Get complete wallet profile: balance, jettons, NFTs, classification, and all transactions
                </div>
                <button className="dp-unlock-btn" onClick={handleFullAnalysis}>
                  Full Analysis \u00B7 0.01 TON \u2197
                </button>
              </div>
            )}

            {/* Loading state */}
            {loadingProfile && (
              <div className="dp-block" style={{ textAlign: "center", padding: "20px 16px" }}>
                <div className="dp-spinner" style={{ margin: "0 auto 12px" }} />
                <div className="dp-block-label">ANALYZING WALLET</div>
                <div className="dp-sub-text">Fetching balance, jettons, NFTs, transactions\u2026</div>
              </div>
            )}

            {/* Error state */}
            {profileError && (
              <div className="dp-block" style={{ textAlign: "center", padding: "20px 16px" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>\u26A0\uFE0F</div>
                <div className="dp-block-label">ANALYSIS FAILED</div>
                <div className="dp-sub-text" style={{ marginBottom: 12 }}>{profileError}</div>
                <button className="dp-unlock-btn" onClick={() => fetchFullAnalysis(wallet.id)}>
                  Retry \u21BB
                </button>
              </div>
            )}

            {/* Jettons */}
            {profile && jettons.length > 0 && (
              <div className="dp-block">
                <div className="dp-block-label">
                  JETTON HOLDINGS ({jettons.length})
                </div>
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
              </div>
            )}

            {/* NFTs */}
            {profile && nfts.length > 0 && (
              <div className="dp-block">
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
                  <div key={i} className="dp-signal">{"\u2022"} {s}</div>
                ))}
              </div>
            )}
          </div>

          <div className="dp-col-sep" />

          {/* RIGHT COL: Transaction Activity */}
          <div className="dp-col dp-col-right">

            {/* Transactions with center wallet */}
            {profile && txsWithCenter.length > 0 && (
              <>
                <div className="dp-block-label" style={{ padding: "14px 16px 8px" }}>
                  TRANSACTIONS WITH YOUR WALLET ({txsWithCenter.length})
                </div>
                <div className="dp-tx-list">
                  {txsWithCenter.map((tx, i) => {
                    const isSend = tx.action === "Send";
                    const col = isSend ? "#ef4444" : "#22c55e";
                    const arrow = isSend ? "\u2197" : "\u2199";
                    const bg = isSend ? "rgba(255,23,68,.12)" : "rgba(0,230,118,.12)";
                    return (
                      <div key={"center-tx-" + i} className="dp-tx-row">
                        <div className="dp-tx-arrow" style={{ background: bg, color: col }}>{arrow}</div>
                        <div className="dp-tx-detail">
                          <div className="dp-tx-action" style={{ color: col }}>
                            {isSend ? "SENT" : "RECEIVED"}
                          </div>
                          <div className="dp-tx-token">
                            {isSend ? "\u2192" : "\u2190"} Your Wallet
                          </div>
                        </div>
                        <div className="dp-tx-right">
                          <div className="dp-tx-amount">{fmtTon(tx.amount)} TON</div>
                          <div className="dp-tx-usd">fee: {fmtTon(tx.fee)} TON</div>
                          <div className="dp-tx-time">{timeAgo(tx.timestamp)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Other aggregated counterparties */}
            {profile && otherCounterparties.length > 0 && (
              <>
                <div className="dp-block-label" style={{ padding: "14px 16px 8px" }}>
                  OTHER COUNTERPARTIES ({otherCounterparties.length})
                </div>
                <div className="dp-tx-list">
                  {otherCounterparties.slice(0, 20).map((cp) => {
                    const net = cp.totalReceived - cp.totalSent;
                    const col = net > 0 ? "#22c55e" : net < 0 ? "#ef4444" : "#c8d8ec";
                    const arrow = net > 0 ? "\u2199" : net < 0 ? "\u2197" : "\u2194";
                    const bg = net > 0 ? "rgba(0,230,118,.12)" : net < 0 ? "rgba(255,23,68,.12)" : "rgba(0,229,255,.1)";
                    const balStr = profile.interacted_wallets?.[cp.address];
                    return (
                      <div key={cp.address} className="dp-tx-row">
                        <div className="dp-tx-arrow" style={{ background: bg, color: col }}>{arrow}</div>
                        <div className="dp-tx-detail">
                          <div className="dp-tx-action" style={{ color: "#c8d8ec", fontSize: 10 }}>
                            {shortAddr(cp.address)}
                          </div>
                          <div className="dp-tx-token">
                            {cp.txCount} tx{cp.txCount !== 1 ? "s" : ""}
                            {balStr ? (" \u00B7 bal: " + fmtTon(Number(balStr)) + " TON") : ""}
                          </div>
                        </div>
                        <div className="dp-tx-right">
                          <div className="dp-tx-amount" style={{ color: col }}>
                            {net > 0 ? "+" : ""}{fmtTon(net)} TON
                          </div>
                          <div className="dp-tx-usd">
                            \u2191{fmtTon(cp.totalSent)} \u2193{fmtTon(cp.totalReceived)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* If no profile yet, show the flow summary */}
            {!profile && flow && (
              <>
                <div className="dp-block-label" style={{ padding: "14px 16px 8px" }}>
                  ON-CHAIN ACTIVITY
                </div>
                <div style={{ padding: "16px", textAlign: "center" }}>
                  <div className="dp-sub-text" style={{ marginBottom: 12 }}>
                    {flow.txCount} transaction{flow.txCount !== 1 ? "s" : ""} with your wallet
                  </div>
                  <div className="dp-sub-text">
                    Use &quot;Full Analysis&quot; to see all transactions, jettons, NFTs and classification
                  </div>
                </div>
              </>
            )}

            {!profile && !flow && (
              <div style={{ padding: "24px 16px", textAlign: "center" }}>
                <div className="dp-sub-text">
                  This is your connected wallet
                </div>
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="dp-footer">
          <span className="dp-footer-meta">
            {profile
              ? (profile.recent_transactions.length + " txns \u00B7 " + jettons.length + " jettons \u00B7 " + nfts.length + " NFTs")
              : flow
                ? (flow.txCount + " txns with center")
                : "connected wallet"
            }
          </span>
          <button
            className="dp-explorer-btn"
            onClick={() => {
              const tg = (window as any).Telegram?.WebApp;
              const url = "https://testnet.tonscan.org/address/" + wallet.id;
              if (tg) tg.openLink?.(url);
              else window.open(url, "_blank");
            }}
          >
            VIEW ON EXPLORER \u2197
          </button>
        </div>
      </div>

      <style>{CSS}</style>
    </>
  );
}

/* ════════════════════════════════════════════════════════
   HELPER: Aggregate transactions by counterparty
   Each address appears once with total sent/received/txCount
════════════════════════════════════════════════════════ */
interface AggregatedCounterparty {
  address: string;
  totalSent: number;
  totalReceived: number;
  txCount: number;
}

function aggregateCounterparties(
  txs: RustTransaction[],
  excludeAddress: string | null,
): AggregatedCounterparty[] {
  const map = new Map<string, AggregatedCounterparty>();

  for (const tx of txs) {
    if (excludeAddress && tx.address.toLowerCase() === excludeAddress.toLowerCase()) continue;

    if (!map.has(tx.address)) {
      map.set(tx.address, { address: tx.address, totalSent: 0, totalReceived: 0, txCount: 0 });
    }
    const entry = map.get(tx.address)!;
    entry.txCount++;
    if (tx.action === "Send") {
      entry.totalSent += tx.amount;
    } else {
      entry.totalReceived += tx.amount;
    }
  }

  return Array.from(map.values())
    .sort((a, b) => (b.totalSent + b.totalReceived) - (a.totalSent + a.totalReceived));
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
  width: min(760px, calc(100vw - 20px));
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

.dp-flow-value {
  font-family: 'Share Tech Mono', monospace;
  font-size: 16px; font-weight: 700;
  margin-top: 4px;
}

.dp-unlock-btn {
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
.dp-token-balance {
  font-family: 'Share Tech Mono', monospace;
  font-size: 10px; color: #7a9ab8; text-align: right; flex-shrink: 0;
}

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
