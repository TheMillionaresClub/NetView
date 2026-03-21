const nodes = [
  {
    id: "center",
    icon: "account_balance_wallet",
    label: "0x...1234 (PRIMARY)",
    style: { left: "50%", top: "50%", transform: "translate(-50%, -50%)" },
    boxClass:
      "w-24 h-24 bg-primary-container border-4 border-surface shadow-[0_0_40px_rgba(0,229,255,0.4)] flex items-center justify-center",
    iconClass: "text-on-primary-container text-4xl",
    iconStyle: { fontVariationSettings: "'FILL' 1" } as React.CSSProperties,
    labelClass:
      "absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap bg-surface px-2 py-1 text-[10px] font-headline tracking-tighter border border-outline-variant",
    zClass: "z-10",
  },
  {
    id: "cex",
    icon: "account_balance",
    label: "BINANCE_HOT",
    style: { left: "30%", top: "30%", transform: "translate(-50%, -50%)" },
    boxClass:
      "w-16 h-16 bg-secondary border-4 border-surface shadow-[0_0_20px_rgba(73,215,244,0.3)] flex items-center justify-center",
    iconClass: "text-on-secondary text-2xl",
    labelClass:
      "absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-surface-container-high px-2 py-0.5 text-[9px] font-headline",
  },
  {
    id: "whale",
    icon: "water_drop",
    label: "WHALE_09",
    style: { left: "70%", top: "40%", transform: "translate(-50%, -50%)" },
    boxClass:
      "w-20 h-20 bg-primary border-4 border-surface shadow-[0_0_25px_rgba(195,245,255,0.3)] flex items-center justify-center",
    iconClass: "text-on-primary text-3xl",
    iconStyle: { fontVariationSettings: "'FILL' 1" } as React.CSSProperties,
    labelClass:
      "absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-surface-container-high px-2 py-0.5 text-[9px] font-headline",
  },
  {
    id: "dex",
    icon: "swap_horiz",
    label: "UNISWAP_V3",
    style: { left: "60%", top: "75%", transform: "translate(-50%, -50%)" },
    boxClass:
      "w-14 h-14 bg-tertiary-container border-4 border-surface shadow-[0_0_20px_rgba(251,187,255,0.3)] flex items-center justify-center",
    iconClass: "text-on-tertiary-container text-xl",
    labelClass:
      "absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-surface-container-high px-2 py-0.5 text-[9px] font-headline",
  },
  {
    id: "user",
    icon: "person",
    style: { left: "25%", top: "65%", transform: "translate(-50%, -50%)" },
    boxClass:
      "w-10 h-10 bg-surface-variant border-2 border-surface flex items-center justify-center",
    iconClass: "text-on-surface-variant text-base",
  },
  {
    id: "contract",
    icon: "terminal",
    style: { left: "45%", top: "20%", transform: "translate(-50%, -50%)" },
    boxClass:
      "w-12 h-12 bg-transparent border-2 border-outline flex items-center justify-center",
    iconClass: "text-outline text-lg",
  },
];

const connections = [
  { x1: "50%", y1: "50%", x2: "30%", y2: "30%" },
  { x1: "50%", y1: "50%", x2: "70%", y2: "40%" },
  { x1: "50%", y1: "50%", x2: "60%", y2: "75%" },
  { x1: "50%", y1: "50%", x2: "25%", y2: "65%" },
  { x1: "50%", y1: "50%", x2: "45%", y2: "20%" },
];

const legend = [
  { color: "bg-secondary", label: "CEX" },
  { color: "bg-primary", label: "WHALE" },
  { color: "bg-tertiary-container", label: "DEX" },
];

export default function BubbleMap() {
  return (
    <main className="fixed left-20 right-80 top-14 bottom-0 bg-surface-container-lowest grid-bg overflow-hidden">
      {/* SVG Connections Layer */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {connections.map((c, i) => (
          <line
            key={i}
            opacity={0.3}
            stroke="#00e5ff"
            strokeDasharray="4"
            strokeWidth={1}
            x1={c.x1}
            y1={c.y1}
            x2={c.x2}
            y2={c.y2}
          />
        ))}
      </svg>

      {/* Nodes */}
      <div className="relative w-full h-full flex items-center justify-center">
        {nodes.map((node) => (
          <div
            key={node.id}
            className={`absolute group cursor-pointer ${node.zClass ?? ""}`}
            style={node.style}
          >
            <div className={node.boxClass}>
              <span
                className={`material-symbols-outlined ${node.iconClass}`}
                style={node.iconStyle}
              >
                {node.icon}
              </span>
            </div>
            {node.label && <div className={node.labelClass}>{node.label}</div>}
          </div>
        ))}
      </div>

      {/* Floating Metric Legend */}
      <div className="absolute bottom-6 left-6 flex gap-4 pointer-events-none">
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
