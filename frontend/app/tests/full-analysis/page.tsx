"use client";

import { useState } from "react";
import TopNavBar from "../../components/TopNavBar";
import SideNavBar from "../../components/SideNavBar";

// ── Minimal types for the test ────────────────────────────────────────────────

interface Transaction {
  address: string;
  action: "Send" | "Receive";
  amount: number;
  timestamp: number;
  fee: number;
}

type ActorKind = "HumanWallet" | "BotWallet" | "SmartContract" | "Exchange" | "Unknown";

interface WalletProfile {
  address: string;
  state: { balance: number; status: string; wallet_type: string | null; seqno: number | null; is_wallet: boolean } | null;
  info: { account_state: string; seqno: number | null } | null;
  jettons: { symbol: string | null; name: string | null; balance: string; decimals: number | null }[];
  nfts: { name: string | null }[];
  dns_names: { name: string }[];
  recent_transactions: Transaction[];
  interacted_wallets: Record<string, string>;
  classification: { kind: ActorKind; confidence: number; signals: string[] };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

import { API_BASE } from "../../utils/api";

const API = API_BASE;

function nanoToTon(n: string | number) {
  return (Number(n) / 1e9).toFixed(4);
}

function shortAddr(a: string) {
  return a.length > 16 ? a.slice(0, 8) + "…" + a.slice(-6) : a;
}

function formatDate(unix: number) {
  return new Date(unix * 1000).toLocaleString();
}

const KIND_COLOR: Record<ActorKind, string> = {
  HumanWallet:   "#00E676",
  BotWallet:     "#FFD600",
  SmartContract: "#00E5FF",
  Exchange:      "#7C4DFF",
  Unknown:       "#888",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FullAnalysisTestPage() {
  const [address, setAddress] = useState("0QD-F8oMBbR7p3SCMbGFQZOuxyNmu_-Kf9ilGmeSSC9IyFwz");
  const [network, setNetwork] = useState<"testnet" | "mainnet">("testnet");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WalletProfile | null>(null);
  const [raw, setRaw] = useState<string>("");
  const [durationMs, setDurationMs] = useState<number | null>(null);

  const run = async () => {
    if (!address.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setRaw("");
    setDurationMs(null);

    const t0 = performance.now();
    try {
      const params = new URLSearchParams({ address: address.trim(), network });
      const resp = await fetch(`${API}/api/wallet-analysis/full?${params}`);
      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.error ?? `HTTP ${resp.status}`);
      setResult(data.result as WalletProfile);
      setRaw(JSON.stringify(data.result, null, 2));
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
              <span className="material-symbols-outlined text-[#00E5FF] text-3xl">science</span>
              Full Analysis — Endpoint Test
            </h1>
            <p className="text-[#888] text-sm mt-1">
              Tests <code className="text-[#00E5FF] text-xs">/api/wallet-analysis/full</code> —
              returns <code className="text-[#00E5FF] text-xs">WalletProfile</code> with
              <code className="text-[#00E5FF] text-xs"> interacted_wallets</code> balances included.
            </p>
          </div>

          {/* Input */}
          <div className="rounded-2xl bg-[#181B20] border border-[#23272B] p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-4">
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-[#00E5FF] mb-1.5 block">
                  Wallet Address
                </label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#0B0E11] border border-[#23272B]
                             text-white placeholder-[#495057] focus:border-[#00E5FF] focus:outline-none text-xs font-mono"
                  placeholder="UQ… / EQ… / 0Q…"
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
              onClick={run}
              disabled={loading || !address.trim()}
              className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider
                         transition-all duration-200 disabled:opacity-40"
              style={{ background: "rgba(0,229,255,0.15)", color: "#00E5FF", border: "1px solid rgba(0,229,255,0.3)" }}
            >
              {loading ? "Running…" : "Run Full Analysis"}
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
              <span className="text-sm text-[#888]">Fetching full profile + counterparty balances…</span>
            </div>
          )}

          {result && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    label: "Classification",
                    value: result.classification.kind,
                    color: KIND_COLOR[result.classification.kind] ?? "#888",
                  },
                  {
                    label: "Confidence",
                    value: `${Math.round(result.classification.confidence * 100)}%`,
                    color: "#00E5FF",
                  },
                  {
                    label: "Balance",
                    value: result.state ? `${nanoToTon(result.state.balance)} TON` : "—",
                    color: "#00E676",
                  },
                  {
                    label: "Duration",
                    value: durationMs != null ? `${durationMs}ms` : "—",
                    color: "#495057",
                  },
                  { label: "Transactions", value: result.recent_transactions.length, color: "#aaa" },
                  { label: "Jettons", value: result.jettons.length, color: "#aaa" },
                  { label: "NFTs", value: result.nfts.length, color: "#aaa" },
                  { label: "Interacted Wallets", value: Object.keys(result.interacted_wallets).length, color: "#00E676" },
                ].map((c) => (
                  <div key={c.label} className="rounded-xl bg-[#181B20] border border-[#23272B] px-4 py-3">
                    <div className="text-[9px] font-bold uppercase tracking-widest text-[#495057] mb-1">{c.label}</div>
                    <div className="text-sm font-bold" style={{ color: c.color }}>{String(c.value)}</div>
                  </div>
                ))}
              </div>

              {/* Signals */}
              <div className="rounded-2xl bg-[#181B20] border border-[#23272B] p-5">
                <div className="text-[9px] font-black uppercase tracking-widest text-[#495057] mb-3">
                  Classification Signals
                </div>
                <ul className="space-y-1">
                  {result.classification.signals.map((s, i) => (
                    <li key={i} className="text-xs text-[#aaa] flex gap-2">
                      <span style={{ color: KIND_COLOR[result.classification.kind] }}>›</span> {s}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Interacted wallets table */}
              {Object.keys(result.interacted_wallets).length > 0 && (
                <div className="rounded-2xl bg-[#181B20] border border-[#23272B] p-5 space-y-3">
                  <div className="text-[9px] font-black uppercase tracking-widest text-[#495057]">
                    Interacted Wallets ({Object.keys(result.interacted_wallets).length})
                  </div>
                  <div className="overflow-auto rounded-xl border border-[#23272B]">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-[#0B0E11] text-[#495057] uppercase tracking-wider">
                          <th className="text-left px-4 py-2.5">#</th>
                          <th className="text-left px-4 py-2.5">Address</th>
                          <th className="text-right px-4 py-2.5 text-[#00E676]">Balance</th>
                          <th className="text-right px-4 py-2.5 text-[#FF5252]">Sent</th>
                          <th className="text-right px-4 py-2.5 text-[#00E676]">Received</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(result.interacted_wallets)
                          .map(([addr, bal]) => {
                            const txs = result.recent_transactions.filter((t) => t.address === addr);
                            const sends = txs.filter((t) => t.action === "Send").length;
                            const recvs = txs.filter((t) => t.action === "Receive").length;
                            return { addr, bal, sends, recvs, total: txs.length };
                          })
                          .sort((a, b) => b.total - a.total)
                          .map(({ addr, bal, sends, recvs }, i) => (
                            <tr key={addr} className="border-t border-[#23272B] hover:bg-[#23272B]/40 transition">
                              <td className="px-4 py-2.5 text-[#495057]">{i + 1}</td>
                              <td className="px-4 py-2.5 font-mono">
                                <span
                                  title={addr}
                                  className="cursor-pointer hover:text-[#00E5FF] transition text-[#495057]"
                                  onClick={() => navigator.clipboard.writeText(addr)}
                                >
                                  {shortAddr(addr)}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono text-[#00E676]">
                                {nanoToTon(bal)} TON
                              </td>
                              <td className="px-4 py-2.5 text-right text-[#FF5252]">
                                {sends > 0 ? `↑ ${sends}` : "—"}
                              </td>
                              <td className="px-4 py-2.5 text-right text-[#00E676]">
                                {recvs > 0 ? `↓ ${recvs}` : "—"}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Recent transactions (first 10) */}
              {result.recent_transactions.length > 0 && (
                <div className="rounded-2xl bg-[#181B20] border border-[#23272B] p-5 space-y-3">
                  <div className="text-[9px] font-black uppercase tracking-widest text-[#495057]">
                    Recent Transactions (showing first 10 of {result.recent_transactions.length})
                  </div>
                  <div className="overflow-auto rounded-xl border border-[#23272B]">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-[#0B0E11] text-[#495057] uppercase tracking-wider">
                          <th className="text-left px-4 py-2.5">Action</th>
                          <th className="text-left px-4 py-2.5">Counterparty</th>
                          <th className="text-right px-4 py-2.5 text-[#00E676]">Bal</th>
                          <th className="text-right px-4 py-2.5">Amount</th>
                          <th className="text-right px-4 py-2.5">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.recent_transactions.slice(0, 10).map((tx, i) => {
                          const bal = result.interacted_wallets[tx.address];
                          return (
                            <tr key={i} className="border-t border-[#23272B] hover:bg-[#23272B]/40 transition">
                              <td className="px-4 py-2.5">
                                <span
                                  className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                                  style={tx.action === "Send"
                                    ? { color: "#FF5252", background: "rgba(255,82,82,0.12)" }
                                    : { color: "#00E676", background: "rgba(0,230,118,0.12)" }
                                  }
                                >
                                  {tx.action === "Send" ? "↑" : "↓"} {tx.action}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 font-mono text-[#495057]">
                                <span title={tx.address} className="cursor-pointer hover:text-[#00E5FF] transition"
                                  onClick={() => navigator.clipboard.writeText(tx.address)}>
                                  {shortAddr(tx.address)}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono text-[#00E676] text-[10px]">
                                {bal ? `${nanoToTon(bal)}` : "—"}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono"
                                style={{ color: tx.action === "Send" ? "#FF5252" : "#00E676" }}>
                                {nanoToTon(tx.amount)} TON
                              </td>
                              <td className="px-4 py-2.5 text-right text-[#495057]">{formatDate(tx.timestamp)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Raw JSON toggle */}
              <details className="rounded-2xl bg-[#181B20] border border-[#23272B] overflow-hidden">
                <summary className="px-5 py-3 text-[9px] font-black uppercase tracking-widest text-[#495057] cursor-pointer hover:text-[#aaa]">
                  Raw JSON Response
                </summary>
                <pre className="px-5 pb-5 text-[10px] text-[#495057] overflow-auto max-h-[400px] font-mono whitespace-pre-wrap">
                  {raw}
                </pre>
              </details>
            </>
          )}

        </div>
      </main>
    </>
  );
}
