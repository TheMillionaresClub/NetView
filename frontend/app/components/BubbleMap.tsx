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

// --- 1. LES MATHS POUR LA TAILLE ---
const calculateRadius = (volume: number) => {
  const MIN_RADIUS = 30;  // Taille minimale pour les petits portefeuilles
  const MAX_RADIUS = 120; // Le fameux CAP maximal pour ne pas casser l'écran

  // On utilise la racine carrée pour que l'aire soit proportionnelle au volume
  // Le multiplicateur (0.15) est à ajuster selon si tes volumes sont énormes ou petits
  const rawRadius = Math.sqrt(volume) * 0.15; 

  // On s'assure que le rayon reste entre MIN_RADIUS et MAX_RADIUS
  return Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, rawRadius));
};

// --- 2. LE DESIGN DE LA PERSONNE (Custom Node) ---
const PersonNode = ({ data }: { data: any }) => {
  const radius = data.radius;

  // On passe sur des couleurs Tailwind pures avec des fonds sombres (900/40) 
  // et des bordures vives (400) pour un contraste parfait.
  const getTheme = (type: string) => {
    switch(type) {
      case 'whale': 
        return 'bg-purple-900/60 border-purple-400 text-purple-50 shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:bg-purple-800/80';
      case 'trader': 
        return 'bg-blue-900/60 border-blue-400 text-blue-50 shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:bg-blue-800/80';
      case 'degen': 
        return 'bg-green-900/60 border-green-400 text-green-50 shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:bg-green-800/80';
      case 'primary': 
        return 'bg-orange-900/60 border-orange-400 text-orange-50 shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:bg-orange-800/80';
      default: 
        return 'bg-slate-800/60 border-slate-400 text-slate-50 shadow-sm hover:bg-slate-700/80';
    }
  };

  return (
    <div
      className={`relative flex flex-col items-center justify-center rounded-full border-2 backdrop-blur-sm transition-all duration-300 hover:scale-105 cursor-pointer overflow-hidden ${getTheme(data.raw.type)}`}
      style={{
        width: radius * 2,
        height: radius * 2,
      }}
    >
      {/* On limite la taille du texte et on force la coupure avec 'truncate' si le nom est trop long */}
      <span className="font-bold text-xs sm:text-sm text-center px-3 w-full truncate drop-shadow-md">
        {data.name}
      </span>
      
      {/* Le montant en plus petit, bien centré */}
      <span className="text-[10px] sm:text-xs opacity-90 font-mono mt-1 font-semibold tracking-wider">
        ${data.volume >= 1000 ? (data.volume / 1000).toFixed(1) + "k" : data.volume}
      </span>

      {/* Handles cachés pour React Flow */}
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
};

// --- 3. LE COMPOSANT PRINCIPAL ---
export default function BubbleMap() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const nodeTypes = useMemo(() => ({ person: PersonNode }), []);

  useEffect(() => {
    fetch("/data.json")
      .then((res) => res.json())
      .then((data) => {
        // On transforme le JSON en "Nodes" compréhensibles par React Flow
        const newNodes = data.map((person: any, index: number) => {
          const r = calculateRadius(person.totalVolume);
          
          // Génération de positions pour éparpiller les bulles sur l'écran
          // On fait une petite grille mathématique dynamique
          const x = (index % 3) * 300 + Math.random() * 50;
          const y = Math.floor(index / 3) * 250 + Math.random() * 50;

          return {
            id: person.id,
            type: "person",
            position: { x, y },
            data: {
              name: person.name,
              volume: person.totalVolume,
              radius: r,
              raw: person, // On garde toutes les infos (tokens, transactions) pour le futur panneau de détails !
            },
          };
        });

        setNodes(newNodes);
      });
  }, [setNodes]);

  return (
    <main className="fixed left-20 right-80 top-14 bottom-0 bg-surface-container-lowest grid-bg overflow-hidden">
      <ReactFlow
        nodes={nodes}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        fitView
        minZoom={0.2}
        maxZoom={2}
      >
        <Background color="#374151" gap={20} size={1} />
        <Controls className="fill-white" />
      </ReactFlow>
    </main>
  );
}