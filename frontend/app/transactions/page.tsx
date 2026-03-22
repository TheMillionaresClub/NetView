"use client";

import { useState } from "react";
import { useTonConnectUI, useTonAddress, useTonWallet } from "@tonconnect/ui-react";
import TopNavBar from "../components/TopNavBar";
import SideNavBar from "../components/SideNavBar";

const PAYMENT_ADDRESS = "0QBbtZtF0cYG5xj7JvpbUhHIkMqx3PhE4FVqAXJx9k-Ljy8_";
const EXPRESS_API = "http://localhost:3001";

// ── Types matching the Rust Transaction struct ───────────────────
interface Transaction {
  address: string;
  action: "Send" | "Receive";
  amount: number; // nanoTON
  timestamp: number; // unix seconds
  fee: number; // nanoTON
}

interface PaymentInfo {
  paid: boolean;
  txHash: string | null;
  network: string | null;
  cost: string;
}

// ── Helpers ──────────────────────────────────────────────────────
function shortAddr(a: string) {
  if (a.length <= 16) return a;
  return a.slice(0, 8) + "..." + a.slice(-6);
}

function nanoToTon(n: number) {
  return (n / 1e9).toFixed(4);
}

function formatDate(unix: number) {
  return new Date(unix * 1000).toLocaleString();
}

function timeAgo(unix: number) {
  const diff = Math.floor(Date.now() / 1000) - unix;
  if (diff < 60) return diff + "s ago";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return Math.floor(diff / 86400) + "d ago";
}

// ── Page ─────────────────────────────────────────────────────────
export default function TransactionsPage() {
  const [address, setAddress] = useState("");
  const [limit, setLimit] = useState(200);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [payment, setPayment] = useState<PaymentInfo | null>(null);

  // Sorting
  const [sortCol, setSortCol] = useState<"timestamp" | "action" | "amount" | "fee">("timestamp");
  const [sortAsc, setSortAsc] = useState(false);

  // Filter
  const [filterAction, setFilterAction] = useState<"All" | "Send" | "Receive">("All");

  const [tonConnectUI] = useTonConnectUI();
  const userAddr = useTonAddress();
  const tonWallet = useTonWallet();
  const network = tonWallet?.account?.chain === "-239" ? "mainnet" : "testnet";

  const isBulk = limit > 100;
  const cost = isBulk ? "0.02 TON" : "0.01 TON";

  const fetchTransactions = async () => {
    if (!address.trim()) return;
    if (!userAddr) { setError("Connect your TON wallet first"); return; }
    setLoading(true);
    setError(null);
    setTransactions([]);
    setDurationMs(null);
    setPayment(null);

    const t0 = performance.now();

    try {
      // 1. Send payment via TonConnect
      const queryId = Date.now().toString();
      const tx = await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [{ address: PAYMENT_ADDRESS, amount: isBulk ? "20000000" : "10000000" }],
      });

      // 2. Call Express API directly with x402 payment signature
      const sig = btoa(JSON.stringify({
        scheme: "ton-v1", network, boc: tx.boc, fromAddress: userAddr, queryId,
      }));
      const params = new URLSearchParams({ address: address.trim(), limit: String(limit) });
      const url = isBulk
        ? `${EXPRESS_API}/api/wallet-transactions/bulk?${params}`
        : `${EXPRESS_API}/api/wallet-transactions?${params}`;

      const resp = await fetch(url, { headers: { "PAYMENT-SIGNATURE": sig } });
      const data = await resp.json();

      if (!resp.ok) throw new Error(data.error ?? `HTTP ${resp.status}`);

      setTransactions(data.result?.transactions ?? []);
      setPayment({ paid: true, txHash: null, network, cost });
    } catch (e: unknown) {
      setError((e as Error).message ?? "Unknown error");
    } finally {
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

  const sortIndicator = (col: typeof sortCol) =>
    sortCol === col ? (sortAsc ? " ^" : " v") : "";

  return (
    <>
      <TopNavBar />
      <SideNavBar />
      <main className="fixed left-0 sm:left-20 right-0 top-14 bottom-14 sm:bottom-0 overflow-y-auto"
            style={{ background: "#080d14" }}>
        <div className="max-w-6xl mx-auto p-6 space-y-6">

          {/* Header */}
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#c8d8ec", letterSpacing: 1, fontFamily: "'Space Grotesk', sans-serif" }}>
              TRANSACTIONS
            </h1>
            <p style={{ fontSize: 11, color: "#4a6080", marginTop: 4 }}>
              Fetch real on-chain transactions via x402 payment protocol.
              Up to 100 txns costs 0.01 TON, over 100 costs 0.02 TON.
            </p>
          </div>

          {/* Input form */}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ fontSize: 9, color: "#4a6080", letterSpacing: 2, fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>
                Wallet Address
              </div>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") fetchTransactions(); }}
                placeholder="UQ... / EQ... / 0Q..."
                style={{
                  width: "100%",
                  background: "#0f1923",
                  border: "1px solid #1c2d42",
                  borderRadius: 4,
                  padding: "8px 12px",
                  color: "#c8d8ec",
                  fontSize: 12,
                  fontFamily: "'Share Tech Mono', monospace",
                  outline: "none",
                }}
              />
            </div>
            <div style={{ width: 100 }}>
              <div style={{ fontSize: 9, color: "#4a6080", letterSpacing: 2, fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>
                Limit
              </div>
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                min={1}
                max={10000}
                style={{
                  width: "100%",
                  background: "#0f1923",
                  border: "1px solid #1c2d42",
                  borderRadius: 4,
                  padding: "8px 12px",
                  color: "#c8d8ec",
                  fontSize: 12,
                  fontFamily: "'Share Tech Mono', monospace",
                  outline: "none",
                }}
              />
            </div>
            <button
              onClick={fetchTransactions}
              disabled={loading || !address.trim() || !userAddr}
              style={{
                background: "#00e5ff",
                color: "#0b0e11",
                border: "none",
                borderRadius: 4,
                padding: "8px 20px",
                fontSize: 11,
                fontWeight: 700,
                fontFamily: "'Share Tech Mono', monospace",
                cursor: loading || !address.trim() || !userAddr ? "not-allowed" : "pointer",
                letterSpacing: 1,
                opacity: loading || !address.trim() || !userAddr ? 0.4 : 1,
                height: 38,
              }}
            >
              {loading ? "PAYING..." : !userAddr ? "CONNECT WALLET" : `FETCH - ${cost}`}
            </button>
          </div>

          {/* Cost info */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 14px",
            background: "#0b1421",
            border: "1px solid #1c2d42",
            borderRadius: 4,
            fontSize: 11,
          }}>
            <span style={{ color: "#4a6080", fontSize: 9, letterSpacing: 2, fontWeight: 700, textTransform: "uppercase" }}>
              x402 Payment
            </span>
            <span style={{ color: isBulk ? "#f59e0b" : "#22c55e", fontFamily: "'Share Tech Mono', monospace", fontWeight: 700 }}>
              {cost}
            </span>
            <span style={{ color: "#253548" }}>|</span>
            <span style={{ color: "#4a6080", fontSize: 10 }}>
              {isBulk
                ? `Bulk fetch: up to ${limit} txns (all pages fetched server-side)`
                : `Standard fetch: up to ${limit} txns`
              }
            </span>
          </div>

          {/* Payment confirmation */}
          {payment && (
            <div style={{
              padding: "10px 14px",
              background: payment.paid ? "rgba(34,197,94,0.08)" : "rgba(100,116,139,0.08)",
              border: `1px solid ${payment.paid ? "rgba(34,197,94,0.3)" : "#1c2d42"}`,
              borderRadius: 4,
              fontSize: 11,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}>
              <span style={{ color: payment.paid ? "#22c55e" : "#4a6080", fontWeight: 700, fontSize: 9, letterSpacing: 2, textTransform: "uppercase" }}>
                {payment.paid ? "PAID" : "FREE"}
              </span>
              <span style={{ color: "#c8d8ec", fontFamily: "'Share Tech Mono', monospace" }}>
                {payment.cost}
              </span>
              {payment.txHash && (
                <>
                  <span style={{ color: "#253548" }}>|</span>
                  <span style={{ color: "#4a6080", fontSize: 10 }}>
                    TX: {payment.txHash.slice(0, 16)}...
                  </span>
                  <span style={{ color: "#4a6080", fontSize: 10 }}>
                    ({payment.network})
                  </span>
                </>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", padding: "10px 16px", fontSize: 12, borderRadius: 4 }}>
              {error}
            </div>
          )}

          {/* Stats */}
          {transactions.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
              {[
                { label: "Total Txns", value: String(transactions.length), color: "#00e5ff" },
                { label: "Sent", value: `${nanoToTon(totalSent)} TON`, color: "#ef4444" },
                { label: "Received", value: `${nanoToTon(totalReceived)} TON`, color: "#22c55e" },
                {
                  label: "Net Flow",
                  value: `${nanoToTon(totalReceived - totalSent)} TON`,
                  color: totalReceived >= totalSent ? "#22c55e" : "#ef4444",
                },
                { label: "Total Fees", value: `${nanoToTon(totalFees)} TON`, color: "#4a6080" },
                {
                  label: "Duration",
                  value: durationMs !== null ? `${durationMs}ms` : loading ? "..." : "-",
                  color: "#4a6080",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    background: "#0b1421",
                    border: "1px solid #1c2d42",
                    borderRadius: 4,
                    padding: "12px 14px",
                  }}
                >
                  <div style={{ fontSize: 9, letterSpacing: 2, color: "#4a6080", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: s.color, fontFamily: "'Share Tech Mono', monospace" }}>
                    {s.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Filters */}
          {transactions.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11 }}>
              <span style={{ color: "#4a6080", fontSize: 9, letterSpacing: 2, fontWeight: 700, textTransform: "uppercase" }}>
                Filter:
              </span>
              {(["All", "Send", "Receive"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilterAction(f)}
                  style={{
                    padding: "4px 12px",
                    border: `1px solid ${filterAction === f ? "#00e5ff" : "#1c2d42"}`,
                    background: filterAction === f ? "rgba(0,229,255,0.1)" : "transparent",
                    color: filterAction === f ? "#00e5ff" : "#4a6080",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    cursor: "pointer",
                    borderRadius: 3,
                    fontFamily: "'Share Tech Mono', monospace",
                  }}
                >
                  {f}
                  {f !== "All" && (
                    <span style={{ marginLeft: 4, opacity: 0.6 }}>
                      ({transactions.filter((t) => t.action === f).length})
                    </span>
                  )}
                </button>
              ))}
              <span style={{ marginLeft: "auto", color: "#4a6080", fontSize: 10 }}>
                Showing {sorted.length} of {transactions.length}
              </span>
            </div>
          )}

          {/* Table */}
          {sorted.length > 0 && (
            <div style={{ border: "1px solid #1c2d42", borderRadius: 4, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#0b1421" }}>
                    <th style={{ ...thStyle, width: 40 }}>#</th>
                    <th style={{ ...thStyle, cursor: "pointer" }} onClick={() => handleSort("action")}>
                      Action{sortIndicator("action")}
                    </th>
                    <th style={thStyle}>Address</th>
                    <th style={{ ...thStyle, textAlign: "right", cursor: "pointer" }} onClick={() => handleSort("amount")}>
                      Amount{sortIndicator("amount")}
                    </th>
                    <th style={{ ...thStyle, textAlign: "right", cursor: "pointer" }} onClick={() => handleSort("fee")}>
                      Fee{sortIndicator("fee")}
                    </th>
                    <th style={{ ...thStyle, textAlign: "right", cursor: "pointer" }} onClick={() => handleSort("timestamp")}>
                      Time{sortIndicator("timestamp")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((tx, i) => (
                    <tr
                      key={`${tx.timestamp}-${tx.address}-${i}`}
                      style={{ borderTop: "1px solid rgba(28,45,66,0.5)" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,229,255,0.03)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      <td style={{ ...tdStyle, color: "#4a6080" }}>{i + 1}</td>
                      <td style={tdStyle}>
                        <span style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: 1,
                          textTransform: "uppercase",
                          background: tx.action === "Send" ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)",
                          color: tx.action === "Send" ? "#ef4444" : "#22c55e",
                          borderRadius: 2,
                        }}>
                          {tx.action === "Send" ? "OUT" : "IN"} {tx.action}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, fontFamily: "'Share Tech Mono', monospace", fontSize: 11 }}>
                        <span
                          style={{ cursor: "pointer" }}
                          title={tx.address}
                          onClick={() => navigator.clipboard.writeText(tx.address)}
                        >
                          {shortAddr(tx.address)}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontFamily: "'Share Tech Mono', monospace" }}>
                        {nanoToTon(tx.amount)}{" "}
                        <span style={{ color: "#4a6080", fontSize: 10 }}>TON</span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontFamily: "'Share Tech Mono', monospace", color: "#4a6080" }}>
                        {nanoToTon(tx.fee)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontSize: 10, color: "#4a6080" }}>
                        <div>{timeAgo(tx.timestamp)}</div>
                        <div style={{ fontSize: 9, opacity: 0.6 }}>{formatDate(tx.timestamp)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Empty state */}
          {!loading && transactions.length === 0 && durationMs !== null && !error && (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#4a6080", fontSize: 13 }}>
              No transactions found for this address.
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: 12 }}>
              <div style={{
                width: 24, height: 24,
                border: "3px solid #1c2d42",
                borderTopColor: "#00e5ff",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }} />
              <span style={{ fontSize: 12, color: "#4a6080" }}>
                Processing x402 payment and fetching transactions...
              </span>
              <span style={{ fontSize: 10, color: "#253548" }}>
                Payment: {cost} via x402 protocol
              </span>
            </div>
          )}

          {/* Initial state */}
          {!loading && transactions.length === 0 && durationMs === null && !error && (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div style={{ color: "#253548", fontSize: 13, marginBottom: 12 }}>
                Enter a wallet address and click FETCH to view transactions.
              </div>
              <div style={{ color: "#1c2d42", fontSize: 11 }}>
                Transactions are fetched via x402 payment protocol.
                The cost depends on the number of transactions requested.
              </div>
            </div>
          )}
        </div>

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </main>
    </>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 14px",
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: 2,
  color: "#4a6080",
  textTransform: "uppercase",
  userSelect: "none",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 14px",
  color: "#c8d8ec",
};
