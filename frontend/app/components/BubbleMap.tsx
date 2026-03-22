"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Panel,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
  BaseEdge,
  EdgeLabelRenderer,
  getStraightPath,
  useNodes,
  type EdgeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import DetailPanel, { type CounterpartyFlow, type WalletProfile } from "./DetailPanel";
import { normalizeToBounceable } from "../utils/ton";

import { useTonConnectUI, useTonAddress } from "@tonconnect/ui-react";

/* ================================================================
   TYPES
================================================================ */
export interface Counterparty {
  address: string;
  sentNano: number;
  receivedNano: number;
  txCount: number;
  lastSeen: number;
}

export interface NetworkResult {
  center: string;
  balanceNano: number | null;
  totalTxFetched: number;
  counterparties: Counterparty[];
}

export interface WalletInfo {
  id: string;
  label: string;
  volumeTON: number;
  txCount: number;
  isCenter: boolean;
}

/* ================================================================
   HELPERS
================================================================ */
const shortAddr = (addr: string) =>
  addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;

const nanoToTON = (n: number) => n / 1e9;

const calcRadius = (txCount: number) =>
  Math.min(110, Math.max(30, 20 + Math.sqrt(txCount) * 10));

function fmtVol(v: number) {
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return v.toFixed(2);
}

function classifyByTxCount(txCount: number): string {
  if (txCount >= 50) return "whale";
  if (txCount >= 20) return "trader";
  if (txCount >= 5) return "degen";
  return "investor";
}

function edgeKey(a: string, b: string) {
  return a < b ? `edge-${a}-${b}` : `edge-${b}-${a}`;
}


const THEMES: Record<string, { ring: string; glow: string; bg: string }> = {
  center:   { ring: "border-orange-400", glow: "shadow-[0_0_22px_rgba(249,115,22,.45)]",  bg: "bg-orange-900/60"  },
  whale:    { ring: "border-purple-400", glow: "shadow-[0_0_22px_rgba(168,85,247,.45)]",  bg: "bg-purple-900/60"  },
  trader:   { ring: "border-blue-400",   glow: "shadow-[0_0_22px_rgba(59,130,246,.45)]",  bg: "bg-blue-900/60"    },
  degen:    { ring: "border-green-400",  glow: "shadow-[0_0_22px_rgba(34,197,94,.45)]",   bg: "bg-green-900/60"   },
  investor: { ring: "border-cyan-400",   glow: "shadow-[0_0_22px_rgba(6,182,212,.45)]",   bg: "bg-cyan-900/60"    },
};
const theme = (t: string) => THEMES[t] ?? { ring: "border-slate-400", glow: "shadow-sm", bg: "bg-slate-800/60" };
const EMOJI: Record<string, string> = { center:"C", whale:"W", trader:"T", degen:"D", investor:"I" };

/* ================================================================
   CUSTOM NODE
================================================================ */
type NodeData = {
  label: string;
  volumeTON: number;
  radius: number;
  walletInfo: WalletInfo;
  classification: string;
  selected: boolean;
  isExpanded: boolean;
  onSelect: (w: WalletInfo) => void;
};

const PersonNode = ({ data }: { data: NodeData }) => {
  const { radius, walletInfo, classification, selected, isExpanded, onSelect } = data;
  const t = theme(classification);
  const isCenter = walletInfo.isCenter;

  return (
    <div
      onClick={() => onSelect(walletInfo)}
      className={`
        relative flex flex-col items-center justify-center
        rounded-full border-2 backdrop-blur-sm cursor-pointer
        transition-all duration-200 select-none
        text-white overflow-hidden
        ${isCenter ? "bg-blue-600/80 border-blue-300 shadow-[0_0_30px_rgba(59,130,246,0.8)] z-10" : `${t.bg} ${t.ring} ${t.glow}`}
        ${selected
          ? "scale-110 border-4 brightness-125"
          : "hover:scale-105 hover:brightness-110"}
      `}
      style={{ width: radius * 2, height: radius * 2 }}
    >
      <span className="text-[10px] opacity-50 leading-none mb-0.5">
        {EMOJI[classification] ?? "?"}
      </span>
      <span className="font-bold text-xs text-center px-2 w-full truncate leading-tight">
        {data.label}
      </span>
      {!isCenter && (
        <span className="text-[10px] opacity-75 font-mono mt-0.5 tracking-wide">
          {walletInfo.txCount} tx{walletInfo.txCount !== 1 ? "s" : ""}
        </span>
      )}

      {/* Expand indicator */}
      {!isCenter && !isExpanded && (
        <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[8px] bg-blue-500/80 text-white px-1.5 py-0.5 rounded-t font-bold tracking-wide leading-none">
          +
        </span>
      )}
      {!isCenter && isExpanded && (
        <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[8px] bg-green-500/80 text-white px-1.5 py-0.5 rounded-t font-bold tracking-wide leading-none">
          &#x2713;
        </span>
      )}

      {selected && (
        <span className="absolute inset-0 rounded-full border-2 border-white/20 animate-ping pointer-events-none" />
      )}

      <Handle
        type="target"
        position={Position.Top}
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0, width: 1, height: 1 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0, width: 1, height: 1 }}
      />
    </div>
  );
};

/* ================================================================
   CUSTOM EDGE
================================================================ */
const CircleEdge = ({
  id, source, target,
  sourceX, sourceY, targetX, targetY,
  style, markerEnd, markerStart, label,
}: EdgeProps) => {
  const nodes = useNodes();

  const sourceNode = nodes.find(n => n.id === source);
  const targetNode = nodes.find(n => n.id === target);
  const sourceRadius = ((sourceNode?.data as any)?.radius ?? 50) as number;
  const targetRadius = ((targetNode?.data as any)?.radius ?? 50) as number;

  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;

  const sx = sourceX + (dx / dist) * sourceRadius;
  const sy = sourceY + (dy / dist) * sourceRadius;
  const tx = targetX - (dx / dist) * targetRadius;
  const ty = targetY - (dy / dist) * targetRadius;

  const [edgePath, labelX, labelY] = getStraightPath({ sourceX: sx, sourceY: sy, targetX: tx, targetY: ty });

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd as string} markerStart={markerStart as string} />
      {label && (
        <EdgeLabelRenderer>
          <div style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            background: '#1a2535',
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 700,
            color: '#fff',
            pointerEvents: 'all',
            whiteSpace: 'nowrap',
          }}>
            {label as string}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

/* ================================================================
   LOCAL STORAGE PERSISTENCE
================================================================ */
const LS_KEY = "bubblemap-state-v2";
const HISTORY_KEY = "bubblemap-history";

interface HistoryEntry {
  address: string;
  label: string;
  timestamp: number;
  counterpartyCount: number;
}

function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 50))); // keep last 50
  } catch { /* quota */ }
}

type SavedState = {
  nodePositions: Record<string, { x: number; y: number }>;
  edges: any[];
  centerAddress: string;
  expandedAddresses: string[];
};

function loadSaved(): SavedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveToStorage(nodes: any[], edges: any[], centerAddress: string, expandedAddresses: string[]) {
  try {
    const nodePositions: Record<string, { x: number; y: number }> = {};
    for (const n of nodes) {
      nodePositions[n.id] = n.position;
    }
    localStorage.setItem(LS_KEY, JSON.stringify({ nodePositions, edges, centerAddress, expandedAddresses }));
  } catch { /* quota exceeded */ }
}

/* ================================================================
   FORCE-DIRECTED LAYOUT  (Coggle-style realign)
   Pure frontend — no external deps. Iterative simulation:
   1. Repulsion between every pair of nodes (scaled by radius)
   2. Spring attraction along edges
   3. Gentle gravity toward the center node
================================================================ */
function forceLayout(
  nodes: any[],
  edges: any[],
  iterations = 120,
): any[] {
  if (nodes.length < 2) return nodes;

  // Work on a mutable copy of positions
  type Vec = { x: number; y: number };
  const pos: Record<string, Vec> = {};
  const radii: Record<string, number> = {};
  const ids: string[] = [];

  for (const n of nodes) {
    pos[n.id] = { x: n.position.x, y: n.position.y };
    radii[n.id] = ((n.data as any)?.radius ?? 40) as number;
    ids.push(n.id);
  }

  // Find center node (isCenter) for gravity anchor
  const centerNode = nodes.find((n: any) => n.data?.walletInfo?.isCenter);
  const centerId = centerNode?.id ?? ids[0];

  // Build adjacency from edges
  const adj = new Set<string>();
  for (const e of edges) {
    adj.add(`${e.source}|${e.target}`);
    adj.add(`${e.target}|${e.source}`);
  }

  const REPULSION = 80_000;      // repulsion strength
  const SPRING_K_BASE = 0.006;   // base edge spring stiffness
  const SPRING_LEN_MAX = 450;    // ideal length for weakest edge
  const SPRING_LEN_MIN = 120;    // ideal length for strongest edge
  const GRAVITY = 0.002;         // pull toward center
  const DAMPING = 0.92;          // velocity damping
  const MIN_DIST = 20;           // avoid division by zero
  const MAX_FORCE = 60;          // clamp per-axis force

  // Compute max weight across all edges for normalisation
  let maxWeight = 1;
  for (const e of edges) {
    const tx = (e.data?.txCount ?? 1) as number;
    const vol = (e.data?.volumeTON ?? 0) as number;
    const w = tx + vol * 0.5;
    if (w > maxWeight) maxWeight = w;
  }
  // Build per-edge weight lookup (source|target -> { springLen, springK })
  const edgeParams: Record<string, { springLen: number; springK: number }> = {};
  for (const e of edges) {
    const tx = (e.data?.txCount ?? 1) as number;
    const vol = (e.data?.volumeTON ?? 0) as number;
    const w = tx + vol * 0.5;
    const ratio = w / maxWeight;  // 0..1 (1 = strongest relationship)
    const springLen = SPRING_LEN_MAX - ratio * (SPRING_LEN_MAX - SPRING_LEN_MIN);
    const springK = SPRING_K_BASE * (1 + ratio * 3); // stronger pull for closer wallets
    const key1 = `${e.source}|${e.target}`;
    const key2 = `${e.target}|${e.source}`;
    edgeParams[key1] = { springLen, springK };
    edgeParams[key2] = { springLen, springK };
  }

  const vel: Record<string, Vec> = {};
  for (const id of ids) vel[id] = { x: 0, y: 0 };

  for (let iter = 0; iter < iterations; iter++) {
    const temp = 1 - iter / iterations; // cooling
    const forces: Record<string, Vec> = {};
    for (const id of ids) forces[id] = { x: 0, y: 0 };

    // 1. Repulsion (every pair)
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i], b = ids[j];
        let dx = pos[a].x - pos[b].x;
        let dy = pos[a].y - pos[b].y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MIN_DIST) { dx = (Math.random() - 0.5) * 40; dy = (Math.random() - 0.5) * 40; dist = MIN_DIST; }

        // Extra repulsion when circles overlap
        const overlap = (radii[a] + radii[b] + 30) - dist;
        const overlapMult = overlap > 0 ? 1 + overlap * 0.05 : 1;

        const f = (REPULSION * overlapMult) / (dist * dist);
        const fx = (dx / dist) * f;
        const fy = (dy / dist) * f;
        forces[a].x += fx; forces[a].y += fy;
        forces[b].x -= fx; forces[b].y -= fy;
      }
    }

    // 2. Edge springs (weighted: closer relationship → shorter spring)
    for (const e of edges) {
      const a = e.source as string;
      const b = e.target as string;
      if (!pos[a] || !pos[b]) continue;
      const dx = pos[b].x - pos[a].x;
      const dy = pos[b].y - pos[a].y;
      const dist = Math.sqrt(dx * dx + dy * dy) || MIN_DIST;
      const params = edgeParams[`${a}|${b}`] ?? { springLen: SPRING_LEN_MAX, springK: SPRING_K_BASE };
      const displacement = dist - params.springLen;
      const f = params.springK * displacement;
      const fx = (dx / dist) * f;
      const fy = (dy / dist) * f;
      forces[a].x += fx; forces[a].y += fy;
      forces[b].x -= fx; forces[b].y -= fy;
    }

    // 3. Gravity toward center node
    const cx = pos[centerId]?.x ?? 0;
    const cy = pos[centerId]?.y ?? 0;
    for (const id of ids) {
      if (id === centerId) continue;
      forces[id].x -= (pos[id].x - cx) * GRAVITY;
      forces[id].y -= (pos[id].y - cy) * GRAVITY;
    }

    // 4. Apply forces with damping & cooling
    for (const id of ids) {
      if (id === centerId) continue; // pin center
      const fx = Math.max(-MAX_FORCE, Math.min(MAX_FORCE, forces[id].x)) * temp;
      const fy = Math.max(-MAX_FORCE, Math.min(MAX_FORCE, forces[id].y)) * temp;
      vel[id].x = (vel[id].x + fx) * DAMPING;
      vel[id].y = (vel[id].y + fy) * DAMPING;
      pos[id].x += vel[id].x;
      pos[id].y += vel[id].y;
    }
  }

  // Return nodes with updated positions
  return nodes.map((n: any) => ({
    ...n,
    position: { x: Math.round(pos[n.id].x), y: Math.round(pos[n.id].y) },
  }));
}

/* ================================================================
   BUBBLE MAP
================================================================ */
export default function BubbleMap({
  searchTerm,
  setSearchTerm,
  manualAddress,
  setManualAddress,
}: {
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  manualAddress: string;
  setManualAddress: (val: string) => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [nodes, setNodes, onNodesChange] = useNodesState([] as any[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
  const [selected, setSelected]          = useState<WalletInfo | null>(null);
  const [loading, setLoading]            = useState(false);
  const [error, setError]                = useState<string | null>(null);

  const [expandedAddresses, setExpandedAddresses] = useState<string[]>([]);
  const [knownWallets, setKnownWallets] = useState<WalletInfo[]>([]);
  const [counterpartyMap, setCounterpartyMap] = useState<Map<string, Counterparty>>(new Map());
  /** Balance data from interacted_wallets (address -> nano balance) */
  const [walletBalances, setWalletBalances] = useState<Map<string, number>>(new Map());
  /** Track the current center address */
  const [centerAddr, setCenterAddr] = useState<string>("");
  /** Cache of fetched WalletProfile results so re-opening a node doesn't lose data */
  const [profileCache, setProfileCache] = useState<Map<string, WalletProfile>>(new Map());

  const handleProfileFetched = useCallback((address: string, profile: WalletProfile) => {
    setProfileCache(prev => new Map(prev).set(address, profile));
  }, []);

  /** Track which expanded wallet originated each edge: edgeId -> originAddr */
  const [edgeOriginMap, setEdgeOriginMap] = useState<Map<string, string>>(new Map());
  /** Filter: focus on a single expanded wallet's sub-network (null = show all) */
  const [focusWallet, setFocusWallet] = useState<string | null>(null);
  /** Filter: which classifications are visible (empty = all visible) */
  const [classFilter, setClassFilter] = useState<Set<string>>(new Set());
  /** Filter panel open/close */
  const [filterOpen, setFilterOpen] = useState(false);
  /** History panel open/close */
  const [historyOpen, setHistoryOpen] = useState(false);
  /** Expand confirmation dialog */
  const [expandConfirm, setExpandConfirm] = useState<{ address: string; label: string } | null>(null);

  /** Tracking history */
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());

  const addToHistory = useCallback((address: string, label: string, counterpartyCount: number) => {
    setHistory(prev => {
      // Deduplicate: remove old entry for same address, then prepend
      const filtered = prev.filter(h => h.address !== address);
      const updated = [{ address, label, timestamp: Date.now(), counterpartyCount }, ...filtered].slice(0, 50);
      saveHistory(updated);
      return updated;
    });
  }, []);

  const removeFromHistory = useCallback((address: string) => {
    setHistory(prev => {
      const updated = prev.filter(h => h.address !== address);
      saveHistory(updated);
      return updated;
    });
  }, []);

  const nodeTypes = useMemo(() => ({ person: PersonNode }), []);
  const edgeTypes = useMemo(() => ({ circle: CircleEdge }), []);
  const [tonConnectUI] = useTonConnectUI();
  const userAddress = useTonAddress();
  const [activeAddress, setActiveAddress] = useState<string>("");
  // Track which address we last loaded so we can detect changes
  const lastLoadedRef = useRef<string>("");

  // Normalize the raw address to canonical EQ form via the API
  useEffect(() => {
    const raw = manualAddress || userAddress || "";
    if (!raw) { setActiveAddress(""); return; }
    normalizeToBounceable(raw).then(setActiveAddress);
  }, [manualAddress, userAddress]);

  const searchResults = knownWallets.filter((w) =>
    w.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  /* -- Fetch network graph from API -- */
  const fetchFullAnalysis = useCallback(async (address: string): Promise<{ counterparties: Counterparty[]; totalTxFetched: number; balanceNano: number | null } | null> => {
    try {
      const res = await fetch(
        `http://localhost:3001/api/wallet-network?address=${encodeURIComponent(address)}&limit=50`
      );
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Unknown error");
      const r = json.result;
      return {
        counterparties: r.counterparties ?? [],
        totalTxFetched: r.totalTxFetched ?? 0,
        balanceNano: r.balanceNano ?? null,
      };
    } catch (err) {
      console.error("fetchFullAnalysis error:", err);
      return null;
    }
  }, []);

  /* -- Build edges with correct colors and directions -- */
  const buildEdges = useCallback((originAddr: string, counterparties: Counterparty[]) => {
    return counterparties.map((cp) => {
      const sentTON = nanoToTON(cp.sentNano);     // center sent TO counterparty
      const recvTON = nanoToTON(cp.receivedNano);  // center received FROM counterparty
      const isBidirectional = sentTON > 0 && recvTON > 0;
      const isSending = sentTON > 0 && recvTON === 0;
      // isSending = center sent to cp (red, arrow away from center)
      // !isSending && !isBidirectional = cp sent to center (green, arrow toward center)

      // Green: received by center (arrow toward center)
      // Red: sent from center (arrow away from center)
      // Blue: bidirectional
      const color = isBidirectional ? '#3b82f6' : (isSending ? '#ef4444' : '#22c55e');

      const label = isBidirectional
        ? `S: ${fmtVol(sentTON)} | R: ${fmtVol(recvTON)} TON`
        : `${fmtVol(isSending ? sentTON : recvTON)} TON`;

      // For red (sending from center): source=center, target=cp (arrow points away)
      // For green (receiving at center): source=cp, target=center (arrow points toward center)
      // For blue: source=center, target=cp with both markers
      const source = isSending || isBidirectional ? originAddr : cp.address;
      const target = isSending || isBidirectional ? cp.address : originAddr;

      return {
        id: edgeKey(originAddr, cp.address),
        source,
        target,
        type: 'circle',
        animated: true,
        label,
        data: { txCount: cp.txCount, volumeTON: nanoToTON(cp.sentNano + cp.receivedNano), origin: originAddr },
        style: { stroke: color, strokeWidth: 2.5 },
        markerEnd: {
          type: MarkerType.Arrow,
          width: 25,
          height: 25,
          color,
        },
        ...(isBidirectional && {
          markerStart: {
            type: MarkerType.Arrow,
            width: 25,
            height: 25,
            color,
          },
        }),
      };
    });
  }, []);

  /* -- Clear all state for a fresh load -- */
  const clearGraph = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setSelected(null);
    setExpandedAddresses([]);
    setKnownWallets([]);
    setCounterpartyMap(new Map());
    setWalletBalances(new Map());
    setCenterAddr("");
    setError(null);
    setEdgeOriginMap(new Map());
    setFocusWallet(null);
    setClassFilter(new Set());
    localStorage.removeItem(LS_KEY);
  }, [setNodes, setEdges]);

  /* -- Load from full analysis and add nodes/edges -- */
  const loadFromFullAnalysis = useCallback(async (
    address: string,
    isCenter: boolean,
  ) => {
    setLoading(true);
    setError(null);

    const profile = await fetchFullAnalysis(address);
    if (!profile) {
      setError("Failed to fetch on-chain data. Is the API server running?");
      setLoading(false);
      return;
    }

    const canonAddr = address;
    const counterparties = profile.counterparties;

    // Store balance for the center wallet
    setWalletBalances((prev) => {
      const next = new Map(prev);
      if (profile.balanceNano != null) {
        next.set(canonAddr, profile.balanceNano);
      }
      return next;
    });

    if (isCenter) {
      setCenterAddr(canonAddr);
    }

    setNodes((prevNodes: any[]) => {
      const nodeMap = new Map<string, any>();
      for (const n of prevNodes) nodeMap.set(n.id, n);

      // Ensure the center/expanded address node exists
      if (!nodeMap.has(canonAddr)) {
        const totalTx = profile.totalTxFetched;
        nodeMap.set(canonAddr, {
          id: canonAddr,
          type: "person",
          position: { x: 0, y: 0 },
          data: {
            label: isCenter ? "Center" : shortAddr(canonAddr),
            volumeTON: 0,
            radius: isCenter ? 55 : calcRadius(totalTx),
            walletInfo: { id: canonAddr, label: isCenter ? "Center" : shortAddr(canonAddr), volumeTON: 0, txCount: totalTx, isCenter },
            classification: isCenter ? "center" : classifyByTxCount(totalTx),
            selected: false,
            onSelect: setSelected,
          },
        });
      } else {
        const existing = nodeMap.get(canonAddr)!;
        const oldTx = existing.data.walletInfo.txCount;
        const newTx = Math.max(oldTx, profile.totalTxFetched);
        if (newTx > oldTx) {
          const wi = { ...existing.data.walletInfo, txCount: newTx };
          nodeMap.set(canonAddr, {
            ...existing,
            data: {
              ...existing.data,
              radius: existing.data.walletInfo.isCenter ? 55 : calcRadius(newTx),
              walletInfo: wi,
              classification: existing.data.walletInfo.isCenter ? "center" : classifyByTxCount(newTx),
            },
          });
        }
      }

      // Get the orbit center position from the expanded node
      const orbitNode = nodeMap.get(canonAddr);
      const cx = orbitNode?.position?.x ?? 0;
      const cy = orbitNode?.position?.y ?? 0;
      const radiusOrbit = 380;

      counterparties.forEach((cp, i) => {
        const volTON = nanoToTON(cp.sentNano + cp.receivedNano);

        if (nodeMap.has(cp.address)) {
          // Merge into existing node
          const existing = nodeMap.get(cp.address)!;
          const oldTx = existing.data.walletInfo.txCount;
          const mergedTx = oldTx + cp.txCount;
          const mergedVol = existing.data.walletInfo.volumeTON + volTON;
          const wi: WalletInfo = { ...existing.data.walletInfo, txCount: mergedTx, volumeTON: mergedVol };
          nodeMap.set(cp.address, {
            ...existing,
            data: {
              ...existing.data,
              volumeTON: mergedVol,
              radius: existing.data.walletInfo.isCenter ? 55 : calcRadius(mergedTx),
              walletInfo: wi,
              classification: existing.data.walletInfo.isCenter ? "center" : classifyByTxCount(mergedTx),
            },
          });
          return;
        }

        // New node
        const r = calcRadius(cp.txCount);
        const angle = (i / counterparties.length) * 2 * Math.PI;
        const jitter = (Math.random() - 0.5) * 120;

        const walletInfo: WalletInfo = {
          id: cp.address,
          label: shortAddr(cp.address),
          volumeTON: volTON,
          txCount: cp.txCount,
          isCenter: false,
        };

        nodeMap.set(cp.address, {
          id: cp.address,
          type: "person",
          position: {
            x: cx + Math.cos(angle) * (radiusOrbit + jitter),
            y: cy + Math.sin(angle) * (radiusOrbit + jitter),
          },
          data: {
            label: shortAddr(cp.address),
            volumeTON: volTON,
            radius: r,
            walletInfo,
            classification: classifyByTxCount(cp.txCount),
            selected: false,
            onSelect: setSelected,
          },
        });
      });

      const allNodes = Array.from(nodeMap.values());
      const allWallets: WalletInfo[] = allNodes.map((n: any) => n.data.walletInfo);
      setKnownWallets(allWallets);

      return allNodes;
    });

    // Build and merge edges (deduped)
    const newEdges = buildEdges(canonAddr, counterparties);
    setEdges((prevEdges: any[]) => {
      const existingIds = new Set(prevEdges.map((e: any) => e.id));
      const toAdd = newEdges.filter(e => !existingIds.has(e.id));
      return [...prevEdges, ...toAdd];
    });

    // Track which expanded wallet originated each edge
    setEdgeOriginMap((prev) => {
      const next = new Map(prev);
      for (const e of newEdges) next.set(e.id, canonAddr);
      return next;
    });

    // Store counterparty flow data
    setCounterpartyMap((prev) => {
      const next = new Map(prev);
      for (const cp of counterparties) {
        const existing = next.get(cp.address);
        if (existing) {
          next.set(cp.address, {
            ...existing,
            sentNano: existing.sentNano + cp.sentNano,
            receivedNano: existing.receivedNano + cp.receivedNano,
            txCount: existing.txCount + cp.txCount,
            lastSeen: Math.max(existing.lastSeen, cp.lastSeen),
          });
        } else {
          next.set(cp.address, cp);
        }
      }
      return next;
    });

    setExpandedAddresses((prev) => [...prev, canonAddr]);
    setLoading(false);
  }, [fetchFullAnalysis, buildEdges, setNodes, setEdges]);

  /* -- Handle expanding a secondary wallet's network -- */
  const handleExpand = useCallback(async (address: string) => {
    if (expandedAddresses.includes(address)) return;
    // If there are already expanded wallets beyond center, ask user
    if (expandedAddresses.length > 1) {
      setExpandConfirm({ address, label: shortAddr(address) });
      return;
    }
    await loadFromFullAnalysis(address, false);
    addToHistory(address, shortAddr(address), 0);
  }, [expandedAddresses, loadFromFullAnalysis, addToHistory]);

  /** Confirm expand: clear old expansions and focus on this wallet */
  const handleExpandClearAndFocus = useCallback(async () => {
    if (!expandConfirm) return;
    const { address, label } = expandConfirm;
    setExpandConfirm(null);
    // Clear the graph but keep center, reload center + new wallet
    clearGraph();
    if (activeAddress) {
      lastLoadedRef.current = "";
      await loadFromFullAnalysis(activeAddress, true);
    }
    await loadFromFullAnalysis(address, false);
    addToHistory(address, label, 0);
  }, [expandConfirm, clearGraph, activeAddress, loadFromFullAnalysis, addToHistory]);

  /** Confirm expand: keep existing and add on top */
  const handleExpandKeepExisting = useCallback(async () => {
    if (!expandConfirm) return;
    const { address, label } = expandConfirm;
    setExpandConfirm(null);
    await loadFromFullAnalysis(address, false);
    addToHistory(address, label, 0);
  }, [expandConfirm, loadFromFullAnalysis, addToHistory]);

  /** Load a wallet from history as a new center */
  const loadFromHistory = useCallback(async (address: string) => {
    setHistoryOpen(false);
    setManualAddress(address);
  }, [setManualAddress]);

  /* -- Initial load when activeAddress changes -- */
  useEffect(() => {
    if (!activeAddress) {
      setNodes([{
        id: "placeholder",
        type: "person",
        position: { x: 0, y: 0 },
        data: {
          label: "Enter Wallet",
          volumeTON: 0,
          radius: 55,
          walletInfo: { id: "placeholder", label: "Enter Wallet", volumeTON: 0, txCount: 0, isCenter: true },
          classification: "center",
          selected: false,
          onSelect: () => {},
        },
      }]);
      return;
    }

    // Don't reload if same address
    if (lastLoadedRef.current === activeAddress) return;
    lastLoadedRef.current = activeAddress;

    // Clear and load fresh
    clearGraph();
    loadFromFullAnalysis(activeAddress, true);
    addToHistory(activeAddress, shortAddr(activeAddress), 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAddress]);

  /* -- Click a node: just select it -- */
  const handleSelectNode = useCallback((walletInfo: WalletInfo) => {
    if (walletInfo.id === "placeholder") return;
    setSelected(walletInfo);
  }, []);

  /* -- Search select -- */
  const handleSearchSelect = useCallback((wallet: WalletInfo) => {
    setSearchTerm("");
    handleSelectNode(wallet);
  }, [setSearchTerm, handleSelectNode]);

  /* -- Update selected & expanded state on nodes -- */
  useEffect(() => {
    setNodes((nds: any[]) =>
      nds.map((n: any) => ({
        ...n,
        data: {
          ...n.data,
          selected: selected?.id === n.id,
          isExpanded: expandedAddresses.includes(n.id),
          onSelect: (w: WalletInfo) => setSelected(w),
        },
      }))
    );
  }, [selected, expandedAddresses, setNodes]);

  /* -- Force layout: realign nodes to avoid overlap -- */
  const handleRealign = useCallback(() => {
    setNodes((currentNodes: any[]) => {
      const updated = forceLayout(currentNodes, edges);
      return updated;
    });
  }, [edges, setNodes]);

  /* -- Persist state -- */
  useEffect(() => {
    if (nodes.length > 0 && activeAddress) {
      saveToStorage(nodes, edges, activeAddress, expandedAddresses);
    }
  }, [nodes, edges, expandedAddresses, activeAddress]);

  /* -- Computed: filtered nodes & edges -- */
  const ALL_CLASSES = ["whale", "trader", "degen", "investor"];
  const hasClassFilter = classFilter.size > 0;

  const filteredEdges = useMemo(() => {
    let result = edges;
    // Focus filter: show only edges from this expanded wallet
    if (focusWallet) {
      result = result.filter((e: any) => {
        const origin = edgeOriginMap.get(e.id) ?? (e.data as any)?.origin;
        return origin === focusWallet;
      });
    }
    return result;
  }, [edges, focusWallet, edgeOriginMap]);

  const filteredNodes = useMemo(() => {
    let result = nodes;

    // Focus filter: show only center node + the focused wallet + its connected counterparties
    if (focusWallet) {
      const connectedIds = new Set<string>();
      connectedIds.add(focusWallet);
      // Also keep center node
      if (centerAddr) connectedIds.add(centerAddr);
      for (const e of filteredEdges) {
        connectedIds.add(e.source as string);
        connectedIds.add(e.target as string);
      }
      result = result.filter((n: any) => connectedIds.has(n.id));
    }

    // Classification filter
    if (hasClassFilter) {
      result = result.filter((n: any) => {
        const cls = (n.data as any)?.classification;
        if (cls === "center") return true; // always show center
        return classFilter.has(cls);
      });
    }

    return result;
  }, [nodes, focusWallet, centerAddr, filteredEdges, hasClassFilter, classFilter]);

  // Also re-filter edges to only include those with both endpoints visible
  const visibleEdges = useMemo(() => {
    const visibleIds = new Set(filteredNodes.map((n: any) => n.id));
    return filteredEdges.filter((e: any) => visibleIds.has(e.source as string) && visibleIds.has(e.target as string));
  }, [filteredNodes, filteredEdges]);

  const toggleClassFilter = useCallback((cls: string) => {
    setClassFilter(prev => {
      const next = new Set(prev);
      if (next.has(cls)) next.delete(cls);
      else next.add(cls);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFocusWallet(null);
    setClassFilter(new Set());
  }, []);

  return (
    <>
      <main className="fixed left-0 sm:left-20 right-0 top-24 bottom-0 overflow-hidden"
            style={{ background: "#080d14" }}>

        {loading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-slate-300">Fetching on-chain data...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-red-500/20 border border-red-500/40 text-red-300 px-4 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        {searchTerm.length > 0 && (
          <div className="fixed top-28 right-20 z-50 w-72 bg-[#1a2535]/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
            {searchResults.length > 0 ? (
              searchResults.map((wallet) => {
                const isExpanded = expandedAddresses.includes(wallet.id);
                return (
                  <div
                    key={wallet.id}
                    onClick={() => handleSearchSelect(wallet)}
                    className="px-4 py-3 hover:bg-slate-800 cursor-pointer border-b border-slate-700/50 flex justify-between items-center group transition-colors"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-sm text-white group-hover:text-blue-400 transition-colors truncate">
                        {wallet.label}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono truncate">
                        {wallet.id}
                      </span>
                    </div>
                    {isExpanded ? (
                      <span className="text-[10px] font-mono text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded flex-shrink-0 ml-2">
                        Expanded
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded flex-shrink-0 ml-2">
                        Click to select
                      </span>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="px-4 py-4 text-sm text-center text-slate-400">
                No matching wallets...
              </div>
            )}
          </div>
        )}

        <ReactFlow
          nodes={filteredNodes}
          edges={visibleEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_, node) => {
            const wi = (node.data as any).walletInfo as WalletInfo;
            if (!wi) return;
            handleSelectNode(wi);
            // Auto-expand on click if not yet expanded
            if (!expandedAddresses.includes(wi.id) && wi.id !== "placeholder") {
              handleExpand(wi.id);
            }
          }}
          onPaneClick={() => setSelected(null)}
          fitView
          minZoom={0.2}
          maxZoom={2.5}
        >
          <Background color="#1a2535" gap={26} size={1} />
          <Controls />

          {/* Realign button */}
          <Panel position="top-left" style={{ marginTop: 8, marginLeft: 8 }}>
            <button
              onClick={handleRealign}
              title="Auto-layout: spread overlapping nodes"
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wide
                         bg-blue-600/90 border border-blue-400/50 text-white rounded-lg
                         hover:bg-blue-500 hover:border-blue-300 transition-all cursor-pointer
                         backdrop-blur-sm shadow-lg"
            >
              &#x2728; Realign
            </button>
          </Panel>

          {/* Filter panel */}
          <Panel position="top-right" style={{ marginTop: 8, marginRight: 8 }}>
            <div className="flex flex-col gap-2">
              {/* Filter toggle button */}
              <button
                onClick={() => setFilterOpen(o => !o)}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wide rounded-lg
                           transition-all cursor-pointer backdrop-blur-sm shadow-lg border
                           ${(focusWallet || hasClassFilter)
                             ? "bg-orange-600/90 border-orange-400/50 text-white"
                             : "bg-slate-700/90 border-slate-500/50 text-slate-200 hover:bg-slate-600"}`}
              >
                &#x1F50D; Filter {(focusWallet || hasClassFilter) ? "(active)" : ""}
              </button>

              {filterOpen && (
                <div className="bg-[#0f1923]/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl p-3 w-64 text-white">
                  {/* Focus wallet dropdown */}
                  <div className="mb-3">
                    <label className="block text-[10px] uppercase tracking-widest text-slate-400 mb-1 font-bold">
                      Focus on Wallet
                    </label>
                    <select
                      value={focusWallet ?? "__all__"}
                      onChange={(e) => setFocusWallet(e.target.value === "__all__" ? null : e.target.value)}
                      className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:border-blue-400 outline-none"
                    >
                      <option value="__all__">All wallets</option>
                      {expandedAddresses.map((addr) => (
                        <option key={addr} value={addr}>
                          {addr === centerAddr ? "Center" : shortAddr(addr)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Classification filter */}
                  <div className="mb-3">
                    <label className="block text-[10px] uppercase tracking-widest text-slate-400 mb-1.5 font-bold">
                      Classification
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {ALL_CLASSES.map((cls) => {
                        const isActive = !hasClassFilter || classFilter.has(cls);
                        const colors: Record<string, string> = {
                          whale: "bg-purple-600/80 border-purple-400",
                          trader: "bg-blue-600/80 border-blue-400",
                          degen: "bg-green-600/80 border-green-400",
                          investor: "bg-cyan-600/80 border-cyan-400",
                        };
                        return (
                          <button
                            key={cls}
                            onClick={() => toggleClassFilter(cls)}
                            className={`px-2 py-1 text-[10px] font-bold uppercase rounded border transition-all
                              ${isActive
                                ? `${colors[cls]} text-white`
                                : "bg-slate-800/50 border-slate-600 text-slate-500"}`}
                          >
                            {cls}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="text-[10px] text-slate-400 mb-2">
                    Showing {filteredNodes.length} of {nodes.length} nodes
                    {" \u2022 "}{visibleEdges.length} of {edges.length} edges
                  </div>

                  {/* Clear filters */}
                  {(focusWallet || hasClassFilter) && (
                    <button
                      onClick={clearFilters}
                      className="w-full py-1.5 text-[10px] font-bold uppercase tracking-wide rounded
                                 bg-red-600/30 border border-red-500/40 text-red-300
                                 hover:bg-red-600/50 transition-all"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              )}
            </div>
          </Panel>
        </ReactFlow>
      </main>

      <DetailPanel
        wallet={selected ? {
          id: selected.id,
          name: selected.label,
          type: selected.isCenter ? "primary" : classifyByTxCount(selected.txCount),
          totalVolume: selected.volumeTON,
          totalTransactions: selected.txCount,
        } : null}
        onClose={() => setSelected(null)}
        flow={selected && !selected.isCenter ? (() => {
          const cp = counterpartyMap.get(selected.id);
          if (!cp) return null;
          return {
            address: cp.address,
            sentNano: cp.sentNano,
            receivedNano: cp.receivedNano,
            txCount: cp.txCount,
            lastSeen: cp.lastSeen,
          } as CounterpartyFlow;
        })() : null}
        centerAddress={centerAddr || userAddress || null}
        walletBalance={selected ? (walletBalances.get(selected.id) ?? null) : null}
        onExpand={handleExpand}
        isExpanded={selected ? expandedAddresses.includes(selected.id) : false}
        cachedProfile={selected ? (profileCache.get(selected.id) ?? null) : null}
        onProfileFetched={handleProfileFetched}
      />
    </>
  );
}
