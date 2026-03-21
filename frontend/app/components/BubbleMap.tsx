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
  const [unlockedWallets, setUnlockedWallets] = useState<string[]>([]);

  const nodeTypes = useMemo(() => ({ person: PersonNode }), []);
  const [tonConnectUI] = useTonConnectUI();
  const userAddress = useTonAddress();

  const searchResults = allWalletsDb.filter((wallet) => 
    wallet.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    wallet.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  /* ── 1. CHARGEMENT INITIAL (La Galaxy de 30 users) ── */
  useEffect(() => {
    fetch("/data.json")
      .then((r) => r.json())
      .then((data: WalletData[]) => {
        setAllWalletsDb(data);

        const mainNode = {
          id: "me",
          type: "person",
          position: { x: 0, y: 0 },
          data: {
            name: userAddress ? "Mon Wallet" : "Non Connecté",
            volume: 0, 
            radius: 50,
            raw: { id: "me", type: "primary", name: "Mon Wallet", totalVolume: 0, totalTransactions: 0, topTokens: [], recentTransactions: [] },
            selected: false,
            onSelect: setSelected,
          },
        };

        // On agrandit l'orbite pour faire rentrer 30 personnes (de 350 à 450)
        // Et on ajoute un petit décalage aléatoire pour que ça fasse moins "cercle parfait" et plus "galaxie"
        const radiusOrbit = 450;
        const newNodes = data.map((p, i) => {
          const r = calcRadius(p.totalVolume);
          const angle = (i / data.length) * 2 * Math.PI; 
          const jitter = (Math.random() - 0.5) * 150; // Décalage naturel
          
          return {
            id: p.id,
            type: "person",
            position: {
              x: Math.cos(angle) * (radiusOrbit + jitter),
              y: Math.sin(angle) * (radiusOrbit + jitter),
            },
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
      });
  }, [setNodes, userAddress]);

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

  /* ── 3. GÉNÉRATION DES LIENS (Anti-Overlap & Bidirectionnel) ── */
  const generateMockEdges = (wallet: WalletData) => {
    // 1. On récupère TOUTES les transactions entre lui et nous
    const myTxs = wallet.recentTransactions?.filter((tx: any) => tx.with === "me") || [];

    if (myTxs.length === 0) return [];

    let totalSent = 0;
    let totalReceived = 0;
    let tokenStr = "TON";

    // 2. On fait la somme des flux
    myTxs.forEach((tx: any) => {
      if (tx.action === "SEND") totalSent += tx.amount;
      if (tx.action === "RECEIVE") totalReceived += tx.amount;
      tokenStr = tx.token; // On suppose que c'est le même token pour simplifier
    });

    const isBidirectional = totalSent > 0 && totalReceived > 0;
    const isSendingOnly = totalSent > 0 && totalReceived === 0;

    // 3. Configuration dynamique du trait
    let edgeColor = '#ef4444'; // Rouge par défaut
    let edgeLabel = '';
    let sourceNode = 'me';
    let targetNode = wallet.id;

    if (isBidirectional) {
      edgeColor = '#a855f7'; // Violet (Couleur d'échange mutuel)
      edgeLabel = `↑ ${totalSent} | ↓ ${totalReceived} ${tokenStr}`;
      // La source reste "me", la cible est le wallet
    } else if (isSendingOnly) {
      edgeColor = '#ef4444'; // Rouge (Je donne)
      edgeLabel = `${totalSent} ${tokenStr}`;
    } else {
      edgeColor = '#22c55e'; // Vert (Je reçois)
      edgeLabel = `${totalReceived} ${tokenStr}`;
      sourceNode = wallet.id; // On inverse la source pour que la flèche pointe vers moi
      targetNode = 'me';
    }

    const newEdge = {
      id: `edge-me-${wallet.id}`,
      source: sourceNode,
      target: targetNode,
      animated: true,
      label: edgeLabel,
      style: { stroke: edgeColor, strokeWidth: 2.5 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20,
        color: edgeColor,
      },
      // 🆕 NOUVEAU : Si c'est bidirectionnel, on ajoute une flèche au point de départ aussi !
      ...(isBidirectional && {
        markerStart: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: edgeColor,
        }
      }),
      labelStyle: { fill: '#fff', fontWeight: 700, fontSize: 10 },
      labelBgStyle: { fill: '#1a2535', color: '#fff', fillOpacity: 0.9 },
      labelBgPadding: [8, 4],
      labelBgBorderRadius: 4,
    };

    return [newEdge];
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

    // 🛡️ 🆕 NOUVEAU : ANTI-ARNAQUE AVANCÉ
    // On vérifie s'il existe une transaction avec "me" dans son historique
    const hasTxWithMe = wallet.recentTransactions && wallet.recentTransactions.some((tx: any) => tx.with === "me");
    
    if (!hasTxWithMe) {
      alert(`🛡️ Protection activée : Vous n'avez aucune transaction directe avec ${wallet.name}. Paiement annulé pour protéger vos fonds !`);
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