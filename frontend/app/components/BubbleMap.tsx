"use client";

import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css"; // Indispensable !

// --- 1. TON DESIGN DE BULLE (Custom Node) ---
// React Flow va utiliser ça pour dessiner chaque bulle avec tes classes Tailwind
const CryptoNode = ({ data }: { data: any }) => {
  return (
    <div className="relative group cursor-pointer flex flex-col items-center justify-center">
      {/* Handles cachés pour que les lignes puissent s'accrocher au centre */}
      <Handle type="target" position={Position.Top} className="opacity-0 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
      <Handle type="source" position={Position.Bottom} className="opacity-0 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
      
      {/* Ta boîte personnalisée */}
      <div className={data.boxClass}>
        <span className={`material-symbols-outlined ${data.iconClass}`} style={data.iconStyle}>
          {data.icon}
        </span>
      </div>
      
      {/* Ton label */}
      {data.label && <div className={data.labelClass}>{data.label}</div>}
    </div>
  );
};

// --- 2. TES DONNÉES CONVERTIES ---
// J'ai transformé tes % en coordonnées x,y arbitraires. Tu pourras les ajuster !
const initialNodes = [
  {
    id: "center",
    type: "crypto",
    position: { x: 400, y: 300 }, // C'était ton 50% 50%
    data: {
      icon: "account_balance_wallet",
      label: "0x...1234 (PRIMARY)",
      boxClass: "w-24 h-24 bg-primary-container border-4 border-surface shadow-[0_0_40px_rgba(0,229,255,0.4)] flex items-center justify-center rounded-lg",
      iconClass: "text-on-primary-container text-4xl",
      iconStyle: { fontVariationSettings: "'FILL' 1" },
      labelClass: "absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap bg-surface px-2 py-1 text-[10px] font-headline tracking-tighter border border-outline-variant",
    },
    zIndex: 10, // Ton zClass
  },
  {
    id: "cex",
    type: "crypto",
    position: { x: 200, y: 150 }, // 30% 30%
    data: {
      icon: "account_balance",
      label: "BINANCE_HOT",
      boxClass: "w-16 h-16 bg-secondary border-4 border-surface shadow-[0_0_20px_rgba(73,215,244,0.3)] flex items-center justify-center rounded-lg",
      iconClass: "text-on-secondary text-2xl",
      labelClass: "absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-surface-container-high px-2 py-0.5 text-[9px] font-headline",
    },
  },
  {
    id: "whale",
    type: "crypto",
    position: { x: 600, y: 200 }, // 70% 40%
    data: {
      icon: "water_drop",
      label: "WHALE_09",
      boxClass: "w-20 h-20 bg-primary border-4 border-surface shadow-[0_0_25px_rgba(195,245,255,0.3)] flex items-center justify-center rounded-lg",
      iconClass: "text-on-primary text-3xl",
      iconStyle: { fontVariationSettings: "'FILL' 1" },
      labelClass: "absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-surface-container-high px-2 py-0.5 text-[9px] font-headline",
    },
  },
  {
    id: "dex",
    type: "crypto",
    position: { x: 500, y: 450 }, // 60% 75%
    data: {
      icon: "swap_horiz",
      label: "UNISWAP_V3",
      boxClass: "w-14 h-14 bg-tertiary-container border-4 border-surface shadow-[0_0_20px_rgba(251,187,255,0.3)] flex items-center justify-center rounded-lg",
      iconClass: "text-on-tertiary-container text-xl",
      labelClass: "absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-surface-container-high px-2 py-0.5 text-[9px] font-headline",
    },
  },
  {
    id: "user",
    type: "crypto",
    position: { x: 150, y: 400 }, // 25% 65%
    data: {
      icon: "person",
      boxClass: "w-10 h-10 bg-surface-variant border-2 border-surface flex items-center justify-center rounded-lg",
      iconClass: "text-on-surface-variant text-base",
    },
  },
  {
    id: "contract",
    type: "crypto",
    position: { x: 350, y: 100 }, // 45% 20%
    data: {
      icon: "terminal",
      boxClass: "w-12 h-12 bg-transparent border-2 border-outline flex items-center justify-center rounded-lg",
      iconClass: "text-outline text-lg",
    },
  },
];

// --- 3. TES CONNEXIONS (Edges) ---
// React Flow relie les IDs entre eux. J'ai ajouté le paramètre `animated: true` pour le style !
const initialEdges = [
  { id: "e-center-cex", source: "center", target: "cex", animated: true, style: { stroke: "#00e5ff", strokeWidth: 2 } },
  { id: "e-center-whale", source: "center", target: "whale", animated: true, style: { stroke: "#00e5ff", strokeWidth: 2 } },
  { id: "e-center-dex", source: "center", target: "dex", animated: true, style: { stroke: "#00e5ff", strokeWidth: 2 } },
  { id: "e-center-user", source: "center", target: "user", animated: true, style: { stroke: "#00e5ff", strokeWidth: 2 } },
  { id: "e-center-contract", source: "center", target: "contract", animated: true, style: { stroke: "#00e5ff", strokeWidth: 2 } },
];

const legend = [
  { color: "bg-secondary", label: "CEX" },
  { color: "bg-primary", label: "WHALE" },
  { color: "bg-tertiary-container", label: "DEX" },
];

// --- 4. LE COMPOSANT PRINCIPAL ---
export default function BubbleMap() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  
  // On enregistre notre design pour que React Flow l'utilise
  const nodeTypes = useMemo(() => ({ crypto: CryptoNode }), []);

  return (
    // J'ai gardé tes classes pour le placement exact sur l'écran
    <main className="fixed left-20 right-80 top-14 bottom-0 bg-surface-container-lowest grid-bg overflow-hidden">
      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView // Va centrer automatiquement tout ton graphe à l'ouverture
        minZoom={0.5}
        maxZoom={2}
      >
        {/* Un fond plus interactif que le grid statique */}
        <Background color="#374151" gap={20} size={1} />
        <Controls className="fill-white" />
      </ReactFlow>

      {/* Ta légende flottante reste exactement au même endroit */}
      <div className="absolute bottom-6 left-6 flex gap-4 pointer-events-none z-50">
        {legend.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <div className={`w-2 h-2 ${item.color}`} />
            <span className="text-[9px] font-headline tracking-widest text-outline uppercase">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}