"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
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
import DetailPanel from "./DetailPanel";

import { useTonConnectUI, useTonAddress } from "@tonconnect/ui-react";

/* ================================================================
   TYPES - on-chain counterparty data
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

/** Minimal wallet info passed to DetailPanel / node data */
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

const calcRadius = (volumeTON: number) =>
  Math.min(100, Math.max(28, Math.sqrt(volumeTON) * 8));

function fmtVol(v: number) {
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return v.toFixed(2);
}

function classifyVolume(volTON: number): string {
  if (volTON >= 1000) return "whale";
  if (volTON >= 100) return "trader";
  if (volTON >= 10) return "degen";
  return "investor";
}

const THEMES: Record<string, { ring: string; glow: string; bg: string }> = {
  center:   { ring: "border-orange-400", glow: "shadow-[0_0_22px_rgba(249,115,22,.45)]",  bg: "bg-orange-900/60"  },
  whale:    { ring: "border-purple-400", glow: "shadow-[0_0_22px_rgba(168,85,247,.45)]",  bg: "bg-purple-900/60"  },
  trader:   { ring: "border-blue-400",   glow: "shadow-[0_0_22px_rgba(59,130,246,.45)]",  bg: "bg-blue-900/60"    },
  degen:    { ring: "border-green-400",  glow: "shadow-[0_0_22px_rgba(34,197,94,.45)]",   bg: "bg-green-900/60"   },
  investor: { ring: "border-cyan-400",   glow: "shadow-[0_0_22px_rgba(6,182,212,.45)]",   bg: "bg-cyan-900/60"    },
};
const theme = (t: string) => THEMES[t] ?? { ring: "border-slate-400", glow: "shadow-sm", bg: "bg-slate-800/60" };
const EMOJI: Record<string, string> = { center:"\u2B50", whale:"\u25CE", trader:"\u27F3", degen:"\u26A1", investor:"\u25C8" };

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
  onSelect: (w: WalletInfo) => void;
};

const PersonNode = ({ data }: { data: NodeData }) => {
  const { radius, walletInfo, classification, selected, onSelect } = data;
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
        {EMOJI[classification] ?? "\u25CE"}
      </span>
      <span className="font-bold text-xs text-center px-2 w-full truncate leading-tight">
        {data.label}
      </span>
      {!isCenter && (
        <span className="text-[10px] opacity-75 font-mono mt-0.5 tracking-wide">
          {fmtVol(data.volumeTON)} TON
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
   CUSTOM EDGE - stops at bubble boundary so arrow is visible
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
   BUBBLE MAP - 100% On-Chain
================================================================ */
export default function BubbleMap({
  searchTerm,
  setSearchTerm
}: {
  searchTerm: string;
  setSearchTerm: (val: string) => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [nodes, setNodes, onNodesChange] = useNodesState([] as any[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
  const [selected, setSelected]          = useState<WalletInfo | null>(null);
  const [loading, setLoading]            = useState(false);
  const [error, setError]                = useState<string | null>(null);

  const [expandedAddresses, setExpandedAddresses] = useState<string[]>([]);
  const [knownWallets, setKnownWallets] = useState<WalletInfo[]>([]);

  const nodeTypes = useMemo(() => ({ person: PersonNode }), []);
  const edgeTypes = useMemo(() => ({ circle: CircleEdge }), []);
  const [tonConnectUI] = useTonConnectUI();
  const userAddress = useTonAddress();

  const searchResults = knownWallets.filter((w) =>
    w.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  /* -- Fetch wallet network from API -- */
  const fetchWalletNetwork = useCallback(async (address: string): Promise<NetworkResult | null> => {
    try {
      const res = await fetch(`http://localhost:3001/api/wallet-network?address=${encodeURIComponent(address)}&limit=50`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Unknown error");
      return json.result as NetworkResult;
    } catch (err) {
      console.error("fetchWalletNetwork error:", err);
      return null;
    }
  }, []);

  /* -- Build edges from counterparty flow data -- */
  const buildEdges = useCallback((centerAddr: string, counterparties: Counterparty[]) => {
    return counterparties.map((cp) => {
      const sentTON = nanoToTON(cp.sentNano);
      const recvTON = nanoToTON(cp.receivedNano);
      const isBidirectional = sentTON > 0 && recvTON > 0;
      const isSending = sentTON > 0 && recvTON === 0;

      const color = isBidirectional ? '#a855f7' : (isSending ? '#ef4444' : '#22c55e');

      const label = isBidirectional
        ? `\u2191 ${fmtVol(sentTON)} | \u2193 ${fmtVol(recvTON)} TON`
        : `${fmtVol(isSending ? sentTON : recvTON)} TON`;

      return {
        id: `edge-${centerAddr}-${cp.address}`,
        source: isSending || isBidirectional ? centerAddr : cp.address,
        target: isSending || isBidirectional ? cp.address : centerAddr,
        type: 'circle',
        animated: true,
        label,
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

  /* -- Load the network for an address and add nodes/edges -- */
  const loadNetwork = useCallback(async (
    address: string,
    isCenter: boolean,
    savedPositions?: Record<string, { x: number; y: number }>
  ) => {
    setLoading(true);
    setError(null);

    const result = await fetchWalletNetwork(address);
    if (!result) {
      setError("Failed to fetch on-chain data. Is the API server running?");
      setLoading(false);
      return;
    }

    const { counterparties } = result;

    setNodes((prevNodes: any[]) => {
      const existingIds = new Set(prevNodes.map((n: any) => n.id));
      const newNodes: any[] = [];

      if (!existingIds.has(address)) {
        const centerPos = savedPositions?.[address] ?? { x: 0, y: 0 };
        newNodes.push({
          id: address,
          type: "person",
          position: centerPos,
          data: {
            label: isCenter ? "My Wallet" : shortAddr(address),
            volumeTON: 0,
            radius: isCenter ? 55 : 40,
            walletInfo: { id: address, label: isCenter ? "My Wallet" : shortAddr(address), volumeTON: 0, txCount: 0, isCenter },
            classification: isCenter ? "center" : "trader",
            selected: false,
            onSelect: setSelected,
          },
        });
      }

      const radiusOrbit = 380;
      counterparties.forEach((cp, i) => {
        if (existingIds.has(cp.address)) return;
        const volTON = nanoToTON(cp.sentNano + cp.receivedNano);
        const r = calcRadius(volTON);
        const angle = (i / counterparties.length) * 2 * Math.PI;
        const jitter = (Math.random() - 0.5) * 120;

        const centerNode = prevNodes.find((n: any) => n.id === address);
        const cx = centerNode?.position?.x ?? 0;
        const cy = centerNode?.position?.y ?? 0;

        const defaultPos = {
          x: cx + Math.cos(angle) * (radiusOrbit + jitter),
          y: cy + Math.sin(angle) * (radiusOrbit + jitter),
        };

        const walletInfo: WalletInfo = {
          id: cp.address,
          label: shortAddr(cp.address),
          volumeTON: volTON,
          txCount: cp.txCount,
          isCenter: false,
        };

        newNodes.push({
          id: cp.address,
          type: "person",
          position: savedPositions?.[cp.address] ?? defaultPos,
          data: {
            label: shortAddr(cp.address),
            volumeTON: volTON,
            radius: r,
            walletInfo,
            classification: classifyVolume(volTON),
            selected: false,
            onSelect: setSelected,
          },
        });
      });

      const allWallets: WalletInfo[] = [
        ...prevNodes.map((n: any) => n.data.walletInfo),
        ...newNodes.map((n: any) => n.data.walletInfo),
      ];
      setKnownWallets(allWallets);

      return [...prevNodes, ...newNodes];
    });

    const newEdges = buildEdges(address, counterparties);
    setEdges((prevEdges: any[]) => {
      const existingIds = new Set(prevEdges.map((e: any) => e.id));
      const toAdd = newEdges.filter(e => !existingIds.has(e.id));
      return [...prevEdges, ...toAdd];
    });

    setExpandedAddresses((prev) => [...prev, address]);
    setLoading(false);
  }, [fetchWalletNetwork, buildEdges, setNodes, setEdges]);

  /* -- 1. Initial load -- */
  useEffect(() => {
    if (!userAddress) {
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
          onSelect: () => {},
        },
      }]);
      return;
    }

    if (expandedAddresses.includes(userAddress)) return;

    const savedState = loadSaved();

    if (savedState && savedState.centerAddress !== userAddress) {
      localStorage.removeItem(LS_KEY);
    }

    if (savedState && savedState.centerAddress === userAddress && savedState.edges.length > 0) {
      setExpandedAddresses(savedState.expandedAddresses ?? []);
      loadNetwork(userAddress, true, savedState.nodePositions);
    } else {
      loadNetwork(userAddress, true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userAddress]);

  /* -- 2. Expand a node network -- */
  const handleExpandNode = useCallback(async (walletInfo: WalletInfo) => {
    setSelected(walletInfo);

    if (expandedAddresses.includes(walletInfo.id)) return;
    if (walletInfo.id === "placeholder") return;

    if (!userAddress) {
      alert("Please connect your TON wallet first!");
      return;
    }

    try {
      const response = await fetch(`http://localhost:3001/api/premium-content`);

      if (response.status === 402) {
        const invoice = await response.json();
        const transaction = {
          validUntil: Math.floor(Date.now() / 1000) + 60,
          messages: [{
            address: invoice.address || "0QBbtZtF0cYG5xj7JvpbUhHIkMqx3PhE4FVqAXJx9k-Ljy8_",
            amount: invoice.amount || "10000000",
            payload: invoice.payload
          }],
        };
        await tonConnectUI.sendTransaction(transaction);
      }
    } catch {
      try {
        const tx = {
          validUntil: Math.floor(Date.now() / 1000) + 60,
          messages: [{ address: "0QBbtZtF0cYG5xj7JvpbUhHIkMqx3PhE4FVqAXJx9k-Ljy8_", amount: "10000000" }],
        };
        await tonConnectUI.sendTransaction(tx);
      } catch {
        return;
      }
    }

    await loadNetwork(walletInfo.id, false);
  }, [expandedAddresses, userAddress, tonConnectUI, loadNetwork]);

  /* -- Search select -- */
  const handleSearchSelect = useCallback(async (wallet: WalletInfo) => {
    setSearchTerm("");
    await handleExpandNode(wallet);
  }, [setSearchTerm, handleExpandNode]);

  /* -- Update selected state -- */
  useEffect(() => {
    setNodes((nds: any[]) =>
      nds.map((n: any) => ({
        ...n,
        data: { ...n.data, selected: selected?.id === n.id, onSelect: (w: WalletInfo) => setSelected(w) },
      }))
    );
  }, [selected, setNodes]);

  /* -- Persist state -- */
  useEffect(() => {
    if (nodes.length > 0 && userAddress) {
      saveToStorage(nodes, edges, userAddress, expandedAddresses);
    }
  }, [nodes, edges, expandedAddresses, userAddress]);

  return (
    <>
      <main className="fixed left-0 sm:left-20 right-0 top-14 bottom-0 overflow-hidden"
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
          <div className="fixed top-16 right-20 z-50 w-72 bg-[#1a2535]/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
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
                        0.01 TON
                      </span>
                    )}
                  </div>
                )
              })
            ) : (
              <div className="px-4 py-4 text-sm text-center text-slate-400">
                No matching wallets...
              </div>
            )}
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_, node) => {
            const wi = (node.data as any).walletInfo as WalletInfo;
            if (wi) handleExpandNode(wi);
          }}
          onPaneClick={() => setSelected(null)}
          fitView
          minZoom={0.2}
          maxZoom={2.5}
        >
          <Background color="#1a2535" gap={26} size={1} />
          <Controls />
        </ReactFlow>
      </main>

      <DetailPanel
        wallet={selected ? {
          id: selected.id,
          name: selected.label,
          type: selected.isCenter ? "primary" : classifyVolume(selected.volumeTON),
          totalVolume: selected.volumeTON,
          totalTransactions: selected.txCount,
          topTokens: [],
          recentTransactions: [],
        } : null}
        onClose={() => setSelected(null)}
        isUnlocked={selected ? expandedAddresses.includes(selected.id) : false}
        onUnlock={() => { if (selected) handleExpandNode(selected); }}
      />
    </>
  );
}
