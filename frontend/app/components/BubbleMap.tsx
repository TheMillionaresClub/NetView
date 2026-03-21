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
export default function BubbleMap() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [selected, setSelected]          = useState<WalletData | null>(null);
  const nodeTypes = useMemo(() => ({ person: PersonNode }), []);

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
