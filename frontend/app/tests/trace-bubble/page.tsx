"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import TopNavBar from "../../components/TopNavBar";
import SideNavBar from "../../components/SideNavBar";

// ── Types ────────────────────────────────────────────────────────
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

const ROLE_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  master:  { bg: "#00E5FF15", border: "#00E5FF", text: "#00E5FF", glow: "0 0 24px rgba(0,229,255,.4)" },
  target:  { bg: "#FF6D0015", border: "#FF6D00", text: "#FF6D00", glow: "0 0 24px rgba(255,109,0,.4)" },
  match:   { bg: "#00E67615", border: "#00E676", text: "#00E676", glow: "0 0 20px rgba(0,230,118,.35)" },
  master1: { bg: "#7C4DFF12", border: "#7C4DFF", text: "#B388FF", glow: "none" },
  target1: { bg: "#FF174412", border: "#FF1744", text: "#FF8A80", glow: "none" },
  both:    { bg: "#FFD60015", border: "#FFD600", text: "#FFD600", glow: "0 0 16px rgba(255,214,0,.3)" },
  unknown: { bg: "#23272B",   border: "#3b494c", text: "#888",    glow: "none" },
};

// ── Custom Bubble Node ───────────────────────────────────────────
interface BubbleData {
  label: string;
  fullAddress: string;
  role: string;
  interactions: number;
  radius: number;
  [key: string]: unknown;
}

function BubbleNode({ data }: { data: BubbleData }) {
  const c = ROLE_COLORS[data.role] ?? ROLE_COLORS.unknown;
  const d = data.radius * 2;

  return (
    <div
      className="rounded-full flex flex-col items-center justify-center border-2 cursor-pointer select-none transition-transform hover:scale-105"
      style={{
        width: d,
        height: d,
        backgroundColor: c.bg,
        borderColor: c.border,
        boxShadow: c.glow,
        backdropFilter: "blur(4px)",
      }}
    >
      <span className="font-bold text-[10px] text-center px-2 truncate w-full leading-tight" style={{ color: c.text }}>
        {data.label}
      </span>
      <span className="text-[9px] opacity-60 font-mono mt-0.5" style={{ color: c.text }}>
        {data.interactions} link{data.interactions !== 1 ? "s" : ""}
      </span>
      <Handle type="target" position={Position.Top}    style={{ opacity: 0, width: 0, height: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 0, height: 0 }} />
    </div>
  );
}

// ── Build graph from TraceResult ─────────────────────────────────
function buildFlowGraph(result: TraceResult): { nodes: Node[]; edges: Edge[] } {
  const matchSet = new Set(result.matches.map((m) => m.address));

  // Collect all unique addresses with interaction counts
  const addrInfo = new Map<string, { interactions: number; role: string }>();

  const addAddr = (addr: string, role: string, interactions: number) => {
    const existing = addrInfo.get(addr);
    if (existing) {
      existing.interactions = Math.max(existing.interactions, interactions);
      // Upgrade role priority: master/target > match > both > side-specific
      if (role === "master" || role === "target") existing.role = role;
      else if (role === "match" && existing.role !== "master" && existing.role !== "target") existing.role = "match";
      else if ((existing.role === "master1" && role === "target1") || (existing.role === "target1" && role === "master1"))
        existing.role = matchSet.has(addr) ? "match" : "both";
    } else {
      addrInfo.set(addr, { interactions, role });
    }
  };

  // First pass: count how many connections each address has across ALL graphs
  // (counts inbound references, not just outbound from expanded nodes)
  const connectionCount = new Map<string, number>();
  const bumpCount = (addr: string) => connectionCount.set(addr, (connectionCount.get(addr) ?? 0) + 1);

  for (const node of Object.values(result.masterGraph)) {
    bumpCount(node.address);
    for (const n of node.interactsWith) bumpCount(n);
  }
  for (const node of Object.values(result.targetGraph)) {
    bumpCount(node.address);
    for (const n of node.interactsWith) bumpCount(n);
  }

  // Master wallet
  const masterNode = result.masterGraph[result.master];
  addAddr(result.master, "master", masterNode?.interactsWith.length ?? connectionCount.get(result.master) ?? 0);

  // Target wallet
  const targetNode = result.targetGraph[result.target];
  addAddr(result.target, "target", targetNode?.interactsWith.length ?? connectionCount.get(result.target) ?? 0);

  // Master graph neighbours
  for (const [addr, node] of Object.entries(result.masterGraph)) {
    if (addr !== result.master) {
      addAddr(addr, matchSet.has(addr) ? "match" : "master1", node.interactsWith.length);
    }
    for (const n of node.interactsWith) {
      const role = matchSet.has(n) ? "match" : "master1";
      addAddr(n, role, connectionCount.get(n) ?? 0);
    }
  }

  // Target graph neighbours
  for (const [addr, node] of Object.entries(result.targetGraph)) {
    if (addr !== result.target) {
      addAddr(addr, matchSet.has(addr) ? "match" : "target1", node.interactsWith.length);
    }
    for (const n of node.interactsWith) {
      const role = matchSet.has(n) ? "match" : "target1";
      addAddr(n, role, connectionCount.get(n) ?? 0);
    }
  }

  // ── Layout: radial placement ──
  // Master on the left, Target on the right, matches in the middle
  const nodes: Node[] = [];
  const W = 1200;
  const H = 800;
  const cx = W / 2;
  const cy = H / 2;

  // Categorise addresses
  const masterAddrs: string[] = [];
  const targetAddrs: string[] = [];
  const matchAddrs: string[] = [];
  const bothAddrs: string[] = [];

  for (const [addr, info] of addrInfo) {
    if (addr === result.master || addr === result.target) continue;
    if (info.role === "match") matchAddrs.push(addr);
    else if (info.role === "both") bothAddrs.push(addr);
    else if (info.role === "master1") masterAddrs.push(addr);
    else if (info.role === "target1") targetAddrs.push(addr);
  }

  // Radius scaling: min 30, max 80 based on interaction count
  const maxInteractions = Math.max(1, ...Array.from(addrInfo.values()).map((v) => v.interactions));
  const getRadius = (interactions: number) => 30 + (interactions / maxInteractions) * 50;

  const addNode = (addr: string, x: number, y: number) => {
    const info = addrInfo.get(addr)!;
    const radius = getRadius(info.interactions);
    nodes.push({
      id: addr,
      type: "bubble",
      position: { x: x - radius, y: y - radius },
      data: {
        label: shortAddr(addr),
        fullAddress: addr,
        role: info.role,
        interactions: info.interactions,
        radius,
      } satisfies BubbleData,
    });
  };

  // Place master (left)
  addNode(result.master, cx - 400, cy);
  // Place target (right)
  addNode(result.target, cx + 400, cy);

  // Place matches in the centre, spread vertically
  matchAddrs.forEach((addr, i) => {
    const yOff = (i - (matchAddrs.length - 1) / 2) * 120;
    addNode(addr, cx, cy + yOff);
  });

  // Place "both" addresses near center
  bothAddrs.forEach((addr, i) => {
    const yOff = (i - (bothAddrs.length - 1) / 2) * 100;
    addNode(addr, cx, cy + 200 + yOff);
  });

  // Place master-side nodes in a fan on the left
  masterAddrs.forEach((addr, i) => {
    const angle = ((i / Math.max(1, masterAddrs.length - 1)) - 0.5) * Math.PI * 0.8;
    const r = 250;
    addNode(addr, cx - 400 + Math.cos(angle) * r, cy + Math.sin(angle) * r);
  });

  // Place target-side nodes in a fan on the right
  targetAddrs.forEach((addr, i) => {
    const angle = ((i / Math.max(1, targetAddrs.length - 1)) - 0.5) * Math.PI * 0.8;
    const r = 250;
    addNode(addr, cx + 400 + Math.cos(angle) * r, cy + Math.sin(angle) * r);
  });

  // ── Edges ──
  const edges: Edge[] = [];
  const edgeSet = new Set<string>();
  const addEdge = (from: string, to: string, animated: boolean, color: string) => {
    const key = [from, to].sort().join("→");
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    if (!addrInfo.has(from) || !addrInfo.has(to)) return;
    edges.push({
      id: key,
      source: from,
      target: to,
      animated,
      style: { stroke: color, strokeWidth: animated ? 2 : 1, opacity: animated ? 0.8 : 0.3 },
    });
  };

  // Master graph edges
  for (const [addr, node] of Object.entries(result.masterGraph)) {
    for (const n of node.interactsWith) {
      const isMatchEdge = matchSet.has(n) || matchSet.has(addr);
      addEdge(addr, n, isMatchEdge, isMatchEdge ? "#00E676" : "#00E5FF50");
    }
  }

  // Target graph edges
  for (const [addr, node] of Object.entries(result.targetGraph)) {
    for (const n of node.interactsWith) {
      const isMatchEdge = matchSet.has(n) || matchSet.has(addr);
      addEdge(addr, n, isMatchEdge, isMatchEdge ? "#00E676" : "#FF6D0050");
    }
  }

  return { nodes, edges };
}

// ── Main Page ────────────────────────────────────────────────────
export default function TraceBubblePage() {
  const [master, setMaster] = useState("0QD-F8oMBbR7p3SCMbGFQZOuxyNmu_-Kf9ilGmeSSC9IyFwz");
  const [target, setTarget] = useState("kQAKOQd9PsEbmu_CS4TWCko8cHfQbxHavCGwW6lx71IcgUt1");
  const [maxDepth, setMaxDepth] = useState(3);
  const [txLimit, setTxLimit] = useState(80);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TraceResult | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);
  const nodeTypes = useMemo(() => ({ bubble: BubbleNode }), []);

  const [selectedNode, setSelectedNode] = useState<BubbleData | null>(null);

  // Build flow graph when result changes
  useEffect(() => {
    if (!result) {
      setNodes([]);
      setEdges([]);
      return;
    }
    const { nodes: n, edges: e } = buildFlowGraph(result);
    setNodes(n);
    setEdges(e);
    setSelectedNode(null);
  }, [result, setNodes, setEdges]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node.data as BubbleData);
  }, []);

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
      const resp = await fetch(`http://localhost:3001/api/trace-link?${params}`);
      if (!resp.ok) throw new Error(`API ${resp.status}: ${await resp.text()}`);
      setResult(await resp.json());
    } catch (e: any) {
      setError(e.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <TopNavBar />
      <SideNavBar />
      <main className="fixed left-20 right-0 top-14 bottom-0 bg-[#0B0E11] text-[#E0E0E0] font-body flex flex-col">
        {/* ── Control bar ── */}
        <div className="flex-shrink-0 bg-[#111417] border-b border-[#23272B] px-5 py-3 flex items-end gap-3 flex-wrap z-10">
          {/* Master */}
          <div className="flex-1 min-w-[200px]">
            <label className="text-[8px] font-bold uppercase tracking-wider text-[#00E5FF] mb-1 block">Master</label>
            <input
              value={master}
              onChange={(e) => setMaster(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0B0E11] border border-[#23272B] text-white text-[11px] font-mono focus:border-[#00E5FF] focus:outline-none"
            />
          </div>
          {/* Target */}
          <div className="flex-1 min-w-[200px]">
            <label className="text-[8px] font-bold uppercase tracking-wider text-[#FF6D00] mb-1 block">Target</label>
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0B0E11] border border-[#23272B] text-white text-[11px] font-mono focus:border-[#FF6D00] focus:outline-none"
            />
          </div>
          {/* Depth */}
          <div>
            <label className="text-[8px] font-bold uppercase tracking-wider text-[#495057] mb-1 block">Depth</label>
            <select value={maxDepth} onChange={(e) => setMaxDepth(Number(e.target.value))}
              className="px-2 py-2 rounded-lg bg-[#0B0E11] border border-[#23272B] text-white text-[11px] focus:outline-none">
              {[1,2,3,4,5].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          {/* Tx limit */}
          <div>
            <label className="text-[8px] font-bold uppercase tracking-wider text-[#495057] mb-1 block">Tx Lim</label>
            <select value={txLimit} onChange={(e) => setTxLimit(Number(e.target.value))}
              className="px-2 py-2 rounded-lg bg-[#0B0E11] border border-[#23272B] text-white text-[11px] focus:outline-none">
              {[20,50,80,100,200].map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          {/* Trace button */}
          <button onClick={runTrace} disabled={loading || !master.trim() || !target.trim()}
            className="px-6 py-2 rounded-lg bg-[#00E5FF] text-[#0B0E11] font-bold text-xs hover:bg-[#00B8D4] disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1.5">
            {loading ? (
              <><span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>Tracing...</>
            ) : (
              <><span className="material-symbols-outlined text-sm">share</span>Trace</>
            )}
          </button>
        </div>

        {/* ── Flow canvas ── */}
        <div className="flex-1 relative">
          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0B0E11]/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-full border-4 border-[#23272B] border-t-[#00E5FF] animate-spin" />
                <p className="text-[#495057] text-sm">Expanding graph...</p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 text-xs">
              {error}
            </div>
          )}

          {/* Empty state */}
          {!result && !loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <span className="material-symbols-outlined text-[#23272B] text-6xl mb-3 block">share</span>
                <p className="text-[#333] text-sm">Enter two wallet addresses and click <strong className="text-[#00E5FF]">Trace</strong></p>
              </div>
            </div>
          )}

          {/* ReactFlow */}
          {result && (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              proOptions={{ hideAttribution: true }}
              style={{ background: "#0B0E11" }}
            >
              <Background color="#1a1d21" gap={40} size={1} />
              <Controls
                position="bottom-left"
                style={{ background: "#181B20", border: "1px solid #23272B", borderRadius: 8 }}
              />
              <MiniMap
                nodeColor={(node) => {
                  const role = (node.data as BubbleData)?.role ?? "unknown";
                  return ROLE_COLORS[role]?.border ?? "#3b494c";
                }}
                style={{ background: "#111417", border: "1px solid #23272B", borderRadius: 8 }}
                maskColor="#0B0E1180"
              />
            </ReactFlow>
          )}

          {/* Stats overlay */}
          {result && !loading && (
            <div className="absolute top-4 left-4 z-10 flex gap-2">
              {[
                { label: "Matches", value: result.matches.length, color: "#00E676" },
                { label: "Explored", value: result.stats.addressesExplored, color: "#7C4DFF" },
                { label: "Calls", value: result.stats.apiCalls, color: "#FF6D00" },
                { label: "Time", value: `${(result.stats.durationMs / 1000).toFixed(1)}s`, color: "#888" },
              ].map((s) => (
                <div key={s.label} className="rounded-lg bg-[#181B20]/90 border border-[#23272B] px-3 py-1.5 backdrop-blur-sm text-center">
                  <div className="text-sm font-black font-heading" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-[7px] font-bold uppercase tracking-wider text-[#495057]">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Legend */}
          {result && !loading && (
            <div className="absolute bottom-4 right-4 z-10 rounded-lg bg-[#181B20]/90 border border-[#23272B] px-4 py-3 backdrop-blur-sm">
              <div className="text-[8px] font-bold uppercase tracking-wider text-[#495057] mb-2">Legend</div>
              <div className="flex flex-col gap-1.5">
                {[
                  { label: "Master", color: ROLE_COLORS.master.border },
                  { label: "Target", color: ROLE_COLORS.target.border },
                  { label: "Match", color: ROLE_COLORS.match.border },
                  { label: "Master-side", color: ROLE_COLORS.master1.border },
                  { label: "Target-side", color: ROLE_COLORS.target1.border },
                ].map((l) => (
                  <div key={l.label} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: l.color, backgroundColor: l.color + "20" }} />
                    <span className="text-[10px] text-[#888]">{l.label}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 mt-1 pt-1 border-t border-[#23272B]">
                  <span className="text-[10px] text-[#495057]">Bigger bubble = more interactions</span>
                </div>
              </div>
            </div>
          )}

          {/* Selected node tooltip */}
          {selectedNode && (
            <div className="absolute top-4 right-4 z-10 rounded-xl bg-[#181B20]/95 border border-[#23272B] p-4 backdrop-blur-sm w-72">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: ROLE_COLORS[selectedNode.role]?.text ?? "#888" }}>
                  {selectedNode.role}
                </span>
                <button onClick={() => setSelectedNode(null)} className="text-[#495057] hover:text-white transition-colors">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
              <div className="font-mono text-[11px] text-white break-all mb-2">{selectedNode.fullAddress}</div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#495057]">Interactions:</span>
                <span className="text-sm font-bold" style={{ color: ROLE_COLORS[selectedNode.role]?.text ?? "#888" }}>
                  {selectedNode.interactions}
                </span>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(selectedNode.fullAddress)}
                className="mt-2 flex items-center gap-1 text-[10px] text-[#495057] hover:text-[#00E5FF] transition-colors"
              >
                <span className="material-symbols-outlined text-[12px]">content_copy</span>
                Copy address
              </button>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
