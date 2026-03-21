"use client";

import { useState } from "react";
import TopNavBar from "../../components/TopNavBar";
import SideNavBar from "../../components/SideNavBar";

// ── Types matching WalletProfile from Rust ────────────────────────────────────

interface WalletState {
  address: string;
  balance: number;
  status: string;
  wallet_type: string | null;
  seqno: number | null;
  is_wallet: boolean;
}

interface WalletInfo {
  wallet_type: string | null;
  seqno: number | null;
  wallet_id: number | null;
  last_transaction_lt: string | null;
  last_transaction_hash: string | null;
  account_state: string;
}

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
  index: unknown;
  collection_address: string | null;
  collection_name: string | null;
  name: string | null;
  image: string | null;
  on_sale: boolean;
  verified: boolean;
}

interface DnsRecord {
  name: string;
  category: string;
  value: string;
}

interface TxSummary {
  hash: string;
  lt: string;
  utime: number;
  total_fees: string;
  in_msg_value: string | null;
  out_msg_count: number;
}

type ActorKind = "HumanWallet" | "BotWallet" | "SmartContract" | "Exchange" | "Unknown";

interface Classification {
  kind: ActorKind;
  confidence: number;
  signals: string[];
}

interface WalletProfile {
  address: string;
  state: WalletState | null;
  info: WalletInfo | null;
  jettons: JettonBalance[];
  nfts: NftItem[];
  dns_names: DnsRecord[];
  recent_transactions: TxSummary[];
  classification: Classification;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const API = "http://localhost:3001";

function nanoToTon(nano: string | number): string {
  return (Number(nano) / 1e9).toFixed(4);
}

function shortHash(h: string) {
  return h.length > 16 ? h.slice(0, 8) + "…" + h.slice(-6) : h;
}

function formatDate(unix: number) {
  return new Date(unix * 1000).toLocaleString();
}

const KIND_STYLES: Record<ActorKind, { label: string; bg: string; text: string }> = {
  HumanWallet: { label: "Human Wallet", bg: "bg-secondary/15", text: "text-secondary" },
  BotWallet: { label: "Bot Wallet", bg: "bg-yellow-500/15", text: "text-yellow-400" },
  SmartContract: { label: "Smart Contract", bg: "bg-primary/15", text: "text-primary" },
  Exchange: { label: "Exchange", bg: "bg-purple-500/15", text: "text-purple-400" },
  Unknown: { label: "Unknown", bg: "bg-surface-container-high", text: "text-on-surface-variant" },
};

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "bg-secondary" : pct >= 60 ? "bg-yellow-400" : "bg-error";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface-container-high">
        <div className={`h-1.5 ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-on-surface-variant w-10 text-right">{pct}%</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WalletAnalysisPage() {
  const [address, setAddress] = useState("0QD-F8oMBbR7p3SCMbGFQZOuxyNmu_-Kf9ilGmeSSC9IyFwz");
  const [network, setNetwork] = useState<"testnet" | "mainnet">("testnet");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<WalletProfile | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);

  const fetchProfile = async () => {
    if (!address.trim()) return;
    setLoading(true);
    setError(null);
    setProfile(null);
    setDurationMs(null);

    const t0 = performance.now();
    try {
      const params = new URLSearchParams({ address: address.trim(), network });
      const resp = await fetch(`${API}/api/wallet-analysis?${params}`);
      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.error ?? `HTTP ${resp.status}`);
      setProfile(data.result as WalletProfile);
    } catch (e: unknown) {
      setError((e as Error).message ?? "Unknown error");
    } finally {
      setDurationMs(Math.round(performance.now() - t0));
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-surface text-on-surface font-body">
      <TopNavBar />
      <div className="flex flex-1 overflow-hidden">
        <SideNavBar />
        <main className="flex-1 overflow-auto p-6 space-y-6">

          {/* Title */}
          <h1 className="text-2xl font-headline font-bold text-primary">
            Wallet Analysis
          </h1>
          <p className="text-on-surface-variant text-sm">
            Full wallet profile via <code className="text-secondary">/api/wallet-analysis</code>:
            identity, balance, tokens, NFTs, DNS, last 100 transactions, and heuristic classification.
          </p>

          {/* Input */}
          <div className="flex flex-wrap gap-3 items-end">
            <label className="flex flex-col gap-1 flex-1 min-w-[280px]">
              <span className="text-xs uppercase tracking-wider text-on-surface-variant">
                Wallet address
              </span>
              <input
                className="bg-surface-container-high border border-outline-variant
                           px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="UQ… / EQ… / 0Q…"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider text-on-surface-variant">
                Network
              </span>
              <select
                className="bg-surface-container-high border border-outline-variant
                           px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
                value={network}
                onChange={(e) => setNetwork(e.target.value as "testnet" | "mainnet")}
              >
                <option value="testnet">Testnet</option>
                <option value="mainnet">Mainnet</option>
              </select>
            </label>

            <button
              onClick={fetchProfile}
              disabled={loading || !address.trim()}
              className="px-5 py-2 bg-primary-container text-on-primary-container
                         font-label font-semibold text-sm uppercase tracking-wider
                         hover:brightness-110 disabled:opacity-40 transition h-[38px]"
            >
              {loading ? "Analyzing…" : "Analyze"}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-error-container text-on-error-container px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-3 py-10 text-primary">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
                  strokeDasharray="60" strokeLinecap="round" />
              </svg>
              <span className="text-sm">Fetching wallet profile…</span>
            </div>
          )}

          {profile && (
            <>
              {/* ── Classification card ───────────────────────────────── */}
              {(() => {
                const style = KIND_STYLES[profile.classification.kind] ?? KIND_STYLES.Unknown;
                return (
                  <section className="border border-outline-variant bg-surface-container p-5 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <h2 className="text-sm font-headline font-semibold uppercase tracking-wider text-on-surface-variant">
                        Classification
                      </h2>
                      {durationMs !== null && (
                        <span className="text-xs text-on-surface-variant">{durationMs}ms</span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 flex-wrap">
                      <span className={`px-4 py-1.5 text-sm font-semibold uppercase tracking-wider ${style.bg} ${style.text}`}>
                        {style.label}
                      </span>
                      <div className="flex-1 min-w-[200px] space-y-1">
                        <div className="text-xs text-on-surface-variant uppercase tracking-wider">
                          Confidence
                        </div>
                        <ConfidenceBar value={profile.classification.confidence} />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs uppercase tracking-wider text-on-surface-variant">
                        Signals
                      </div>
                      <ul className="space-y-1">
                        {profile.classification.signals.map((s, i) => (
                          <li key={i} className="text-xs text-on-surface flex gap-2">
                            <span className="text-on-surface-variant">•</span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </section>
                );
              })()}

              {/* ── Identity grid ─────────────────────────────────────── */}
              <section className="border border-outline-variant bg-surface-container p-5 space-y-4">
                <h2 className="text-sm font-headline font-semibold uppercase tracking-wider text-on-surface-variant">
                  Identity
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {[
                    { label: "Address", value: profile.address },
                    { label: "Status", value: profile.state?.status ?? profile.info?.account_state ?? "—" },
                    { label: "Balance", value: profile.state ? `${nanoToTon(profile.state.balance)} TON` : "—" },
                    { label: "Wallet Type", value: profile.state?.wallet_type ?? profile.info?.wallet_type ?? "—" },
                    { label: "Seqno", value: profile.state?.seqno ?? profile.info?.seqno ?? "—" },
                    { label: "Is Wallet", value: profile.state ? (profile.state.is_wallet ? "Yes" : "No") : "—" },
                    { label: "Last Tx LT", value: profile.info?.last_transaction_lt ?? "—" },
                    { label: "Wallet ID", value: profile.info?.wallet_id ?? "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-surface-container-high border border-outline-variant px-3 py-2">
                      <div className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">
                        {label}
                      </div>
                      <div className="text-sm font-mono break-all text-on-surface">
                        {String(value)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* ── Jettons ───────────────────────────────────────────── */}
              <section className="border border-outline-variant bg-surface-container p-5 space-y-3">
                <h2 className="text-sm font-headline font-semibold uppercase tracking-wider text-on-surface-variant">
                  Jettons ({profile.jettons.length})
                </h2>
                {profile.jettons.length === 0 ? (
                  <p className="text-xs text-on-surface-variant">None</p>
                ) : (
                  <div className="overflow-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-surface-container-high text-on-surface-variant uppercase tracking-wider">
                          <th className="text-left px-3 py-2">Token</th>
                          <th className="text-right px-3 py-2">Balance</th>
                          <th className="text-left px-3 py-2">Jetton Address</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profile.jettons.map((j, i) => {
                          const humanBalance = j.decimals != null
                            ? (Number(j.balance) / Math.pow(10, j.decimals)).toFixed(j.decimals > 2 ? 4 : j.decimals)
                            : j.balance;
                          return (
                            <tr key={i} className="border-t border-outline-variant/40 hover:bg-surface-container-high/60">
                              <td className="px-3 py-2 flex items-center gap-2">
                                {j.image && (
                                  <img src={j.image} alt="" className="w-5 h-5 rounded-full object-cover" />
                                )}
                                <span className="font-semibold text-on-surface">
                                  {j.symbol ?? j.name ?? "?"}
                                </span>
                                {j.name && j.symbol && (
                                  <span className="text-on-surface-variant">({j.name})</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-on-surface">
                                {humanBalance}
                              </td>
                              <td className="px-3 py-2 font-mono text-on-surface-variant">
                                {shortHash(j.jetton_address)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* ── NFTs ──────────────────────────────────────────────── */}
              <section className="border border-outline-variant bg-surface-container p-5 space-y-3">
                <h2 className="text-sm font-headline font-semibold uppercase tracking-wider text-on-surface-variant">
                  NFTs ({profile.nfts.length})
                </h2>
                {profile.nfts.length === 0 ? (
                  <p className="text-xs text-on-surface-variant">None</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {profile.nfts.map((nft, i) => (
                      <div key={i} className="bg-surface-container-high border border-outline-variant p-2 space-y-1.5">
                        {nft.image ? (
                          <img src={nft.image} alt={nft.name ?? ""} className="w-full aspect-square object-cover" />
                        ) : (
                          <div className="w-full aspect-square bg-surface-container flex items-center justify-center text-on-surface-variant text-xs">
                            No image
                          </div>
                        )}
                        <div className="text-xs font-semibold text-on-surface truncate">
                          {nft.name ?? shortHash(nft.address)}
                        </div>
                        {nft.collection_name && (
                          <div className="text-[10px] text-on-surface-variant truncate">
                            {nft.collection_name}
                            {nft.verified && <span className="ml-1 text-secondary">✓</span>}
                          </div>
                        )}
                        {nft.on_sale && (
                          <span className="text-[10px] bg-yellow-500/15 text-yellow-400 px-1.5 py-0.5">
                            On sale
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* ── DNS ───────────────────────────────────────────────── */}
              {profile.dns_names.length > 0 && (
                <section className="border border-outline-variant bg-surface-container p-5 space-y-3">
                  <h2 className="text-sm font-headline font-semibold uppercase tracking-wider text-on-surface-variant">
                    DNS Names ({profile.dns_names.length})
                  </h2>
                  <div className="space-y-1">
                    {profile.dns_names.map((d, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs border-t border-outline-variant/40 py-2 first:border-t-0">
                        <span className="font-semibold text-on-surface">{d.name}</span>
                        <span className="text-on-surface-variant">{d.category}</span>
                        <span className="font-mono text-on-surface-variant ml-auto">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ── Recent Transactions ───────────────────────────────── */}
              <section className="border border-outline-variant bg-surface-container p-5 space-y-3">
                <h2 className="text-sm font-headline font-semibold uppercase tracking-wider text-on-surface-variant">
                  Recent Transactions ({profile.recent_transactions.length})
                </h2>
                {profile.recent_transactions.length === 0 ? (
                  <p className="text-xs text-on-surface-variant">None</p>
                ) : (
                  <div className="overflow-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-surface-container-high text-on-surface-variant uppercase tracking-wider">
                          <th className="text-left px-3 py-2">#</th>
                          <th className="text-left px-3 py-2">Hash</th>
                          <th className="text-right px-3 py-2">In Value</th>
                          <th className="text-right px-3 py-2">Out Msgs</th>
                          <th className="text-right px-3 py-2">Fees</th>
                          <th className="text-right px-3 py-2">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profile.recent_transactions.map((tx, i) => (
                          <tr
                            key={tx.hash}
                            className="border-t border-outline-variant/40 hover:bg-surface-container-high/60 transition"
                          >
                            <td className="px-3 py-2 text-on-surface-variant">{i + 1}</td>
                            <td className="px-3 py-2 font-mono text-on-surface-variant">
                              {shortHash(tx.hash)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-on-surface">
                              {tx.in_msg_value ? `${nanoToTon(tx.in_msg_value)} TON` : "—"}
                            </td>
                            <td className="px-3 py-2 text-right text-on-surface-variant">
                              {tx.out_msg_count}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-on-surface-variant">
                              {nanoToTon(tx.total_fees)}
                            </td>
                            <td className="px-3 py-2 text-right text-on-surface-variant">
                              {formatDate(tx.utime)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}

        </main>
      </div>
    </div>
  );
}
