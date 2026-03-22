"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  MarkerType,
  BaseEdge,
  EdgeLabelRenderer,
  getStraightPath,
  type EdgeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import TopNavBar from "../components/TopNavBar";
import SideNavBar from "../components/SideNavBar";
import { useTonConnectUI, useTonAddress, useTonWallet } from "@tonconnect/ui-react";

const PAYMENT_ADDRESS = "0QBbtZtF0cYG5xj7JvpbUhHIkMqx3PhE4FVqAXJx9k-Ljy8_";

function traceCostNano(depth: number): number {
  return Math.pow(2, depth) * 10_000_000; // 2^depth × 0.01 TON in nanotons
}
function traceCostDisplay(depth: number): string {
  return (Math.pow(2, depth) * 0.01).toFixed(2);
}

// ── Types ────────────────────────────────────────────────────────
interface PathStep {
  wallet: string;
  tx_hash: string;
  amount: number;
  lt: number;
}

interface ConnectionResult {
  found: boolean;
  path: PathStep[];
  depth: number;
  nodes_explored: number;
  elapsed_ms: number;
}

interface Progress {
  nodes_explored: number;
  current_address: string;
  queue_a: number;
  queue_b: number;
  visited_a: number;
  visited_b: number;
  elapsed_ms: number;
  depth: number;
}

interface WalletBalance {
  address: string;
  balance_nano: string;
  balance_ton: string;
}

// ── Helpers ──────────────────────────────────────────────────────
function shortAddr(a: string) {
  if (!a || a.length <= 16) return a || "—";
  return a.slice(0, 6) + "…" + a.slice(-4);
}

function nanoToTon(n: number) {
  if (!n) return "0";
  return (Math.abs(n) / 1e9).toFixed(4);
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ── Custom Node ──────────────────────────────────────────────────
function WalletNode({ data }: { data: any }) {
  const isEndpoint = data.isStart || data.isEnd;
  const borderColor = data.isStart
    ? "border-orange-400"
    : data.isEnd
      ? "border-purple-400"
      : "border-cyan-400";
  const glowColor = data.isStart
    ? "shadow-[0_0_20px_rgba(249,115,22,.4)]"
    : data.isEnd
      ? "shadow-[0_0_20px_rgba(168,85,247,.4)]"
      : "shadow-[0_0_12px_rgba(6,182,212,.2)]";
  const bgColor = data.isStart
    ? "bg-orange-900/60"
    : data.isEnd
      ? "bg-purple-900/60"
      : "bg-cyan-900/40";

  const radius = isEndpoint ? 55 : 40;

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-full border-2
        ${borderColor} ${bgColor} ${glowColor} transition-all hover:scale-105`}
      style={{ width: radius * 2, height: radius * 2 }}
    >
      <Handle type="target" position={Position.Left} className="opacity-0" />
      <Handle type="source" position={Position.Right} className="opacity-0" />
      <span className="text-[9px] font-mono text-white/90 leading-tight text-center px-1">
        {data.label}
      </span>
      {data.balance && (
        <span className="text-[8px] text-cyan-300 font-bold mt-0.5">
          {data.balance} TON
        </span>
      )}
      {isEndpoint && (
        <span
          className={`text-[7px] uppercase tracking-wider font-bold mt-0.5 ${data.isStart ? "text-orange-300" : "text-purple-300"}`}
        >
          {data.isStart ? "Start" : "End"}
        </span>
      )}
    </div>
  );
}

// ── Custom Edge ──────────────────────────────────────────────────
function TransferEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  markerEnd,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{ stroke: "#22d3ee", strokeWidth: 2, opacity: 0.7 }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
          className="bg-surface-container-high/90 border border-outline-variant/50
                     px-2 py-0.5 text-[9px] font-mono text-cyan-300 whitespace-nowrap"
        >
          {(data as any)?.label || ""}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = { wallet: WalletNode };
const edgeTypes = { transfer: TransferEdge };

// ── Page ─────────────────────────────────────────────────────────
export default function TracePage() {
  const [walletA, setWalletA] = useState("");
  const [walletB, setWalletB] = useState("");
  const [maxDepth, setMaxDepth] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConnectionResult | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [balances, setBalances] = useState<Record<string, WalletBalance>>({});
  const eventSourceRef = useRef<EventSource | null>(null);

  const [tonConnectUI] = useTonConnectUI();
  const userAddress = useTonAddress();
  const wallet = useTonWallet();
  const [paymentPending, setPaymentPending] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const fetchBalance = useCallback(async (address: string) => {
    try {
      const resp = await fetch(
        `${API}/api/wallet-info?address=${encodeURIComponent(address)}`
      );
      if (!resp.ok) return null;
      const data = await resp.json();
      return data.result as WalletBalance;
    } catch {
      return null;
    }
  }, []);

  const fetchAllBalances = useCallback(
    async (path: PathStep[]) => {
      const addresses = [...new Set(path.map((s) => s.wallet))];
      const results: Record<string, WalletBalance> = {};
      const promises = addresses.map(async (addr) => {
        const balance = await fetchBalance(addr);
        if (balance) results[addr] = balance;
      });
      await Promise.all(promises);
      setBalances(results);
    },
    [fetchBalance]
  );

  const cancelSearch = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setLoading(false);
    setProgress(null);
  }, []);

  const runSearch = useCallback((paymentSig: string) => {
    cancelSearch();
    setError(null);
    setResult(null);
    setBalances({});
    setProgress(null);
    setLoading(true);

    const params = new URLSearchParams({
      wallet_a: walletA.trim(),
      wallet_b: walletB.trim(),
      max_depth: String(maxDepth),
      payment_signature: paymentSig,
    });

    const es = new EventSource(`${API}/api/wallet-connection/stream?${params}`);
    eventSourceRef.current = es;

    es.addEventListener("progress", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as Progress;
        setProgress(data);
      } catch {}
    });

    es.addEventListener("result", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as ConnectionResult;
        setResult(data);
        if (data.found && data.path.length > 0) {
          fetchAllBalances(data.path);
        }
      } catch {}
    });

    es.addEventListener("error", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setError(data.error || "Unknown error");
      } catch {
        // SSE connection error (not a data event)
        if (eventSourceRef.current) {
          setError("Connection lost");
        }
      }
    });

    es.addEventListener("done", () => {
      es.close();
      eventSourceRef.current = null;
      setLoading(false);
      setProgress(null);
    });
  }, [walletA, walletB, maxDepth, cancelSearch, fetchAllBalances]);

  const findConnection = useCallback(async () => {
    if (!walletA.trim() || !walletB.trim()) return;
    setPaymentPending(true);
    setPaymentError(null);
    try {
      const amountNano = String(Math.floor(traceCostNano(maxDepth)));
      const tx = await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [{ address: PAYMENT_ADDRESS, amount: amountNano }],
      });
      const queryId = Date.now().toString();
      const network = wallet?.account?.chain ?? "-239";
      const payloadObj = { scheme: "ton-v1", network, boc: tx.boc, fromAddress: userAddress || "", queryId };
      const paymentSig = btoa(JSON.stringify(payloadObj));
      runSearch(paymentSig);
    } catch (err: any) {
      setPaymentError(err.message ?? "Payment failed or cancelled");
    } finally {
      setPaymentPending(false);
    }
  }, [walletA, walletB, maxDepth, tonConnectUI, wallet, userAddress, runSearch]);

  // ── Build ReactFlow graph ────────────────────────────────────
  const { nodes, edges } = useMemo(() => {
    if (!result?.found || !result.path.length)
      return { nodes: [], edges: [] };

    const spacing = 250;
    const yCenter = 200;
    const xStart = 100;

    const nodes = result.path.map((step, i) => {
      const isStart = i === 0;
      const isEnd = i === result.path.length - 1;
      const bal = balances[step.wallet];
      return {
        id: step.wallet,
        type: "wallet" as const,
        position: { x: xStart + i * spacing, y: yCenter },
        data: {
          label: shortAddr(step.wallet),
          fullAddress: step.wallet,
          balance: bal ? Number(bal.balance_ton).toFixed(2) : null,
          isStart,
          isEnd,
        },
      };
    });

    const edges = result.path.slice(0, -1).map((step, i) => {
      const next = result.path[i + 1];
      const amountLabel =
        next.amount !== 0 ? `${nanoToTon(next.amount)} TON` : "";
      return {
        id: `e-${i}`,
        source: step.wallet,
        target: next.wallet,
        type: "transfer" as const,
        animated: true,
        data: { label: amountLabel },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 16,
          height: 16,
          color: "#22d3ee",
        },
      };
    });

    return { nodes, edges };
  }, [result, balances]);

  return (
    <>
      <TopNavBar />
      <SideNavBar />
      <main className="fixed left-0 sm:left-20 right-0 top-14 bottom-16 sm:bottom-0 bg-surface text-on-surface font-body overflow-hidden flex flex-col">
        {/* ── Top panel ─────────────────────────────────────────── */}
        <div className="p-4 space-y-3 border-b border-outline-variant/30 flex-shrink-0">
          <h1 className="text-xl font-headline font-bold text-primary">
            Wallet Connection Finder
          </h1>

          {/* Input row */}
          <div className="flex flex-wrap gap-2 items-end">
            <label className="flex flex-col gap-1 flex-1 min-w-[220px]">
              <span className="text-[10px] uppercase tracking-wider text-on-surface-variant">
                Wallet A
              </span>
              <input
                className="bg-surface-container-high border border-outline-variant
                           px-2 py-1.5 text-xs text-on-surface focus:outline-none
                           focus:border-primary font-mono"
                value={walletA}
                onChange={(e) => setWalletA(e.target.value)}
                placeholder="EQ... / UQ... / 0:..."
              />
            </label>

            <button
              onClick={() => {
                setWalletA(walletB);
                setWalletB(walletA);
              }}
              className="h-[30px] w-[30px] flex items-center justify-center
                         border border-outline-variant text-on-surface-variant
                         hover:text-primary hover:border-primary transition text-xs"
              title="Swap wallets"
            >
              <span className="material-symbols-outlined text-sm">
                swap_horiz
              </span>
            </button>

            <label className="flex flex-col gap-1 flex-1 min-w-[220px]">
              <span className="text-[10px] uppercase tracking-wider text-on-surface-variant">
                Wallet B
              </span>
              <input
                className="bg-surface-container-high border border-outline-variant
                           px-2 py-1.5 text-xs text-on-surface focus:outline-none
                           focus:border-primary font-mono"
                value={walletB}
                onChange={(e) => setWalletB(e.target.value)}
                placeholder="EQ... / UQ... / 0:..."
              />
            </label>

            <label className="flex flex-col gap-1 w-20">
              <span className="text-[10px] uppercase tracking-wider text-on-surface-variant">
                Depth
              </span>
              <input
                type="number"
                className="bg-surface-container-high border border-outline-variant
                           px-2 py-1.5 text-xs text-on-surface focus:outline-none
                           focus:border-primary w-full"
                value={maxDepth}
                onChange={(e) => setMaxDepth(Number(e.target.value))}
                min={1}
                max={8}
              />
            </label>

            {!loading ? (
              <button
                onClick={findConnection}
                disabled={!walletA.trim() || !walletB.trim() || paymentPending}
                className="px-4 py-1.5 bg-primary-container text-on-primary-container
                           font-label font-semibold text-xs uppercase tracking-wider
                           hover:brightness-110 disabled:opacity-40 transition h-[30px] flex items-center gap-1.5"
              >
                {paymentPending ? (
                  <>
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeLinecap="round" />
                    </svg>
                    Paying…
                  </>
                ) : (
                  <>Find Connection — {traceCostDisplay(maxDepth)} TON</>
                )}
              </button>
            ) : (
              <button
                onClick={cancelSearch}
                className="px-4 py-1.5 bg-error text-on-error
                           font-label font-semibold text-xs uppercase tracking-wider
                           hover:brightness-110 transition h-[30px]"
              >
                Cancel
              </button>
            )}
          </div>

          {/* Live progress bar */}
          {loading && progress && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-4 text-xs">
                <span className="text-primary font-bold">
                  {progress.nodes_explored} nodes explored
                </span>
                <span className="text-on-surface-variant">
                  depth {progress.depth}
                </span>
                <span className="text-on-surface-variant">
                  queue: {progress.queue_a} + {progress.queue_b}
                </span>
                <span className="text-on-surface-variant">
                  visited: {progress.visited_a} + {progress.visited_b}
                </span>
                <span className="text-on-surface-variant">
                  {progress.elapsed_ms}ms
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-on-surface-variant font-mono">
                <svg
                  className="animate-spin h-3 w-3 text-primary flex-shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray="60"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="truncate">
                  Checking {shortAddr(progress.current_address)}
                </span>
              </div>
            </div>
          )}

          {/* Loading without progress yet */}
          {loading && !progress && (
            <div className="flex items-center gap-2 text-xs text-primary">
              <svg
                className="animate-spin h-3 w-3"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeDasharray="60"
                  strokeLinecap="round"
                />
              </svg>
              <span>Connecting…</span>
            </div>
          )}

          {/* Stats row (when done) */}
          {!loading && result && (
            <div className="flex gap-4 text-xs">
              {result.found ? (
                <>
                  <span className="text-primary font-bold">
                    {result.path.length - 1} hop
                    {result.path.length - 1 !== 1 ? "s" : ""}
                  </span>
                  <span className="text-on-surface-variant">
                    {result.nodes_explored} nodes explored
                  </span>
                  <span className="text-on-surface-variant">
                    {result.elapsed_ms}ms
                  </span>
                </>
              ) : (
                <span className="text-error">
                  No connection found ({result.nodes_explored} nodes,{" "}
                  {result.elapsed_ms}ms)
                </span>
              )}
            </div>
          )}

          {error && (
            <div className="bg-error-container text-on-error-container px-3 py-2 text-xs">
              {error}
            </div>
          )}
          {paymentError && (
            <div className="bg-error-container text-on-error-container px-3 py-2 text-xs">
              Payment failed: {paymentError}
            </div>
          )}
        </div>

        {/* ── Visualization area ────────────────────────────────── */}
        <div className="flex-1 relative">
          {/* Empty state */}
          {!loading && !result && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-on-surface-variant">
              <span className="material-symbols-outlined text-5xl opacity-20">
                share
              </span>
              <p className="text-sm">
                Enter two wallet addresses to trace their connection.
              </p>
            </div>
          )}

          {/* Not found state */}
          {!loading && result && !result.found && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl">
                link_off
              </span>
              <p className="text-sm">
                No connection found within depth {maxDepth}.
              </p>
              <p className="text-xs opacity-60">
                Try increasing the max depth or using different addresses.
              </p>
            </div>
          )}

          {/* ReactFlow graph */}
          {result?.found && nodes.length > 0 && (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              fitViewOptions={{ padding: 0.4 }}
              minZoom={0.3}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
              nodesDraggable={true}
              nodesConnectable={false}
            >
              <Background color="#1a1d21" gap={20} />
              <Controls
                showInteractive={false}
                className="!bg-surface-container-high !border-outline-variant !rounded-none [&>button]:!bg-surface-container-high [&>button]:!border-outline-variant [&>button]:!rounded-none [&>button:hover]:!bg-surface-container [&>button>svg]:!fill-on-surface-variant"
              />
            </ReactFlow>
          )}
        </div>

        {/* ── Bottom detail table ──────────────────────────────── */}
        {result?.found && result.path.length > 0 && (
          <div className="border-t border-outline-variant/30 flex-shrink-0 max-h-[30vh] overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-surface-container text-on-surface-variant text-[10px] uppercase tracking-wider">
                  <th className="text-left px-3 py-2">Hop</th>
                  <th className="text-left px-3 py-2">Wallet</th>
                  <th className="text-right px-3 py-2">Balance</th>
                  <th className="text-left px-3 py-2">Tx Hash</th>
                  <th className="text-right px-3 py-2">Transfer</th>
                </tr>
              </thead>
              <tbody>
                {result.path.map((step, i) => {
                  const bal = balances[step.wallet];
                  return (
                    <tr
                      key={`${step.wallet}-${i}`}
                      className="border-t border-outline-variant/30 hover:bg-surface-container-high/40 transition"
                    >
                      <td className="px-3 py-1.5 text-on-surface-variant">
                        {i}
                      </td>
                      <td className="px-3 py-1.5 font-mono">
                        <span
                          className="cursor-pointer hover:text-primary transition"
                          title={step.wallet}
                          onClick={() =>
                            navigator.clipboard.writeText(step.wallet)
                          }
                        >
                          {shortAddr(step.wallet)}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-cyan-300">
                        {bal
                          ? `${Number(bal.balance_ton).toFixed(4)} TON`
                          : "…"}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-on-surface-variant">
                        {step.tx_hash
                          ? step.tx_hash.slice(0, 16) + "…"
                          : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono">
                        {step.amount !== 0 ? (
                          <span className="text-secondary">
                            {nanoToTon(step.amount)} TON
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
