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

import { useTonConnectUI, useTonAddress, useTonWallet } from "@tonconnect/ui-react";

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

interface NetworkData {
  counterparties: Counterparty[];
  totalTxFetched: number;
  balanceNano: number | null;
}

/* ================================================================
   CONSTANTS
================================================================ */
const PAYMENT_ADDRESS = "0QBbtZtF0cYG5xj7JvpbUhHIkMqx3PhE4FVqAXJx9k-Ljy8_";
const PAID_WALLETS_LS_KEY = "netview-paid";

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

function loadPaidWallets(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(PAID_WALLETS_LS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set<string>(Array.isArray(arr) ? arr : []);
  } catch { return new Set(); }
}

function savePaidWallets(set: Set<string>) {
  try {
    localStorage.setItem(PAID_WALLETS_LS_KEY, JSON.stringify(Array.from(set)));
  } catch { /* quota */ }
}

const NETWORK_CACHE_LS_KEY = "netview-cache";

function loadNetworkCache(): Map<string, NetworkData> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = localStorage.getItem(NETWORK_CACHE_LS_KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw);
    return new Map<string, NetworkData>(Object.entries(obj));
  } catch { return new Map(); }
}

function saveNetworkCache(cache: Map<string, NetworkData>) {
  try {
    // Keep only the 20 most-recently-set entries to avoid quota issues
    const entries = [...cache.entries()];
    const trimmed = entries.slice(-20);
    localStorage.setItem(NETWORK_CACHE_LS_KEY, JSON.stringify(Object.fromEntries(trimmed)));
  } catch { /* quota */ }
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
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 50)));
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
   FORCE-DIRECTED LAYOUT
================================================================ */
function forceLayout(
  nodes: any[],
  edges: any[],
  iterations = 120,
): any[] {
  if (nodes.length < 2) return nodes;

  type Vec = { x: number; y: number };
  const pos: Record<string, Vec> = {};
  const radii: Record<string, number> = {};
  const ids: string[] = [];

  for (const n of nodes) {
    pos[n.id] = { x: n.position.x, y: n.position.y };
    radii[n.id] = ((n.data as any)?.radius ?? 40) as number;
    ids.push(n.id);
  }

  const centerNode = nodes.find((n: any) => n.data?.walletInfo?.isCenter);
  const centerId = centerNode?.id ?? ids[0];

  const adj = new Set<string>();
  for (const e of edges) {
    adj.add(`${e.source}|${e.target}`);
    adj.add(`${e.target}|${e.source}`);
  }

  const REPULSION = 80_000;
  const SPRING_K_BASE = 0.006;
  const SPRING_LEN_MAX = 450;
  const SPRING_LEN_MIN = 120;
  const GRAVITY = 0.002;
  const DAMPING = 0.92;
  const MIN_DIST = 20;
  const MAX_FORCE = 60;

  let maxWeight = 1;
  for (const e of edges) {
    const tx = (e.data?.txCount ?? 1) as number;
    const vol = (e.data?.volumeTON ?? 0) as number;
    const w = tx + vol * 0.5;
    if (w > maxWeight) maxWeight = w;
  }
  const edgeParams: Record<string, { springLen: number; springK: number }> = {};
  for (const e of edges) {
    const tx = (e.data?.txCount ?? 1) as number;
    const vol = (e.data?.volumeTON ?? 0) as number;
    const w = tx + vol * 0.5;
    const ratio = w / maxWeight;
    const springLen = SPRING_LEN_MAX - ratio * (SPRING_LEN_MAX - SPRING_LEN_MIN);
    const springK = SPRING_K_BASE * (1 + ratio * 3);
    const key1 = `${e.source}|${e.target}`;
    const key2 = `${e.target}|${e.source}`;
    edgeParams[key1] = { springLen, springK };
    edgeParams[key2] = { springLen, springK };
  }

  const vel: Record<string, Vec> = {};
  for (const id of ids) vel[id] = { x: 0, y: 0 };

  for (let iter = 0; iter < iterations; iter++) {
    const temp = 1 - iter / iterations;
    const forces: Record<string, Vec> = {};
    for (const id of ids) forces[id] = { x: 0, y: 0 };

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i], b = ids[j];
        let dx = pos[a].x - pos[b].x;
        let dy = pos[a].y - pos[b].y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MIN_DIST) { dx = (Math.random() - 0.5) * 40; dy = (Math.random() - 0.5) * 40; dist = MIN_DIST; }

        const overlap = (radii[a] + radii[b] + 30) - dist;
        const overlapMult = overlap > 0 ? 1 + overlap * 0.05 : 1;

        const f = (REPULSION * overlapMult) / (dist * dist);
        const fx = (dx / dist) * f;
        const fy = (dy / dist) * f;
        forces[a].x += fx; forces[a].y += fy;
        forces[b].x -= fx; forces[b].y -= fy;
      }
    }

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

    const cx = pos[centerId]?.x ?? 0;
    const cy = pos[centerId]?.y ?? 0;
    for (const id of ids) {
      if (id === centerId) continue;
      forces[id].x -= (pos[id].x - cx) * GRAVITY;
      forces[id].y -= (pos[id].y - cy) * GRAVITY;
    }

    for (const id of ids) {
      if (id === centerId) continue;
      const fx = Math.max(-MAX_FORCE, Math.min(MAX_FORCE, forces[id].x)) * temp;
      const fy = Math.max(-MAX_FORCE, Math.min(MAX_FORCE, forces[id].y)) * temp;
      vel[id].x = (vel[id].x + fx) * DAMPING;
      vel[id].y = (vel[id].y + fy) * DAMPING;
      pos[id].x += vel[id].x;
      pos[id].y += vel[id].y;
    }
  }

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
  const [walletBalances, setWalletBalances] = useState<Map<string, number>>(new Map());
  const [centerAddr, setCenterAddr] = useState<string>("");
  const [profileCache, setProfileCache] = useState<Map<string, WalletProfile>>(new Map());

  // Payment-related state
  const [paidWallets, setPaidWallets] = useState<Set<string>>(() => loadPaidWallets());
  const paidWalletsRef = useRef<Set<string>>(new Set());
  const networkDataCache = useRef<Map<string, NetworkData>>(loadNetworkCache());
  const networkDataCacheRef = networkDataCache;

  const [networkLocked, setNetworkLocked] = useState(false);
  const [paymentPending, setPaymentPending] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  // pendingExpand: address -> { boc, queryId } — payment stored for optional expand
  const [pendingExpand, setPendingExpand] = useState<Map<string, { boc: string; queryId: string }>>(new Map());
  // hiddenNetworks: addresses whose expanded network is hidden
  const [hiddenNetworks, setHiddenNetworks] = useState<Set<string>>(new Set());

  // Keep ref in sync
  useEffect(() => {
    paidWalletsRef.current = paidWallets;
  }, [paidWallets]);

  const handleProfileFetched = useCallback((address: string, profile: WalletProfile) => {
    setProfileCache(prev => new Map(prev).set(address, profile));
  }, []);

  const [edgeOriginMap, setEdgeOriginMap] = useState<Map<string, string>>(new Map());
  const [focusWallet, setFocusWallet] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());

  const addToHistory = useCallback((address: string, label: string, counterpartyCount: number) => {
    setHistory(prev => {
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
  const tonWallet = useTonWallet();
  const currentNetwork = tonWallet?.account?.chain === "-239" ? "mainnet" : "testnet";

  const [activeAddress, setActiveAddress] = useState<string>("");
  const lastLoadedRef = useRef<string>("");

  // Normalize the raw address; reset lastLoadedRef so main effect re-evaluates
  useEffect(() => {
    const raw = manualAddress || userAddress || "";
    if (!raw) { setActiveAddress(""); lastLoadedRef.current = ""; return; }
    lastLoadedRef.current = ""; // reset so main effect always re-runs on address change
    normalizeToBounceable(raw).then(setActiveAddress);
  }, [manualAddress, userAddress]);

  // Normalize userAddress for comparison
  const [normalizedUserAddress, setNormalizedUserAddress] = useState<string>("");
  useEffect(() => {
    if (!userAddress) { setNormalizedUserAddress(""); return; }
    normalizeToBounceable(userAddress).then(setNormalizedUserAddress);
  }, [userAddress]);

const searchResults = knownWallets.filter((w) =>
    w.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  /* ----------------------------------------------------------------
     buildEdges
  ---------------------------------------------------------------- */
  const buildEdges = useCallback((originAddr: string, counterparties: Counterparty[]) => {
    return counterparties.map((cp) => {
      const sentTON = nanoToTON(cp.sentNano);
      const recvTON = nanoToTON(cp.receivedNano);
      const isBidirectional = sentTON > 0 && recvTON > 0;
      const isSending = sentTON > 0 && recvTON === 0;

      const color = isBidirectional ? '#3b82f6' : (isSending ? '#ef4444' : '#22c55e');

      const label = isBidirectional
        ? `S: ${fmtVol(sentTON)} | R: ${fmtVol(recvTON)} TON`
        : `${fmtVol(isSending ? sentTON : recvTON)} TON`;

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

  /* ----------------------------------------------------------------
     clearGraph
  ---------------------------------------------------------------- */
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

  /* ----------------------------------------------------------------
     showCenterBubble — place single bubble for an address
  ---------------------------------------------------------------- */
  const showCenterBubble = useCallback((address: string, label: string) => {
    const walletInfo: WalletInfo = {
      id: address,
      label,
      volumeTON: 0,
      txCount: 0,
      isCenter: true,
    };
    setNodes([{
      id: address,
      type: "person",
      position: { x: 0, y: 0 },
      data: {
        label,
        volumeTON: 0,
        radius: 55,
        walletInfo,
        classification: "center",
        selected: false,
        isExpanded: false,
        onSelect: setSelected,
      },
    }]);
    setEdges([]);
    setCenterAddr(address);
    setKnownWallets([walletInfo]);
  }, [setNodes, setEdges]);

  /* ----------------------------------------------------------------
     applyNetworkData — build graph from NetworkData (no API call)
  ---------------------------------------------------------------- */
  const applyNetworkData = useCallback((
    address: string,
    isCenter: boolean,
    data: NetworkData,
  ) => {
    const canonAddr = address;
    const { counterparties, totalTxFetched, balanceNano } = data;

    setWalletBalances((prev) => {
      const next = new Map(prev);
      if (balanceNano != null) next.set(canonAddr, balanceNano);
      return next;
    });

    if (isCenter) setCenterAddr(canonAddr);

    setNodes((prevNodes: any[]) => {
      const nodeMap = new Map<string, any>();
      for (const n of prevNodes) nodeMap.set(n.id, n);

      if (!nodeMap.has(canonAddr)) {
        nodeMap.set(canonAddr, {
          id: canonAddr,
          type: "person",
          position: { x: 0, y: 0 },
          data: {
            label: isCenter ? shortAddr(canonAddr) : shortAddr(canonAddr),
            volumeTON: 0,
            radius: isCenter ? 55 : calcRadius(totalTxFetched),
            walletInfo: {
              id: canonAddr,
              label: isCenter ? shortAddr(canonAddr) : shortAddr(canonAddr),
              volumeTON: 0,
              txCount: totalTxFetched,
              isCenter,
            },
            classification: isCenter ? "center" : classifyByTxCount(totalTxFetched),
            selected: false,
            isExpanded: false,
            onSelect: setSelected,
          },
        });
      } else {
        const existing = nodeMap.get(canonAddr)!;
        const oldTx = existing.data.walletInfo.txCount;
        const newTx = Math.max(oldTx, totalTxFetched);
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

      const orbitNode = nodeMap.get(canonAddr);
      const cx = orbitNode?.position?.x ?? 0;
      const cy = orbitNode?.position?.y ?? 0;
      const radiusOrbit = 380;

      counterparties.forEach((cp, i) => {
        const volTON = nanoToTON(cp.sentNano + cp.receivedNano);

        if (nodeMap.has(cp.address)) {
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
            isExpanded: false,
            onSelect: setSelected,
          },
        });
      });

      const allNodes = Array.from(nodeMap.values());
      const allWallets: WalletInfo[] = allNodes.map((n: any) => n.data.walletInfo);
      setKnownWallets(allWallets);
      return allNodes;
    });

    const newEdges = buildEdges(canonAddr, counterparties);
    setEdges((prevEdges: any[]) => {
      const existingIds = new Set(prevEdges.map((e: any) => e.id));
      const toAdd = newEdges.filter(e => !existingIds.has(e.id));
      return [...prevEdges, ...toAdd];
    });

    setEdgeOriginMap((prev) => {
      const next = new Map(prev);
      for (const e of newEdges) next.set(e.id, canonAddr);
      return next;
    });

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

    setExpandedAddresses((prev) =>
      prev.includes(canonAddr) ? prev : [...prev, canonAddr]
    );
  }, [buildEdges, setNodes, setEdges]);

  /* ----------------------------------------------------------------
     loadNetworkWithPayment — fetch API with payment header, then apply
  ---------------------------------------------------------------- */
  const loadNetworkWithPayment = useCallback(async (
    address: string,
    isCenter: boolean,
    boc: string | null,   // null = free (own wallet, no payment required)
    queryId: string,
    fromAddress: string,
    network: string,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const fetchOptions: RequestInit = {};
      if (boc) {
        const payloadObj = { scheme: "ton-v1", network, boc, fromAddress, queryId };
        fetchOptions.headers = { "PAYMENT-SIGNATURE": btoa(JSON.stringify(payloadObj)) };
      }

      const res = await fetch(
        `http://localhost:3001/api/wallet-network?address=${encodeURIComponent(address)}&limit=50`,
        fetchOptions
      );
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Unknown error");

      const r = json.result;
      const data: NetworkData = {
        counterparties: r.counterparties ?? [],
        totalTxFetched: r.totalTxFetched ?? 0,
        balanceNano: r.balanceNano ?? null,
      };

      // Cache the result (persist to localStorage for session-free history)
      networkDataCacheRef.current.set(address, data);
      saveNetworkCache(networkDataCacheRef.current);

      applyNetworkData(address, isCenter, data);
    } catch (err: any) {
      setError("Failed to load network: " + (err.message ?? "Unknown error"));
    } finally {
      setLoading(false);
    }
  }, [applyNetworkData, networkDataCacheRef]);

  /* ----------------------------------------------------------------
     handlePayForNetwork — pay for the manualAddress network (LOAD flow)
  ---------------------------------------------------------------- */
  const handlePayForNetwork = useCallback(async () => {
    if (!manualAddress || !activeAddress) return;
    if (!tonConnectUI) return;

    setPaymentPending(true);
    setPaymentError(null);

    try {
      const amountNano = "10000000"; // 0.01 TON in nanotons
      const tx = await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: PAYMENT_ADDRESS,
            amount: amountNano,
          },
        ],
      });

      const boc = tx.boc;
      const queryId = Date.now().toString();
      const fromAddress = userAddress || "";

      // Mark as paid
      const newPaid = new Set(paidWalletsRef.current);
      newPaid.add(activeAddress);
      setPaidWallets(newPaid);
      savePaidWallets(newPaid);
      setNetworkLocked(false);

      // Load network with payment
      await loadNetworkWithPayment(
        activeAddress, true, boc, queryId, fromAddress, currentNetwork
      );
      addToHistory(activeAddress, shortAddr(activeAddress), 0);
    } catch (err: any) {
      setPaymentError(err.message ?? "Payment failed");
    } finally {
      setPaymentPending(false);
    }
  }, [manualAddress, activeAddress, tonConnectUI, userAddress, loadNetworkWithPayment, currentNetwork, addToHistory]);

  /* ----------------------------------------------------------------
     handleOnPaid — called from DetailPanel after payment done
     Marks as paid, stores pendingExpand (no auto-expand)
  ---------------------------------------------------------------- */
  const handleOnPaid = useCallback((address: string, boc: string, queryId: string) => {
    const newPaid = new Set(paidWalletsRef.current);
    newPaid.add(address);
    setPaidWallets(newPaid);
    savePaidWallets(newPaid);
    setNetworkLocked(false);

    // If the paid address is the center (manual search), auto-load the network immediately
    if (address === activeAddress && !!manualAddress) {
      loadNetworkWithPayment(address, true, boc, queryId, userAddress || "", currentNetwork);
    } else {
      // For side bubbles, store payment for optional expand
      setPendingExpand(prev => {
        const next = new Map(prev);
        next.set(address, { boc, queryId });
        return next;
      });
    }
  }, [activeAddress, manualAddress, userAddress, currentNetwork, loadNetworkWithPayment]);

  /* ----------------------------------------------------------------
     handleExpand — expand network for address using stored payment
  ---------------------------------------------------------------- */
  const handleExpand = useCallback(async (address: string) => {
    if (expandedAddresses.includes(address)) return;

    // Check cache first
    const cached = networkDataCacheRef.current.get(address);
    if (cached) {
      applyNetworkData(address, false, cached);
      addToHistory(address, shortAddr(address), cached.counterparties.length);
      return;
    }

    // Check pending payment (fresh boc from this session)
    const pending = pendingExpand.get(address);
    if (pending) {
      const fromAddress = userAddress || "";
      await loadNetworkWithPayment(address, false, pending.boc, pending.queryId, fromAddress, currentNetwork);
      addToHistory(address, shortAddr(address), 0);
      return;
    }

    // Already paid in a previous session → call API for free (no payment header)
    if (paidWalletsRef.current.has(address)) {
      await loadNetworkWithPayment(address, false, null, "", userAddress || "", currentNetwork);
      addToHistory(address, shortAddr(address), 0);
    }
  }, [expandedAddresses, pendingExpand, paidWalletsRef, networkDataCacheRef, applyNetworkData, loadNetworkWithPayment, userAddress, currentNetwork, addToHistory]);

  /* ----------------------------------------------------------------
     handleHide — hide edges/nodes for that address's network
  ---------------------------------------------------------------- */
  const handleHide = useCallback((address: string) => {
    setHiddenNetworks(prev => new Set([...prev, address]));
  }, []);

  /* ----------------------------------------------------------------
     handleShow — un-hide network for address
  ---------------------------------------------------------------- */
  const handleShow = useCallback((address: string) => {
    setHiddenNetworks(prev => {
      const next = new Set(prev);
      next.delete(address);
      return next;
    });
  }, []);

  /** Load a wallet from history as a new center */
  const loadFromHistory = useCallback(async (address: string) => {
    setHistoryOpen(false);
    setManualAddress(address);
  }, [setManualAddress]);

  /* ----------------------------------------------------------------
     Main effect: react to activeAddress changes
  ---------------------------------------------------------------- */
  useEffect(() => {
    if (!activeAddress) {
      // No address: show placeholder bubble
      setNodes([{
        id: "placeholder",
        type: "person",
        position: { x: 0, y: 0 },
        data: {
          label: "Connect Wallet",
          volumeTON: 0,
          radius: 55,
          walletInfo: { id: "placeholder", label: "Connect Wallet", volumeTON: 0, txCount: 0, isCenter: true },
          classification: "center",
          selected: false,
          isExpanded: false,
          onSelect: () => {},
        },
      }]);
      setEdges([]);
      return;
    }

    if (lastLoadedRef.current === activeAddress) return;
    lastLoadedRef.current = activeAddress;

    // Always clear graph first
    clearGraph();

    // Synchronous check: if no manualAddress and userAddress is connected,
    // activeAddress is always the connected wallet (both normalize the same input)
    const isOwnWallet = !manualAddress && !!userAddress;
    const isManual = !!manualAddress;

    if (isOwnWallet && !isManual) {
      // Load own wallet's network for free (no payment required)
      const cached = networkDataCacheRef.current.get(activeAddress);
      if (cached) {
        applyNetworkData(activeAddress, true, cached);
      } else {
        loadNetworkWithPayment(activeAddress, true, null, "", "", currentNetwork)
          .catch(() => showCenterBubble(activeAddress, "You")); // fallback on API error
      }
      return;
    }

    if (isManual) {
      // Check if already paid
      if (paidWalletsRef.current.has(activeAddress)) {
        // Check in-memory cache
        const cached = networkDataCacheRef.current.get(activeAddress);
        if (cached) {
          applyNetworkData(activeAddress, true, cached);
          addToHistory(activeAddress, shortAddr(activeAddress), cached.counterparties.length);
          return;
        }
        // Paid but no cache — show payment banner again (user needs to re-pay this session)
        showCenterBubble(activeAddress, shortAddr(activeAddress));
        setNetworkLocked(true);
        return;
      }

      // Not paid — show center bubble + locked banner
      showCenterBubble(activeAddress, shortAddr(activeAddress));
      setNetworkLocked(true);
      return;
    }

    // Fallback: just show center bubble
    showCenterBubble(activeAddress, shortAddr(activeAddress));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAddress, manualAddress, userAddress, currentNetwork]);

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

  // Hidden network edges: edges whose origin is in hiddenNetworks
  const filteredEdges = useMemo(() => {
    let result = edges;
    // Hide edges for hidden networks, but always keep edges between "anchor" nodes
    // (center + expanded wallets) — e.g. the center↔expanded edge must survive a hide
    if (hiddenNetworks.size > 0) {
      const anchorSet = new Set<string>([centerAddr, ...expandedAddresses]);
      result = result.filter((e: any) => {
        const origin = edgeOriginMap.get(e.id) ?? (e.data as any)?.origin;
        if (!hiddenNetworks.has(origin)) return true;
        // Keep edge if BOTH endpoints are anchor nodes (center or another expanded wallet)
        return anchorSet.has(e.source as string) && anchorSet.has(e.target as string);
      });
    }
    if (focusWallet) {
      result = result.filter((e: any) => {
        const origin = edgeOriginMap.get(e.id) ?? (e.data as any)?.origin;
        return origin === focusWallet;
      });
    }
    return result;
  }, [edges, focusWallet, edgeOriginMap, hiddenNetworks]);

  const filteredNodes = useMemo(() => {
    let result = nodes;

    // For hidden networks: remove nodes that are exclusively connected via hidden origins
    if (hiddenNetworks.size > 0) {
      const visibleEdgesForNodes = edges.filter((e: any) => {
        const origin = edgeOriginMap.get(e.id) ?? (e.data as any)?.origin;
        return !hiddenNetworks.has(origin);
      });
      const connectedToVisible = new Set<string>();
      for (const e of visibleEdgesForNodes) {
        connectedToVisible.add(e.source as string);
        connectedToVisible.add(e.target as string);
      }
      // Always keep center node and expanded address nodes (even when their network is hidden)
      const alwaysKeep = new Set<string>([centerAddr, ...expandedAddresses]);
      result = result.filter((n: any) => {
        if (n.data?.walletInfo?.isCenter) return true;
        if (alwaysKeep.has(n.id)) return true;
        return connectedToVisible.has(n.id);
      });
    }

    if (focusWallet) {
      const connectedIds = new Set<string>();
      connectedIds.add(focusWallet);
      if (centerAddr) connectedIds.add(centerAddr);
      for (const e of filteredEdges) {
        connectedIds.add(e.source as string);
        connectedIds.add(e.target as string);
      }
      result = result.filter((n: any) => connectedIds.has(n.id));
    }

    if (hasClassFilter) {
      result = result.filter((n: any) => {
        const cls = (n.data as any)?.classification;
        if (cls === "center") return true;
        return classFilter.has(cls);
      });
    }

    return result;
  }, [nodes, focusWallet, centerAddr, filteredEdges, hasClassFilter, classFilter, hiddenNetworks, edges, edgeOriginMap, expandedAddresses]);

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
      {/* History panel (slide-out) */}
      {historyOpen && (
        <div className="fixed inset-0 z-110 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setHistoryOpen(false)} />
          <div className="relative ml-auto w-full sm:w-80 h-full bg-[#0a1018] border-l border-slate-700 overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-[#0a1018] border-b border-slate-700 px-4 py-3 flex items-center justify-between z-10">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">Tracking History</h2>
              <button
                onClick={() => setHistoryOpen(false)}
                className="text-slate-500 hover:text-white text-lg transition-colors"
              >
                &times;
              </button>
            </div>
            {history.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-slate-500">
                No wallets tracked yet
              </div>
            ) : (
              <div className="flex flex-col">
                {history.map((entry) => {
                  const isActive = entry.address === activeAddress;
                  const dateStr = new Date(entry.timestamp).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                  });
                  return (
                    <div
                      key={entry.address}
                      className={`px-4 py-3 border-b border-slate-800 flex items-start gap-3 group transition-colors
                        ${isActive ? "bg-blue-900/20" : "hover:bg-slate-800/50"}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          {isActive && (
                            <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                          )}
                          <span className="text-xs font-mono text-slate-300 truncate">
                            {entry.label}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-500 block truncate">
                          {entry.address}
                        </span>
                        <span className="text-[9px] text-slate-600 mt-0.5 block">
                          {dateStr}
                        </span>
                      </div>
                      <div className="flex gap-1 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => loadFromHistory(entry.address)}
                          title="Load as center wallet"
                          className="px-2 py-1 text-[9px] font-bold uppercase rounded
                                     bg-blue-600/80 border border-blue-400/40 text-white
                                     hover:bg-blue-500 transition-all"
                        >
                          Load
                        </button>
                        <button
                          onClick={() => removeFromHistory(entry.address)}
                          title="Remove from history"
                          className="px-2 py-1 text-[9px] font-bold rounded
                                     bg-red-600/40 border border-red-500/40 text-red-300
                                     hover:bg-red-600/60 transition-all"
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <main className="fixed left-0 sm:left-20 right-0 top-[6.5rem] sm:top-24 bottom-16 sm:bottom-0 overflow-hidden"
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

        {/* Payment banner (compact, top-center) */}
        {networkLocked && !loading && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-2">
            <div className="bg-[#0f1923]/95 backdrop-blur-xl border border-amber-500/40 rounded-xl shadow-2xl p-4 text-center">
              <div className="text-amber-400 font-bold text-sm mb-1 tracking-wide uppercase">
                Network Locked
              </div>
              <div className="text-slate-400 text-xs mb-3">
                Pay 0.01 TON to unlock the network for<br />
                <span className="font-mono text-slate-300">{shortAddr(activeAddress)}</span>
              </div>
              {paymentError && (
                <div className="text-red-400 text-xs mb-2">{paymentError}</div>
              )}
              <button
                onClick={handlePayForNetwork}
                disabled={paymentPending}
                className="w-full py-2.5 text-xs font-bold uppercase tracking-wide rounded-lg
                           bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed
                           text-black transition-all"
              >
                {paymentPending ? "Waiting for payment..." : "Pay 0.01 TON — Unlock Network"}
              </button>
            </div>
          </div>
        )}

        {searchTerm.length > 0 && (
          <div className="fixed top-28 left-2 right-2 sm:left-auto sm:right-20 z-50 sm:w-72 bg-[#1a2535]/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
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
          }}
          onPaneClick={() => setSelected(null)}
          fitView
          minZoom={0.2}
          maxZoom={2.5}
        >
          <Background color="#1a2535" gap={26} size={1} />
          <Controls />

          {/* Realign + History buttons */}
          <Panel position="top-left" style={{ marginTop: 8, marginLeft: 8 }}>
            <div className="flex gap-1.5 sm:gap-2">
              <button
                onClick={handleRealign}
                title="Auto-layout: spread overlapping nodes"
                className="flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold uppercase tracking-wide
                           bg-blue-600/90 border border-blue-400/50 text-white rounded-lg
                           hover:bg-blue-500 hover:border-blue-300 transition-all cursor-pointer
                           backdrop-blur-sm shadow-lg"
              >
                <span className="hidden sm:inline">&#x2728;</span> Realign
              </button>
              <button
                onClick={() => setHistoryOpen(true)}
                title="View tracking history"
                className="flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold uppercase tracking-wide
                           bg-slate-700/90 border border-slate-500/50 text-slate-200 rounded-lg
                           hover:bg-slate-600 hover:border-slate-400 transition-all cursor-pointer
                           backdrop-blur-sm shadow-lg"
              >
                <span className="hidden sm:inline">&#x1F4CB;</span> History{history.length > 0 ? ` (${history.length})` : ""}
              </button>
            </div>
          </Panel>

          {/* Filter panel */}
          <Panel position="top-right" style={{ marginTop: 8, marginRight: 8 }}>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setFilterOpen(o => !o)}
                className={`flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold uppercase tracking-wide rounded-lg
                           transition-all cursor-pointer backdrop-blur-sm shadow-lg border
                           ${(focusWallet || hasClassFilter)
                             ? "bg-orange-600/90 border-orange-400/50 text-white"
                             : "bg-slate-700/90 border-slate-500/50 text-slate-200 hover:bg-slate-600"}`}
              >
                <span className="hidden sm:inline">&#x1F50D;</span> Filter {(focusWallet || hasClassFilter) ? "(active)" : ""}
              </button>

              {filterOpen && (
                <div className="bg-[#0f1923]/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl p-3 w-[calc(100vw-24px)] sm:w-64 max-w-[280px] text-white">
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

                  <div className="text-[10px] text-slate-400 mb-2">
                    Showing {filteredNodes.length} of {nodes.length} nodes
                    {" \u2022 "}{visibleEdges.length} of {edges.length} edges
                  </div>

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
        key={selected?.id ?? "none"}
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
        network={currentNetwork}
        userAddress={normalizedUserAddress || userAddress || ""}
        onPaid={handleOnPaid}
        isExpanded={selected ? expandedAddresses.includes(selected.id) : false}
        isHidden={selected ? hiddenNetworks.has(selected.id) : false}
        canExpand={selected ? (
          !expandedAddresses.includes(selected.id) && (
            pendingExpand.has(selected.id) ||
            networkDataCacheRef.current.has(selected.id) ||
            paidWalletsRef.current.has(selected.id)  // already paid → can expand (free API call)
          )
        ) : false}
        onExpand={handleExpand}
        onHide={handleHide}
        onShow={handleShow}
        cachedProfile={selected ? (profileCache.get(selected.id) ?? null) : null}
        onProfileFetched={handleProfileFetched}
        alreadyPaid={selected ? (
          // Own wallet is always free
          (!manualAddress && !!userAddress && selected.id === activeAddress) ||
          // Already paid in any previous session → never pay again
          paidWalletsRef.current.has(selected.id)
        ) : false}
      />
    </>
  );
}
