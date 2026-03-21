"use client";

import { useState } from "react";
import TopNavBar from "../../components/TopNavBar";
import SideNavBar from "../../components/SideNavBar";

// ── Types matching the Rust Transaction struct ───────────────────
interface Transaction {
  address: string;
  action: "Send" | "Receive";
  amount: number; // nanoTON
  timestamp: number; // unix seconds
  fee: number; // nanoTON
}

// ── Helpers ──────────────────────────────────────────────────────
function shortAddr(a: string) {
  if (a.length <= 16) return a;
  return a.slice(0, 8) + "…" + a.slice(-6);
}

function nanoToTon(n: number) {
  return (n / 1e9).toFixed(4);
}

function formatDate(unix: number) {
  return new Date(unix * 1000).toLocaleString();
}

const API = "http://localhost:3001";

// ── Page ─────────────────────────────────────────────────────────
export default function TransactionsTestPage() {
  const [address, setAddress] = useState(
    "0QD-F8oMBbR7p3SCMbGFQZOuxyNmu_-Kf9ilGmeSSC9IyFwz"
  );
  const [limit, setLimit] = useState(30);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ fetched: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [durationMs, setDurationMs] = useState<number | null>(null);

  // Sorting
  const [sortCol, setSortCol] = useState<"timestamp" | "action" | "amount" | "fee">("timestamp");
  const [sortAsc, setSortAsc] = useState(false);

  // Filter
  const [filterAction, setFilterAction] = useState<"All" | "Send" | "Receive">("All");

  const fetchTransactions = async () => {
    if (!address.trim()) return;
    setLoading(true);
    setError(null);
    setTransactions([]);
    setProgress(null);
    setDurationMs(null);

    const t0 = performance.now();

    // ── Small limit: regular single request ───────────────────────
    if (limit <= 100) {
      try {
        const params = new URLSearchParams({ address: address.trim(), limit: String(limit) });
        const resp = await fetch(`${API}/api/wallet-transactions?${params}`);
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${resp.status}`);
        }
        const data = await resp.json();
        setTransactions(data.result?.transactions ?? []);
      } catch (e: unknown) {
        setError((e as Error).message ?? "Unknown error");
      } finally {
        setDurationMs(Math.round(performance.now() - t0));
        setLoading(false);
      }
      return;
    }

    // ── Large limit: SSE stream, accumulate pages as they arrive ──
    try {
      const params = new URLSearchParams({ address: address.trim(), limit: String(limit) });
      const es = new EventSource(`${API}/api/wallet-transactions/stream?${params}`);
      let accumulated: Transaction[] = [];

      es.addEventListener("page", (e: MessageEvent) => {
        const { transactions: page, fetched, total } = JSON.parse(e.data);
        accumulated = [...accumulated, ...page];
        // keep newest-first while accumulating
        accumulated.sort((a, b) => b.timestamp - a.timestamp);
        setTransactions([...accumulated]);
        setProgress({ fetched, total });
      });

      es.addEventListener("done", () => {
        es.close();
        setDurationMs(Math.round(performance.now() - t0));
        setLoading(false);
        setProgress(null);
      });

      es.addEventListener("error", (e: MessageEvent) => {
        es.close();
        try {
          const { error: msg } = JSON.parse(e.data);
          setError(msg);
        } catch {
          setError("Stream error");
        }
        setDurationMs(Math.round(performance.now() - t0));
        setLoading(false);
        setProgress(null);
      });
    } catch (e: unknown) {
      setError((e as Error).message ?? "Unknown error");
      setDurationMs(Math.round(performance.now() - t0));
      setLoading(false);
    }
  };

  // ── Derived data ─────────────────────────────────────────────
  const filtered =
    filterAction === "All"
      ? transactions
      : transactions.filter((t) => t.action === filterAction);

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortCol === "timestamp") cmp = a.timestamp - b.timestamp;
    else if (sortCol === "amount") cmp = a.amount - b.amount;
    else if (sortCol === "fee") cmp = a.fee - b.fee;
    else cmp = a.action.localeCompare(b.action);
    return sortAsc ? cmp : -cmp;
  });

  const totalSent = transactions
    .filter((t) => t.action === "Send")
    .reduce((s, t) => s + t.amount, 0);
  const totalReceived = transactions
    .filter((t) => t.action === "Receive")
    .reduce((s, t) => s + t.amount, 0);
  const totalFees = transactions.reduce((s, t) => s + t.fee, 0);

  const handleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(false); }
  };

  const sortIcon = (col: typeof sortCol) =>
    sortCol === col ? (sortAsc ? " ▲" : " ▼") : "";

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-surface text-on-surface font-body">
      <TopNavBar />
      <div className="flex flex-1 overflow-hidden">
        <SideNavBar />
        <main className="flex-1 overflow-auto p-6 space-y-6">
          {/* Title */}
          <h1 className="text-2xl font-headline font-bold text-primary">
            Wallet Transactions (WASM)
          </h1>
          <p className="text-on-surface-variant text-sm">
            Fetches transactions via the Rust wallet-info WASM package through
            the{" "}
            <code className="text-secondary">/api/wallet-transactions</code>{" "}
            endpoint. Limits &gt; 100 use SSE streaming.
          </p>

          {/* ── Input form ──────────────────────────────────────── */}
          <div className="flex flex-wrap gap-3 items-end">
            <label className="flex flex-col gap-1 flex-1 min-w-[280px]">
              <span className="text-xs uppercase tracking-wider text-on-surface-variant">
                Wallet address
              </span>
              <input
                className="bg-surface-container-high border border-outline-variant
                           px-3 py-2 text-sm text-on-surface focus:outline-none
                           focus:border-primary"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="UQ... / EQ... / 0Q..."
              />
            </label>

            <label className="flex flex-col gap-1 w-28">
              <span className="text-xs uppercase tracking-wider text-on-surface-variant">
                Limit
              </span>
              <input
                type="number"
                className="bg-surface-container-high border border-outline-variant
                           px-3 py-2 text-sm text-on-surface focus:outline-none
                           focus:border-primary w-full"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                min={1}
                max={10000}
              />
            </label>

            <button
              onClick={fetchTransactions}
              disabled={loading || !address.trim()}
              className="px-5 py-2 bg-primary-container text-on-primary-container
                         font-label font-semibold text-sm uppercase tracking-wider
                         hover:brightness-110 disabled:opacity-40 transition h-[38px]"
            >
              {loading ? "Fetching…" : "Fetch"}
            </button>
          </div>

          {/* ── SSE progress bar ─────────────────────────────────── */}
          {loading && progress && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-on-surface-variant">
                <span>Streaming… {progress.fetched} / {progress.total}</span>
                <span>{Math.round((progress.fetched / progress.total) * 100)}%</span>
              </div>
              <div className="h-1 bg-surface-container-high w-full">
                <div
                  className="h-1 bg-primary transition-all duration-300"
                  style={{ width: `${Math.min((progress.fetched / progress.total) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* ── Error ───────────────────────────────────────────── */}
          {error && (
            <div className="bg-error-container text-on-error-container px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* ── Stats bar ───────────────────────────────────────── */}
          {transactions.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {[
                { label: "Total Txns", value: transactions.length, color: "text-primary" },
                { label: "Sent", value: `${nanoToTon(totalSent)} TON`, color: "text-error" },
                { label: "Received", value: `${nanoToTon(totalReceived)} TON`, color: "text-secondary" },
                {
                  label: "Net Flow",
                  value: `${nanoToTon(totalReceived - totalSent)} TON`,
                  color: totalReceived >= totalSent ? "text-secondary" : "text-error",
                },
                { label: "Total Fees", value: `${nanoToTon(totalFees)} TON`, color: "text-on-surface-variant" },
                {
                  label: "Duration",
                  value: durationMs !== null ? `${durationMs}ms` : loading ? "…" : "—",
                  color: "text-on-surface-variant",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="bg-surface-container-high border border-outline-variant px-4 py-3"
                >
                  <div className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">
                    {s.label}
                  </div>
                  <div className={`text-lg font-headline font-bold ${s.color}`}>
                    {s.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Filter row ──────────────────────────────────────── */}
          {transactions.length > 0 && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-on-surface-variant text-xs uppercase tracking-wider">
                Filter:
              </span>
              {(["All", "Send", "Receive"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilterAction(f)}
                  className={`px-3 py-1 border text-xs uppercase tracking-wider transition
                    ${filterAction === f
                      ? "border-primary text-primary bg-primary/10"
                      : "border-outline-variant text-on-surface-variant hover:border-primary/50"
                    }`}
                >
                  {f}
                  {f !== "All" && (
                    <span className="ml-1 opacity-60">
                      ({transactions.filter((t) => t.action === f).length})
                    </span>
                  )}
                </button>
              ))}
              <span className="ml-auto text-on-surface-variant text-xs">
                Showing {sorted.length} of {transactions.length}
              </span>
            </div>
          )}

          {/* ── Table ───────────────────────────────────────────── */}
          {sorted.length > 0 && (
            <div className="overflow-auto border border-outline-variant">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-container text-on-surface-variant text-xs uppercase tracking-wider">
                    <th className="text-left px-4 py-3">#</th>
                    <th
                      className="text-left px-4 py-3 cursor-pointer select-none hover:text-primary"
                      onClick={() => handleSort("action")}
                    >
                      Action{sortIcon("action")}
                    </th>
                    <th className="text-left px-4 py-3">Address</th>
                    <th
                      className="text-right px-4 py-3 cursor-pointer select-none hover:text-primary"
                      onClick={() => handleSort("amount")}
                    >
                      Amount{sortIcon("amount")}
                    </th>
                    <th
                      className="text-right px-4 py-3 cursor-pointer select-none hover:text-primary"
                      onClick={() => handleSort("fee")}
                    >
                      Fee{sortIcon("fee")}
                    </th>
                    <th
                      className="text-right px-4 py-3 cursor-pointer select-none hover:text-primary"
                      onClick={() => handleSort("timestamp")}
                    >
                      Time{sortIcon("timestamp")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((tx, i) => (
                    <tr
                      key={`${tx.timestamp}-${tx.address}-${i}`}
                      className="border-t border-outline-variant/40 hover:bg-surface-container-high/60 transition"
                    >
                      <td className="px-4 py-2.5 text-on-surface-variant">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider
                            ${tx.action === "Send"
                              ? "bg-error/15 text-error"
                              : "bg-secondary/15 text-secondary"
                            }`}
                        >
                          <span className="text-base leading-none">
                            {tx.action === "Send" ? "↑" : "↓"}
                          </span>
                          {tx.action}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">
                        <span
                          className="cursor-pointer hover:text-primary transition"
                          title={tx.address}
                          onClick={() => navigator.clipboard.writeText(tx.address)}
                        >
                          {shortAddr(tx.address)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        {nanoToTon(tx.amount)}{" "}
                        <span className="text-on-surface-variant text-xs">TON</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-on-surface-variant">
                        {nanoToTon(tx.fee)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-on-surface-variant">
                        {formatDate(tx.timestamp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Empty state ─────────────────────────────────────── */}
          {!loading && transactions.length === 0 && durationMs !== null && !error && (
            <div className="text-center py-16 text-on-surface-variant">
              No transactions found for this address.
            </div>
          )}

          {/* ── Loading spinner ─────────────────────────────────── */}
          {loading && !progress && (
            <div className="flex items-center justify-center py-16 gap-3 text-primary">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle
                  cx="12" cy="12" r="10"
                  stroke="currentColor" strokeWidth="3"
                  strokeDasharray="60" strokeLinecap="round"
                />
              </svg>
              <span className="text-sm">Fetching transactions via WASM…</span>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
