"use client";

import { useState } from "react";
import TopNavBar from "../../components/TopNavBar";
import SideNavBar from "../../components/SideNavBar";
import { API_BASE as API } from "../../utils/api";

// ── Types matching the API response ──────────────────────────────
interface Match {
  address: string;
  masterDepth: number;
  targetDepth: number;
  totalDistance: number;
}

interface GraphNode {
  address: string;
  depth: number;
  interactsWith: string[];
}

interface TraceResult {
  master: string;
  target: string;
  network: string;
  matches: Match[];
  masterGraph: Record<string, GraphNode>;
  targetGraph: Record<string, GraphNode>;
  stats: {
    depthReached: number;
    addressesExplored: number;
    apiCalls: number;
    dynamicBudgetUsed: number;
    dynamicBudgetMax: number;
    durationMs: number;
  };
}

// ── Helpers ──────────────────────────────────────────────────────
function shortAddr(a: string) {
  if (a.length <= 16) return a;
  return a.slice(0, 8) + "..." + a.slice(-6);
}

const COLORS = {
  master: "#00E5FF",
  target: "#FF6D00",
  match: "#00E676",
  node: "#7C4DFF",
  edge: "#3b494c",
};

export default function TracePage() {
  const [master, setMaster] = useState(
    "0QD-F8oMBbR7p3SCMbGFQZOuxyNmu_-Kf9ilGmeSSC9IyFwz"
  );
  const [target, setTarget] = useState(
    "kQAKOQd9PsEbmu_CS4TWCko8cHfQbxHavCGwW6lx71IcgUt1"
  );
  const [maxDepth, setMaxDepth] = useState(3);
  const [txLimit, setTxLimit] = useState(80);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TraceResult | null>(null);

  const runTrace = async () => {
    if (!master.trim() || !target.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const params = new URLSearchParams({
        master: master.trim(),
        target: target.trim(),
        maxDepth: String(maxDepth),
        txLimit: String(txLimit),
      });
      const resp = await fetch(
        `${API}/api/trace-link?${params}`
      );
      if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`API ${resp.status}: ${body}`);
      }
      const data: TraceResult = await resp.json();
      setResult(data);
    } catch (e: any) {
      setError(e.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  // Collect all unique addresses from both graphs for the visualisation
  const allNodes = new Set<string>();
  const matchAddrs = new Set(result?.matches.map((m) => m.address) ?? []);
  if (result) {
    allNodes.add(result.master);
    allNodes.add(result.target);
    for (const m of result.matches) allNodes.add(m.address);
    for (const n of Object.values(result.masterGraph))
      for (const a of n.interactsWith) allNodes.add(a);
    for (const n of Object.values(result.targetGraph))
      for (const a of n.interactsWith) allNodes.add(a);
  }

  return (
    <>
      <TopNavBar />
      <SideNavBar />
      <main className="fixed left-20 right-0 top-14 bottom-0 bg-[#0B0E11] text-[#E0E0E0] overflow-y-auto font-body">
        <div className="max-w-5xl mx-auto p-8">
          {/* ── Header ── */}
          <div className="mb-8">
            <h1 className="text-2xl font-black font-heading text-white flex items-center gap-3">
              <span className="material-symbols-outlined text-[#00E5FF] text-3xl">
                share
              </span>
              Trace Link
            </h1>
            <p className="text-[#888] text-sm mt-1">
              Bidirectional BFS to find shared interactions between two TON
              wallets.
            </p>
          </div>

          {/* ── Input Form ── */}
          <div className="rounded-2xl bg-[#181B20] border border-[#23272B] p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Master */}
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-[#00E5FF] mb-1.5 block">
                  Master Address
                </label>
                <input
                  value={master}
                  onChange={(e) => setMaster(e.target.value)}
                  placeholder="EQ... or 0Q..."
                  className="w-full px-4 py-3 rounded-xl bg-[#0B0E11] border border-[#23272B] text-white placeholder-[#495057] focus:border-[#00E5FF] focus:outline-none text-xs font-mono"
                />
              </div>
              {/* Target */}
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-[#FF6D00] mb-1.5 block">
                  Target Address
                </label>
                <input
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="EQ... or kQ..."
                  className="w-full px-4 py-3 rounded-xl bg-[#0B0E11] border border-[#23272B] text-white placeholder-[#495057] focus:border-[#FF6D00] focus:outline-none text-xs font-mono"
                />
              </div>
            </div>

            {/* Controls row */}
            <div className="flex items-end gap-4 flex-wrap">
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-[#495057] mb-1.5 block">
                  Max Depth
                </label>
                <select
                  value={maxDepth}
                  onChange={(e) => setMaxDepth(Number(e.target.value))}
                  className="px-3 py-3 rounded-xl bg-[#0B0E11] border border-[#23272B] text-white text-xs focus:outline-none focus:border-[#00E5FF]"
                >
                  {[1, 2, 3, 4, 5].map((d) => (
                    <option key={d} value={d}>
                      {d} hop{d > 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-[#495057] mb-1.5 block">
                  Tx Limit / Addr
                </label>
                <select
                  value={txLimit}
                  onChange={(e) => setTxLimit(Number(e.target.value))}
                  className="px-3 py-3 rounded-xl bg-[#0B0E11] border border-[#23272B] text-white text-xs focus:outline-none focus:border-[#00E5FF]"
                >
                  {[20, 50, 80, 100, 150, 200].map((l) => (
                    <option key={l} value={l}>
                      {l} txs
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={runTrace}
                disabled={loading || !master.trim() || !target.trim()}
                className="px-8 py-3 rounded-xl bg-[#00E5FF] text-[#0B0E11] font-bold text-sm hover:bg-[#00B8D4] disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-base">
                      progress_activity
                    </span>
                    Tracing...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">
                      search
                    </span>
                    Trace
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ── Error ── */}
          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 mb-6 text-sm">
              <span className="material-symbols-outlined text-base align-middle mr-1">
                error
              </span>
              {error}
            </div>
          )}

          {/* ── Loading skeleton ── */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-[#23272B] border-t-[#00E5FF] animate-spin" />
              </div>
              <p className="text-[#495057] text-sm">
                Expanding graph from both wallets...
              </p>
              <p className="text-[#333] text-xs">
                This may take a few seconds depending on depth & tx count.
              </p>
            </div>
          )}

          {/* ── Results ── */}
          {result && !loading && (
            <div className="space-y-6">
              {/* Stats bar */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  {
                    label: "Matches",
                    value: result.matches.length,
                    color: "#00E676",
                  },
                  {
                    label: "Depth",
                    value: result.stats.depthReached,
                    color: "#00E5FF",
                  },
                  {
                    label: "Explored",
                    value: result.stats.addressesExplored,
                    color: "#7C4DFF",
                  },
                  {
                    label: "API Calls",
                    value: result.stats.apiCalls,
                    color: "#FF6D00",
                  },
                  {
                    label: "Time",
                    value: `${(result.stats.durationMs / 1000).toFixed(1)}s`,
                    color: "#888",
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-xl bg-[#181B20] border border-[#23272B] px-4 py-3 text-center"
                  >
                    <div
                      className="text-xl font-black font-heading"
                      style={{ color: s.color }}
                    >
                      {s.value}
                    </div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-[#495057]">
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Budget bar */}
              <div className="rounded-xl bg-[#181B20] border border-[#23272B] px-4 py-3">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-[#495057] uppercase tracking-wider font-bold text-[9px]">
                    Dynamic Budget
                  </span>
                  <span className="text-[#888] font-mono">
                    {result.stats.dynamicBudgetUsed} /{" "}
                    {result.stats.dynamicBudgetMax}
                  </span>
                </div>
                <div className="w-full h-2 bg-[#23272B] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (result.stats.dynamicBudgetUsed / result.stats.dynamicBudgetMax) * 100)}%`,
                      backgroundColor:
                        result.stats.dynamicBudgetUsed /
                          result.stats.dynamicBudgetMax >
                        0.8
                          ? "#FF1744"
                          : "#00E5FF",
                    }}
                  />
                </div>
              </div>

              {/* Matches table */}
              <div className="rounded-2xl bg-[#181B20] border border-[#23272B] overflow-hidden">
                <div className="px-6 py-4 border-b border-[#23272B]">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-[#00E676] flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">
                      link
                    </span>
                    Common Interactions ({result.matches.length})
                  </h2>
                </div>
                {result.matches.length === 0 ? (
                  <div className="px-6 py-12 text-center text-[#495057]">
                    <span className="material-symbols-outlined text-4xl mb-2 block">
                      search_off
                    </span>
                    <p className="text-sm">
                      No shared interactions found at depth{" "}
                      {result.stats.depthReached}.
                    </p>
                    <p className="text-xs mt-1">
                      Try increasing Max Depth or Tx Limit.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[#495057] uppercase tracking-wider text-[9px]">
                        <th className="text-left px-6 py-3 font-bold">#</th>
                        <th className="text-left px-6 py-3 font-bold">
                          Address
                        </th>
                        <th className="text-center px-4 py-3 font-bold">
                          <span
                            className="inline-block w-2 h-2 rounded-full mr-1"
                            style={{ backgroundColor: COLORS.master }}
                          />
                          Master
                        </th>
                        <th className="text-center px-4 py-3 font-bold">
                          <span
                            className="inline-block w-2 h-2 rounded-full mr-1"
                            style={{ backgroundColor: COLORS.target }}
                          />
                          Target
                        </th>
                        <th className="text-center px-4 py-3 font-bold">
                          Distance
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.matches.map((m, i) => (
                        <tr
                          key={m.address}
                          className="border-t border-[#23272B] hover:bg-[#1a1d21] transition-colors"
                        >
                          <td className="px-6 py-3 text-[#495057]">{i + 1}</td>
                          <td className="px-6 py-3 font-mono text-[#00E676]">
                            {shortAddr(m.address)}
                            <button
                              onClick={() =>
                                navigator.clipboard.writeText(m.address)
                              }
                              className="ml-2 text-[#495057] hover:text-white transition-colors"
                              title="Copy full address"
                            >
                              <span className="material-symbols-outlined text-[14px] align-middle">
                                content_copy
                              </span>
                            </button>
                          </td>
                          <td className="text-center px-4 py-3">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00E5FF]/10 text-[#00E5FF]">
                              {m.masterDepth} hop{m.masterDepth !== 1 && "s"}
                            </span>
                          </td>
                          <td className="text-center px-4 py-3">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FF6D00]/10 text-[#FF6D00]">
                              {m.targetDepth} hop{m.targetDepth !== 1 && "s"}
                            </span>
                          </td>
                          <td className="text-center px-4 py-3">
                            <span className="font-bold text-white">
                              {m.totalDistance}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Graph Visualisation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Master side */}
                <GraphPanel
                  title="Master Graph"
                  color={COLORS.master}
                  graph={result.masterGraph}
                  originAddress={result.master}
                  matchAddrs={matchAddrs}
                />
                {/* Target side */}
                <GraphPanel
                  title="Target Graph"
                  color={COLORS.target}
                  graph={result.targetGraph}
                  originAddress={result.target}
                  matchAddrs={matchAddrs}
                />
              </div>

              {/* Raw JSON toggle */}
              <RawJsonPanel data={result} />
            </div>
          )}
        </div>
      </main>
    </>
  );
}

// ── Graph Panel Component ─────────────────────────────────────────
function GraphPanel({
  title,
  color,
  graph,
  originAddress,
  matchAddrs,
}: {
  title: string;
  color: string;
  graph: Record<string, GraphNode>;
  originAddress: string;
  matchAddrs: Set<string>;
}) {
  const nodes = Object.values(graph);
  if (nodes.length === 0) return null;

  return (
    <div className="rounded-2xl bg-[#181B20] border border-[#23272B] overflow-hidden">
      <div
        className="px-5 py-3 border-b border-[#23272B] flex items-center gap-2"
        style={{ borderLeftColor: color, borderLeftWidth: 3 }}
      >
        <span
          className="material-symbols-outlined text-base"
          style={{ color }}
        >
          account_tree
        </span>
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color }}>
          {title}
        </span>
      </div>
      <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
        {nodes.map((node) => {
          const isOrigin = node.address === originAddress;
          return (
            <div key={node.address} className="space-y-1.5">
              {/* Node header */}
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                  style={{
                    backgroundColor: isOrigin
                      ? `${color}30`
                      : matchAddrs.has(node.address)
                        ? `${COLORS.match}30`
                        : "#23272B",
                    color: isOrigin
                      ? color
                      : matchAddrs.has(node.address)
                        ? COLORS.match
                        : "#888",
                  }}
                >
                  {isOrigin ? "★" : "●"}
                </div>
                <span className="font-mono text-[11px] text-white truncate">
                  {shortAddr(node.address)}
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#23272B] text-[#495057] font-bold">
                  D{node.depth}
                </span>
                <span className="text-[9px] text-[#495057]">
                  {node.interactsWith.length} links
                </span>
              </div>
              {/* Connections */}
              <div className="ml-8 flex flex-wrap gap-1.5">
                {node.interactsWith.map((addr) => {
                  const isMatch = matchAddrs.has(addr);
                  return (
                    <span
                      key={addr}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono border"
                      style={{
                        borderColor: isMatch ? `${COLORS.match}40` : "#23272B",
                        backgroundColor: isMatch ? `${COLORS.match}10` : "#0B0E11",
                        color: isMatch ? COLORS.match : "#666",
                      }}
                    >
                      {isMatch && (
                        <span className="material-symbols-outlined text-[10px]">
                          check_circle
                        </span>
                      )}
                      {shortAddr(addr)}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Raw JSON Panel ────────────────────────────────────────────────
function RawJsonPanel({ data }: { data: TraceResult }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl bg-[#181B20] border border-[#23272B] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-6 py-3 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#495057] hover:text-white transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="material-symbols-outlined text-base">
            data_object
          </span>
          Raw JSON Response
        </span>
        <span className="material-symbols-outlined text-base">
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>
      {open && (
        <pre className="px-6 pb-4 text-[10px] text-[#888] font-mono overflow-x-auto max-h-[500px] overflow-y-auto whitespace-pre-wrap">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
