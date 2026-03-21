"use client";

import { useEffect, useState, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import DetailPanel, { WalletData } from "./DetailPanel";

// 🆕 NOUVEAU : Import pour le paiement TON
import { useTonConnectUI, useTonAddress } from "@tonconnect/ui-react";

/* ════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════ */
const calcRadius = (volume: number) =>
  Math.min(110, Math.max(38, Math.sqrt(volume) * 0.15));

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
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
  return "$" + v;
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

  return (
    <div
      onClick={() => onSelect(raw)}
      className={`
        relative flex flex-col items-center justify-center
        rounded-full border-2 backdrop-blur-sm cursor-pointer
        transition-all duration-200 select-none
        text-white overflow-hidden
        ${t.bg} ${t.ring} ${t.glow}
        ${selected
          ? "scale-110 border-4 brightness-125"
          : "hover:scale-105 hover:brightness-110"}
      `}
      style={{ width: radius * 2, height: radius * 2 }}
    >
      <span className="text-[10px] opacity-50 leading-none mb-0.5">
        {EMOJI[raw.type] ?? "◎"}
      </span>
      <span className="font-bold text-xs text-center px-2 w-full truncate leading-tight">
        {data.name}
      </span>
      <span className="text-[10px] opacity-75 font-mono mt-0.5 tracking-wide">
        {fmtVol(data.volume)}
      </span>

      {selected && (
        <span className="absolute inset-0 rounded-full border-2 border-white/20 animate-ping pointer-events-none" />
      )}

      <Handle type="target" position={Position.Top}    style={{ opacity: 0, width: 0, height: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 0, height: 0 }} />
    </div>
  );
};

/* ════════════════════════════════════════════════════════
   BUBBLE MAP
════════════════════════════════════════════════════════ */

// 🆕 NOUVEAU : On récupère searchTerm et setSearchTerm depuis page.tsx
export default function BubbleMap({ 
  searchTerm, 
  setSearchTerm 
}: { 
  searchTerm: string; 
  setSearchTerm: (val: string) => void; 
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [selected, setSelected]          = useState<WalletData | null>(null);
  const nodeTypes = useMemo(() => ({ person: PersonNode }), []);

  // 🆕 NOUVEAU : Hooks pour le paiement
  const [tonConnectUI] = useTonConnectUI();
  const userAddress = useTonAddress();

  // 🆕 NOUVEAU : On filtre les bulles pour le menu de recherche
  const filteredNodes = nodes.filter((node) => 
    node.data.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    node.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 🆕 NOUVEAU : La logique x402 avec un "Filet de sécurité" (Mock) pour le Hackathon
  const triggerBackendRequest = async (nodeId: string) => {
    console.log(`🚀 Demande des liens premium pour la bulle ${nodeId}...`);

    try {
      // On tente d'appeler le vrai backend de tes potes
      const response = await fetch(`http://localhost:3001/api/routes/premium-content`);

      if (response.status === 402) {
        console.log("🔒 Paywall 402 détecté depuis le backend ! Lecture de la facture...");
        const invoice = await response.json(); 

        const transaction = {
          validUntil: Math.floor(Date.now() / 1000) + 60,
          messages: [{
            address: invoice.address || "EQD__________________________________________0vo",
            amount: invoice.amount || "10000000",
            payload: invoice.payload
          }],
        };

        console.log("Ouverture du wallet TON...");
        const paymentResult = await tonConnectUI.sendTransaction(transaction);
        console.log("✅ Paiement envoyé !", paymentResult);

        // On simule la réponse finale du backend avec des fausses données pour dessiner les traits
        return generateMockEdges(nodeId);
      }

      if (response.ok) {
        return await response.json();
      }

    } catch (error) {
      console.warn("⚠️ Le backend est injoignable ou en erreur. Passage en mode SIMULATION !");
      
      // MOCK : Si le backend est down, on simule quand même un paiement bidon de 0.01 TON
      // juste pour tester que ton wallet s'ouvre bien.
      const mockTransaction = {
        validUntil: Math.floor(Date.now() / 1000) + 60,
        messages: [{
          address: "EQD__________________________________________0vo", // Adresse de burn par défaut
          amount: "10000000", // 0.01 TON
        }],
      };
      
      try {
        console.log("Ouverture du wallet TON (Mode Simulation)...");
        await tonConnectUI.sendTransaction(mockTransaction);
        console.log("✅ Paiement simulé réussi !");
        
        // On génère les faux liens
        return generateMockEdges(nodeId);
      } catch (txError) {
        console.error("❌ Transaction annulée par l'utilisateur", txError);
        return null;
      }
    }
  };

  // 🆕 NOUVEAU : Le générateur de fausses connexions (à mettre juste en dessous)
  const generateMockEdges = (sourceNodeId: string) => {
    console.log(`Génération des faux liens pour ${sourceNodeId}...`);
    
    // On crée 3 fausses transactions partant du wallet cliqué vers d'autres wallets
    const fakeEdges = [
      {
        id: `edge-${sourceNodeId}-cex`,
        source: sourceNodeId,
        target: "cex", // L'ID de Binance_Hot dans ton data.json
        animated: true,
        label: "50,000 USDC", // On affichera ça sur le trait !
      },
      {
        id: `edge-${sourceNodeId}-user_4`,
        source: sourceNodeId,
        target: "user_4", // Sarah
        animated: true,
        label: "2.4 WBTC",
      },
      {
        id: `edge-${sourceNodeId}-center`,
        source: sourceNodeId,
        target: "center", // Le primary wallet
        animated: true,
        label: "150 SOL",
      }
    ];

    console.log("🔗 Liens récupérés :", fakeEdges);
    return fakeEdges;
  };

  // 🆕 NOUVEAU : Action au clic sur un résultat de la barre de recherche
  const handleSearchSelect = async (node: any) => {
    setSearchTerm(""); // Ferme le menu

    if (!userAddress) {
      alert("⚠️ Veuillez connecter votre wallet TON en haut à droite d'abord !");
      return;
    }

    await triggerBackendRequest(node.id);
  };

  /* ── charger data.json ── */
  useEffect(() => {
    fetch("/data.json")
      .then((r) => r.json())
      .then((data: WalletData[]) => {
        const newNodes = data.map((p, i) => {
          const r   = calcRadius(p.totalVolume);
          const col = i % 3;
          const row = Math.floor(i / 3);
          return {
            id:   p.id,
            type: "person",
            position: {
              x: col * 290 + (Math.random() - 0.5) * 60 + 60,
              y: row * 270 + (Math.random() - 0.5) * 60 + 60,
            },
            data: {
              name:     p.name,
              volume:   p.totalVolume,
              radius:   r,
              raw:      p,
              selected: false,
              onSelect: setSelected,
            },
          };
        });
        setNodes(newNodes);
      });
  }, [setNodes]);

  /* ── sync état sélection sur les nœuds ── */
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
        
        {/* 🆕 NOUVEAU : Le menu déroulant des résultats qui s'affiche sous la TopNavBar */}
        {searchTerm.length > 0 && (
          <div className="fixed top-16 right-20 z-50 w-72 bg-[#1a2535]/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
            {filteredNodes.length > 0 ? (
              filteredNodes.map((node) => (
                <div
                  key={node.id}
                  onClick={() => handleSearchSelect(node)}
                  className="px-4 py-3 hover:bg-slate-800 cursor-pointer border-b border-slate-700/50 flex justify-between items-center group transition-colors"
                >
                  <span className="font-bold text-sm text-white group-hover:text-blue-400 transition-colors">
                    {node.data.name}
                  </span>
                  <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded">
                    0.01 TON
                  </span>
                </div>
              ))
            ) : (
              <div className="px-4 py-4 text-sm text-center text-slate-400">
                Aucun wallet trouvé...
              </div>
            )}
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onPaneClick={() => setSelected(null)}
          fitView
          minZoom={0.2}
          maxZoom={2.5}
        >
          <Background color="#1a2535" gap={26} size={1} />
          <Controls />
        </ReactFlow>
      </main>

      {/* carte détail flottante */}
      <DetailPanel wallet={selected} onClose={() => setSelected(null)} />
    </>
  );
}