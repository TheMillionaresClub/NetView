"use client";

import { useEffect, useState, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import DetailPanel, { WalletData } from "./DetailPanel";

import { useTonConnectUI, useTonAddress } from "@tonconnect/ui-react";

/* ════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════ */
const calcRadius = (volume: number) =>
  Math.min(110, Math.max(25, Math.sqrt(volume) * 0.15)); // Radius max à 110, min à 25 pour aérer la carte de 30 personnes

const THEMES: Record<string, { ring: string; glow: string; bg: string }> = {
  primary:  { ring: "border-orange-400", glow: "shadow-[0_0_22px_rgba(249,115,22,.45)]",  bg: "bg-orange-900/60"  },
  whale:    { ring: "border-purple-400", glow: "shadow-[0_0_22px_rgba(168,85,247,.45)]",  bg: "bg-purple-900/60"  },
  trader:   { ring: "border-blue-400",   glow: "shadow-[0_0_22px_rgba(59,130,246,.45)]",  bg: "bg-blue-900/60"    },
  degen:    { ring: "border-green-400",  glow: "shadow-[0_0_22px_rgba(34,197,94,.45)]",   bg: "bg-green-900/60"   },
  investor: { ring: "border-cyan-400",   glow: "shadow-[0_0_22px_rgba(6,182,212,.45)]",   bg: "bg-cyan-900/60"    },
};
const theme = (t: string) => THEMES[t] ?? { ring: "border-slate-400", glow: "shadow-sm", bg: "bg-slate-800/60" };
const EMOJI: Record<string, string> = { primary:"◉", whale:"◎", trader:"⟳", degen:"⚡", investor:"◈" };

function fmtVol(v: number) {
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M TON";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "K TON";
  return v + " TON";
}

/* ════════════════════════════════════════════════════════
   CUSTOM NODE
════════════════════════════════════════════════════════ */
type NodeData = {
  name: string;
  volume: number;
  radius: number;
  raw: WalletData;
  selected: boolean;
  onSelect: (w: WalletData) => void;
};

const PersonNode = ({ data }: { data: NodeData }) => {
  const { radius, raw, selected, onSelect } = data;
  const t = theme(raw.type);
  const isMe = raw.id === "me";

  return (
    <div
      onClick={() => onSelect(raw)}
      className={`
        relative flex flex-col items-center justify-center
        rounded-full border-2 backdrop-blur-sm cursor-pointer
        transition-all duration-200 select-none
        text-white overflow-hidden
        ${isMe ? "bg-blue-600/80 border-blue-300 shadow-[0_0_30px_rgba(59,130,246,0.8)] z-10" : `${t.bg} ${t.ring} ${t.glow}`}
        ${selected
          ? "scale-110 border-4 brightness-125"
          : "hover:scale-105 hover:brightness-110"}
      `}
      style={{ width: radius * 2, height: radius * 2 }}
    >
      <span className="text-[10px] opacity-50 leading-none mb-0.5">
        {isMe ? "⭐" : EMOJI[raw.type] ?? "◎"}
      </span>
      <span className="font-bold text-xs text-center px-2 w-full truncate leading-tight">
        {data.name}
      </span>
      {!isMe && (
        <span className="text-[10px] opacity-75 font-mono mt-0.5 tracking-wide">
          {fmtVol(data.volume)}
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

/* ════════════════════════════════════════════════════════
   LOCAL STORAGE PERSISTENCE
════════════════════════════════════════════════════════ */
const LS_KEY = "bubblemap-state";

type SavedState = {
  nodePositions: Record<string, { x: number; y: number }>;
  edges: any[];
  unlockedWallets: string[];
};

/** Decompress a gzip-compressed base64url string back to JSON */
async function decompressFromUrl(b64url: string): Promise<SavedState | null> {
  try {
    // base64url → standard base64
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    const padding = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const binary = atob(b64 + padding);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));

    const ds = new DecompressionStream("gzip");
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();
    const decompressed = await new Response(ds.readable).text();
    return JSON.parse(decompressed);
  } catch {
    return null;
  }
}

function loadSaved(): SavedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveToStorage(nodes: any[], edges: any[], unlockedWallets: string[]) {
  try {
    const nodePositions: Record<string, { x: number; y: number }> = {};
    for (const n of nodes) {
      nodePositions[n.id] = n.position;
    }
    localStorage.setItem(LS_KEY, JSON.stringify({ nodePositions, edges, unlockedWallets }));
  } catch { /* quota exceeded — ignore */ }
}

/* ════════════════════════════════════════════════════════
   BUBBLE MAP
════════════════════════════════════════════════════════ */
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
  const [selected, setSelected]          = useState<WalletData | null>(null);
  
  const [allWalletsDb, setAllWalletsDb]  = useState<WalletData[]>([]);

  const saved = useMemo(() => loadSaved(), []);
  const [unlockedWallets, setUnlockedWallets] = useState<string[]>(saved?.unlockedWallets ?? []);

  const nodeTypes = useMemo(() => ({ person: PersonNode }), []);
  const [tonConnectUI] = useTonConnectUI();
  const userAddress = useTonAddress();

  const searchResults = allWalletsDb.filter((wallet) => 
    wallet.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    wallet.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  /* ── 1. CHARGEMENT INITIAL (La Galaxy de 30 users) ── */
  useEffect(() => {
    // Check for shared view in URL params first, then fall back to localStorage
    const loadState = async (): Promise<SavedState | null> => {
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get("view");
      if (viewParam) {
        const shared = await decompressFromUrl(viewParam);
        if (shared) {
          // Save shared state to localStorage so it persists
          saveToStorage([], shared.edges, shared.unlockedWallets);
          // Clean the URL so the param doesn't stick around
          window.history.replaceState({}, "", window.location.pathname);
          return shared;
        }
      }
      return loadSaved();
    };

    loadState().then((savedState) => {
      // Update unlocked wallets from loaded state
      if (savedState?.unlockedWallets && savedState.unlockedWallets.length > 0) {
        setUnlockedWallets(savedState.unlockedWallets);
      }

      fetch("/data.json")
        .then((r) => r.json())
        .then((data: WalletData[]) => {
          setAllWalletsDb(data);

          const mainNode = {
            id: "me",
            type: "person",
            position: savedState?.nodePositions?.["me"] ?? { x: 0, y: 0 },
            data: {
              name: userAddress ? "Mon Wallet" : "Non Connecté",
              volume: 0, 
              radius: 50,
              raw: { id: "me", type: "primary", name: "Mon Wallet", totalVolume: 0, totalTransactions: 0, topTokens: [], recentTransactions: [] },
              selected: false,
              onSelect: setSelected,
            },
          };

          const radiusOrbit = 450;
          const newNodes = data.map((p, i) => {
            const r = calcRadius(p.totalVolume);
            const angle = (i / data.length) * 2 * Math.PI; 
            const jitter = (Math.random() - 0.5) * 150;
            
            // Use saved position if available, otherwise compute fresh
            const defaultPos = {
              x: Math.cos(angle) * (radiusOrbit + jitter),
              y: Math.sin(angle) * (radiusOrbit + jitter),
            };
            
            return {
              id: p.id,
              type: "person",
              position: savedState?.nodePositions?.[p.id] ?? defaultPos,
              data: {
                name: p.name,
                volume: p.totalVolume,
                radius: r,
                raw: p,
                selected: false,
                onSelect: setSelected,
              },
            };
          });

          setNodes([mainNode, ...newNodes]);

          // Restore saved edges for previously unlocked wallets
          if (savedState?.edges && savedState.edges.length > 0) {
            setEdges(savedState.edges);
          }
        });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setNodes, setEdges, userAddress]);

  /* ── 2. LOGIQUE DU PAIEMENT ── */
  const triggerBackendRequest = async (walletData: WalletData) => {
    try {
      const response = await fetch(`http://localhost:3001/api/routes/premium-content`);

      if (response.status === 402) {
        const invoice = await response.json(); 
        const transaction = {
          validUntil: Math.floor(Date.now() / 1000) + 60,
          messages: [{
            address: invoice.address || "EQD__________________________________________0vo",
            amount: invoice.amount || "10000000",
            payload: invoice.payload
          }],
        };
        await tonConnectUI.sendTransaction(transaction);
        return generateMockEdges(walletData);
      }

      if (response.ok) return await response.json();

    } catch (error) {
      const mockTransaction = {
        validUntil: Math.floor(Date.now() / 1000) + 60,
        messages: [{ address: "EQD__________________________________________0vo", amount: "10000000" }],
      };
      
      try {
        await tonConnectUI.sendTransaction(mockTransaction);
        return generateMockEdges(walletData);
      } catch (txError) {
        return null; 
      }
    }
  };

  /* ── 3. GÉNÉRATION DES LIENS (Full Network) ── */
  const generateMockEdges = (wallet: WalletData) => {
    const txs = wallet.recentTransactions || [];
    if (txs.length === 0) return [];

    // On regroupe les transactions par destinataire ("with")
    const groupedByTarget: Record<string, any[]> = {};
    txs.forEach(tx => {
      const targetId = tx.with === "me" ? "me" : tx.with;
      if (!groupedByTarget[targetId]) groupedByTarget[targetId] = [];
      groupedByTarget[targetId].push(tx);
    });

    // Pour chaque personne dans son historique, on crée UN lien
    const newEdges = Object.keys(groupedByTarget).map(targetId => {
      const targetTxs = groupedByTarget[targetId];
      
      let totalSent = 0;
      let totalReceived = 0;
      let tokenStr = "TON";

      targetTxs.forEach(tx => {
        if (tx.action === "SEND") totalSent += tx.amount;
        if (tx.action === "RECEIVE") totalReceived += tx.amount;
        tokenStr = tx.token;
      });

      const isBidirectional = totalSent > 0 && totalReceived > 0;
      const isSending = totalSent > 0 && totalReceived === 0;

      // Design dynamique
      let color = isBidirectional ? '#a855f7' : (isSending ? '#ef4444' : '#22c55e');
      let label = isBidirectional 
        ? `↑ ${totalSent} | ↓ ${totalReceived} ${tokenStr}`
        : `${isSending ? totalSent : totalReceived} ${tokenStr}`;

      return {
        id: `edge-${wallet.id}-${targetId}`,
        // La source est toujours celui qu'on inspecte pour la cohérence, sauf si on reçoit uniquement
        source: isSending || isBidirectional ? wallet.id : targetId,
        target: isSending || isBidirectional ? targetId : wallet.id,
        animated: true,
        label: label,
        style: { stroke: color, strokeWidth: 2.5 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: color },
        ...(isBidirectional && {
          markerStart: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: color }
        }),
        labelStyle: { fill: '#fff', fontWeight: 700, fontSize: 10 },
        labelBgStyle: { fill: '#1a2535', fillOpacity: 0.9 },
        labelBgPadding: [8, 4],
        labelBgBorderRadius: 4,
      };
    });

    return newEdges;
  };

  /* ── 4. L'ACTION AU CLIC ── */
  const handleSearchSelect = async (wallet: WalletData) => {
    setSearchTerm(""); 

    if (!userAddress) {
      alert("⚠️ Veuillez connecter votre wallet TON en haut à droite d'abord !");
      return;
    }

    if (unlockedWallets.includes(wallet.id)) {
      alert(`✅ Les liens pour ${wallet.name} sont déjà affichés sur la carte !`);
      setSelected(wallet);
      return;
    }

    // 🛡️ ANTI-ARNAQUE : On vérifie s'il y a au moins une transaction dans son historique
    if (!wallet.recentTransactions || wallet.recentTransactions.length === 0) {
      alert(`❌ Ce wallet n'a aucun historique de transaction détecté. Paiement annulé.`);
      return;
    }

    // Si le test passe, on paie
    const newEdges = await triggerBackendRequest(wallet);
    
    if (newEdges && newEdges.length > 0) {
      setUnlockedWallets((prev) => [...prev, wallet.id]);
      setEdges((currentEdges: any) => [...currentEdges, ...newEdges]);
    }
  };

  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, selected: selected?.id === n.id, onSelect: setSelected },
      }))
    );
  }, [selected, setNodes]);

  /* ── PERSIST STATE TO LOCAL STORAGE ── */
  useEffect(() => {
    if (nodes.length > 0) {
      saveToStorage(nodes, edges, unlockedWallets);
    }
  }, [nodes, edges, unlockedWallets]);

  return (
    <>
      <main className="fixed left-20 right-0 top-14 bottom-0 overflow-hidden"
            style={{ background: "#080d14" }}>
        
        {searchTerm.length > 0 && (
          <div className="fixed top-16 right-20 z-50 w-72 bg-[#1a2535]/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
            {searchResults.length > 0 ? (
              searchResults.map((wallet) => {
                const isUnlocked = unlockedWallets.includes(wallet.id);
                
                return (
                  <div
                    key={wallet.id}
                    onClick={() => handleSearchSelect(wallet)}
                    className="px-4 py-3 hover:bg-slate-800 cursor-pointer border-b border-slate-700/50 flex justify-between items-center group transition-colors"
                  >
                    <span className="font-bold text-sm text-white group-hover:text-blue-400 transition-colors">
                      {wallet.name}
                    </span>
                    {isUnlocked ? (
                      <span className="text-[10px] font-mono text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded">
                        Débloqué
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded">
                        0.01 TON
                      </span>
                    )}
                  </div>
                )
              })
            ) : (
              <div className="px-4 py-4 text-sm text-center text-slate-400">
                Aucun wallet trouvé...
              </div>
            )}
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onPaneClick={() => setSelected(null)}
          fitView
          minZoom={0.2}
          maxZoom={2.5}
        >
          <Background color="#1a2535" gap={26} size={1} />
          <Controls />
        </ReactFlow>
      </main>

      <DetailPanel wallet={selected} onClose={() => setSelected(null)} />
    </>
  );
}