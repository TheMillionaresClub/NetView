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

interface Transaction {
  address: string;
  action: "Send" | "Receive";
  amount: number;   // nanoTON
  timestamp: number; // unix
  fee: number;      // nanoTON
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
  recent_transactions: Transaction[];
  interacted_wallets: Record<string, string>; // address → nanoTON string
  classification: Classification;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const API = "";

function nanoToTon(nano: string | number): string {
  return (Number(nano) / 1e9).toFixed(4);
}

function shortHash(h: string) {
  return h.length > 16 ? h.slice(0, 8) + "…" + h.slice(-6) : h;
}

function formatDate(unix: number) {
  return new Date(unix * 1000).toLocaleString();
}

const KIND_CONFIG: Record<ActorKind, { label: string; color: string; bg: string }> = {
  HumanWallet:   { label: "Human Wallet",   color: "#00E676", bg: "rgba(0,230,118,0.12)"  },
  BotWallet:     { label: "Bot Wallet",     color: "#FFD600", bg: "rgba(255,214,0,0.12)"  },
  SmartContract: { label: "Smart Contract", color: "#00E5FF", bg: "rgba(0,229,255,0.12)"  },
  Exchange:      { label: "Exchange",       color: "#7C4DFF", bg: "rgba(124,77,255,0.12)" },
  Unknown:       { label: "Unknown",        color: "#888",    bg: "rgba(136,136,136,0.1)" },
};

function ConfidenceBar({ value, color }: { value: number; color: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 rounded-full bg-[#23272B]">
        <div
          className="h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-mono w-10 text-right" style={{ color }}>
        {pct}%
      </span>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-[#181B20] border border-[#23272B] p-5 space-y-4">
      <h2 className="text-[9px] font-black uppercase tracking-widest text-[#495057]">{title}</h2>
      {children}
    </div>
  );
}

function StatCell({
  label, value, mono = false, tooltip,
}: {
  label: string; value: string | number; mono?: boolean; tooltip?: string;
}) {
  return (
    <div className="rounded-xl bg-[#0B0E11] border border-[#23272B] px-3 py-2.5" title={tooltip}>
      <div className="text-[9px] font-bold uppercase tracking-widest text-[#495057] mb-1 flex items-center gap-1">
        {label}
        {tooltip && <span className="text-[#495057] cursor-help">ⓘ</span>}
      </div>
      <div className={`text-sm text-white break-all ${mono ? "font-mono" : ""}`}>{String(value)}</div>
    </div>
  );
}

function formatJettonBalance(raw: string, decimals: number | null): string {
  const d = decimals ?? 9; // default to 9 (most TON tokens use 9 decimals)
  const n = Number(raw);
  if (isNaN(n)) return raw;
  const val = n / Math.pow(10, d);
  return val % 1 === 0 ? val.toLocaleString() : val.toFixed(Math.min(d, 4));
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

  return (
    <>
      <TopNavBar />
      <SideNavBar />
      <main className="fixed left-20 right-0 top-14 bottom-0 bg-[#0B0E11] text-[#E0E0E0] overflow-y-auto font-body">
        <div className="max-w-5xl mx-auto p-8 space-y-6">

          {/* Header */}
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-3">
              <span className="material-symbols-outlined text-[#00E5FF] text-3xl">
                account_balance_wallet
              </span>
              Wallet Analysis
            </h1>
            <p className="text-[#888] text-sm mt-1">
              Full profile via{" "}
              <code className="text-[#00E5FF] text-xs">/api/wallet-analysis</code>
              : identity, tokens, NFTs, DNS, transactions, and heuristic classification.
            </p>
          </div>

          {/* Input */}
          <div className="rounded-2xl bg-[#181B20] border border-[#23272B] p-5">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-4 mb-4">
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-[#00E5FF] mb-1.5 block">
                  Wallet Address
                </label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="UQ… / EQ… / 0Q…"
                  className="w-full px-4 py-3 rounded-xl bg-[#0B0E11] border border-[#23272B]
                             text-white placeholder-[#495057] focus:border-[#00E5FF] focus:outline-none
                             text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-[#495057] mb-1.5 block">
                  Network
                </label>
                <select
                  value={network}
                  onChange={(e) => setNetwork(e.target.value as "testnet" | "mainnet")}
                  className="w-full px-3 py-3 rounded-xl bg-[#0B0E11] border border-[#23272B]
                             text-white text-xs focus:outline-none focus:border-[#00E5FF]"
                >
                  <option value="testnet">Testnet</option>
                  <option value="mainnet">Mainnet</option>
                </select>
              </div>
            </div>
            <button
              onClick={fetchProfile}
              disabled={loading || !address.trim()}
              className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider
                         transition-all duration-200 disabled:opacity-40"
              style={{ background: "rgba(0,229,255,0.15)", color: "#00E5FF", border: "1px solid rgba(0,229,255,0.3)" }}
            >
              {loading ? "Analyzing…" : "Analyze Wallet"}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl bg-[#FF1744]/10 border border-[#FF1744]/30 px-4 py-3 text-sm text-[#FF5252]">
              {error}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-3 py-10 justify-center">
              <svg className="animate-spin h-5 w-5 text-[#00E5FF]" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
                  strokeDasharray="60" strokeLinecap="round" />
              </svg>
              <span className="text-sm text-[#888]">Fetching wallet profile…</span>
            </div>
          )}

          {profile && (() => {
            const kind = profile.classification.kind;
            const cfg = KIND_CONFIG[kind] ?? KIND_CONFIG.Unknown;

            return (
              <>
                {/* Classification */}
                <SectionCard title="Classification">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span
                      className="px-5 py-2 rounded-xl text-sm font-black uppercase tracking-wider"
                      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}33` }}
                    >
                      {cfg.label}
                    </span>
                    <div className="flex-1 min-w-[180px] space-y-1">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-[#495057]">
                        Confidence
                      </div>
                      <ConfidenceBar value={profile.classification.confidence} color={cfg.color} />
                    </div>
                    {durationMs !== null && (
                      <span className="text-xs text-[#495057] ml-auto">{durationMs}ms</span>
                    )}
                  </div>
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-[#495057] mb-2">
                      Signals
                    </div>
                    <ul className="space-y-1">
                      {profile.classification.signals.map((s, i) => (
                        <li key={i} className="text-xs text-[#aaa] flex gap-2">
                          <span style={{ color: cfg.color }}>›</span> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                </SectionCard>

                {/* Identity */}
                <SectionCard title="Identity">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    <StatCell label="Address" value={profile.address} mono />
                    <StatCell label="Status" value={profile.state?.status ?? profile.info?.account_state ?? "—"} />
                    <StatCell label="Balance" value={profile.state ? `${nanoToTon(profile.state.balance)} TON` : "—"} />
                    <StatCell label="Wallet Type" value={profile.state?.wallet_type ?? profile.info?.wallet_type ?? "—"} />
                    <StatCell
                      label="Seqno"
                      value={profile.state?.seqno ?? profile.info?.seqno ?? "—"}
                      tooltip="Sequence number — counts outbound messages sent. Increments with each transaction to prevent replay attacks. Null/0 means the wallet hasn't sent any transactions yet (uninitialized)."
                    />
                    <StatCell label="Is Wallet" value={profile.state ? (profile.state.is_wallet ? "Yes" : "No") : "—"} />
                    <StatCell label="Last Tx LT" value={profile.info?.last_transaction_lt ?? "—"} mono />
                    <StatCell label="Wallet ID" value={profile.info?.wallet_id ?? "—"} />
                  </div>
                </SectionCard>

                {/* Jettons */}
                <SectionCard title={`Jettons (${profile.jettons.length})`}>
                  {profile.jettons.length === 0 ? (
                    <p className="text-xs text-[#495057]">No tokens found.</p>
                  ) : (
                    <div className="overflow-auto rounded-xl border border-[#23272B]">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-[#0B0E11] text-[#495057] uppercase tracking-wider">
                            <th className="text-left px-4 py-2.5">Token</th>
                            <th className="text-right px-4 py-2.5">Balance</th>
                            <th className="text-left px-4 py-2.5">Jetton Address</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profile.jettons.map((j, i) => {
                            return (
                              <tr key={i} className="border-t border-[#23272B] hover:bg-[#23272B]/40 transition">
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center gap-2">
                                    {j.image && (
                                      <img src={j.image} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                                    )}
                                    <span className="font-bold text-white">{j.symbol ?? j.name ?? shortHash(j.jetton_address)}</span>
                                    {j.name && j.symbol && (
                                      <span className="text-[#495057]">({j.name})</span>
                                    )}
                                    {j.decimals == null && (
                                      <span className="text-[10px] text-[#495057]" title="Decimals unknown — defaulting to 9">(~)</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono text-[#00E5FF]">
                                  {formatJettonBalance(j.balance, j.decimals)}
                                </td>
                                <td className="px-4 py-2.5 font-mono text-[#495057]">
                                  {shortHash(j.jetton_address)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </SectionCard>

                {/* NFTs */}
                <SectionCard title={`NFTs (${profile.nfts.length})`}>
                  {profile.nfts.length === 0 ? (
                    <p className="text-xs text-[#495057]">No NFTs found.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {profile.nfts.map((nft, i) => (
                        <div key={i} className="rounded-xl bg-[#0B0E11] border border-[#23272B] p-2 space-y-1.5">
                          {nft.image ? (
                            <img
                              src={nft.image}
                              alt={nft.name ?? ""}
                              className="w-full aspect-square object-cover rounded-lg"
                            />
                          ) : (
                            <div className="w-full aspect-square rounded-lg bg-[#181B20] flex items-center
                                            justify-center text-[#495057] text-xs">
                              No image
                            </div>
                          )}
                          <div className="text-xs font-bold text-white truncate">
                            {nft.name ?? shortHash(nft.address)}
                          </div>
                          {nft.collection_name && (
                            <div className="text-[10px] text-[#495057] truncate flex items-center gap-1">
                              {nft.collection_name}
                              {nft.verified && <span className="text-[#00E676]">✓</span>}
                            </div>
                          )}
                          {nft.on_sale && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FFD600]/15 text-[#FFD600]">
                              On sale
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>

                {/* DNS */}
                {profile.dns_names.length > 0 && (
                  <SectionCard title={`DNS Names (${profile.dns_names.length})`}>
                    <div className="space-y-1">
                      {profile.dns_names.map((d, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 text-xs py-2 border-t border-[#23272B] first:border-t-0"
                        >
                          <span className="font-bold text-[#00E5FF]">{d.name}</span>
                          <span className="text-[#495057]">{d.category}</span>
                          <span className="font-mono text-[#aaa] ml-auto">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                )}

                {/* Interacted Addresses */}
                {Object.keys(profile.interacted_wallets).length > 0 && (() => {
                  const addressBalances = profile.interacted_wallets;
                  // Build per-address stats from the transactions list
                  const stats: Record<string, { sends: number; receives: number }> = {};
                  for (const tx of profile.recent_transactions) {
                    if (!stats[tx.address]) stats[tx.address] = { sends: 0, receives: 0 };
                    if (tx.action === "Send") stats[tx.address].sends++;
                    else stats[tx.address].receives++;
                  }
                  const rows = Object.entries(addressBalances).sort((a, b) => {
                    const ta = (stats[a[0]]?.sends ?? 0) + (stats[a[0]]?.receives ?? 0);
                    const tb = (stats[b[0]]?.sends ?? 0) + (stats[b[0]]?.receives ?? 0);
                    return tb - ta;
                  });

                  return (
                    <SectionCard title={`Interacted Addresses (${rows.length})`}>
                      <div className="overflow-auto rounded-xl border border-[#23272B]">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-[#0B0E11] text-[#495057] uppercase tracking-wider">
                              <th className="text-left px-4 py-2.5">Address</th>
                              <th className="text-right px-4 py-2.5 text-[#00E5FF]">Balance</th>
                              <th className="text-right px-4 py-2.5 text-[#FF5252]">Sent to</th>
                              <th className="text-right px-4 py-2.5 text-[#00E676]">Received from</th>
                              <th className="text-right px-4 py-2.5">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map(([addr, balNano]) => {
                              const s = stats[addr] ?? { sends: 0, receives: 0 };
                              return (
                                <tr key={addr} className="border-t border-[#23272B] hover:bg-[#23272B]/40 transition">
                                  <td className="px-4 py-2.5 font-mono text-[#495057]">
                                    <span
                                      title={addr}
                                      className="cursor-pointer hover:text-[#00E5FF] transition"
                                      onClick={() => navigator.clipboard.writeText(addr)}
                                    >
                                      {shortHash(addr)}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-mono text-[#00E5FF]">
                                    {nanoToTon(balNano)} TON
                                  </td>
                                  <td className="px-4 py-2.5 text-right text-[#FF5252]">
                                    {s.sends > 0 ? `↑ ${s.sends}` : "—"}
                                  </td>
                                  <td className="px-4 py-2.5 text-right text-[#00E676]">
                                    {s.receives > 0 ? `↓ ${s.receives}` : "—"}
                                  </td>
                                  <td className="px-4 py-2.5 text-right text-[#aaa]">
                                    {s.sends + s.receives}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </SectionCard>
                  );
                })()}

                {/* Recent Transactions */}
                <SectionCard title={`Recent Transactions (${profile.recent_transactions.length})`}>
                  {profile.recent_transactions.length === 0 ? (
                    <p className="text-xs text-[#495057]">No transactions found.</p>
                  ) : (
                    <div className="overflow-auto rounded-xl border border-[#23272B]">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-[#0B0E11] text-[#495057] uppercase tracking-wider">
                            <th className="text-left px-4 py-2.5">#</th>
                            <th className="text-left px-4 py-2.5">Action</th>
                            <th className="text-left px-4 py-2.5">Counterparty</th>
                            {Object.keys(profile.interacted_wallets).length > 0 && (
                              <th className="text-right px-4 py-2.5 text-[#00E676]">Balance</th>
                            )}
                            <th className="text-right px-4 py-2.5">Amount</th>
                            <th className="text-right px-4 py-2.5">Fee</th>
                            <th className="text-right px-4 py-2.5">Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profile.recent_transactions.map((tx, i) => {
                            const bal = profile.interacted_wallets[tx.address];
                            const hasBals = Object.keys(profile.interacted_wallets).length > 0;
                            return (
                              <tr
                                key={`${tx.timestamp}-${tx.address}-${i}`}
                                className="border-t border-[#23272B] hover:bg-[#23272B]/40 transition"
                              >
                                <td className="px-4 py-2.5 text-[#495057]">{i + 1}</td>
                                <td className="px-4 py-2.5">
                                  <span
                                    className="px-2 py-0.5 rounded font-bold uppercase tracking-wider"
                                    style={tx.action === "Send"
                                      ? { color: "#FF5252", background: "rgba(255,82,82,0.12)" }
                                      : { color: "#00E676", background: "rgba(0,230,118,0.12)" }
                                    }
                                  >
                                    {tx.action === "Send" ? "↑ Send" : "↓ Recv"}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 font-mono text-[#495057]">
                                  <span
                                    title={tx.address}
                                    className="cursor-pointer hover:text-[#00E5FF] transition"
                                    onClick={() => navigator.clipboard.writeText(tx.address)}
                                  >
                                    {shortHash(tx.address)}
                                  </span>
                                </td>
                                {hasBals && (
                                  <td className="px-4 py-2.5 text-right font-mono text-[#00E676]">
                                    {bal != null ? `${nanoToTon(bal)} TON` : "—"}
                                  </td>
                                )}
                                <td className="px-4 py-2.5 text-right font-mono"
                                  style={{ color: tx.action === "Send" ? "#FF5252" : "#00E676" }}>
                                  {nanoToTon(tx.amount)} TON
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono text-[#495057]">
                                  {nanoToTon(tx.fee)}
                                </td>
                                <td className="px-4 py-2.5 text-right text-[#495057]">
                                  {formatDate(tx.timestamp)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </SectionCard>
              </>
            );
          })()}

        </div>
      </main>
    </>
  );
}
