"use client";

const navItems = [
  { icon: "toll", label: "Solana", active: true },
  { icon: "hub", label: "TON", active: false },
  { icon: "filter_list", label: "Filters", active: false },
];

export default function SideNavBar() {
  return (
    <nav className="fixed left-0 top-14 bottom-0 w-20 flex flex-col items-center py-4 z-40 bg-[#0B0E11] font-body tabular-nums">
      <div className="mb-8 text-center">
        <div className="text-[#00E5FF] font-black text-[10px] uppercase tracking-tighter mb-1">
          Network
        </div>
        <div className="text-[#495057] text-[8px] uppercase">Active</div>
      </div>
      <div className="flex flex-col gap-6 w-full">
        {navItems.map((item) => (
          <button
            key={item.label}
            className={
              item.active
                ? "bg-[#272A2E] text-[#00E5FF] border-l-2 border-[#00E5FF] w-full py-3 flex flex-col items-center gap-1 scale-95 active:scale-90 transition-transform"
                : "text-[#495057] hover:text-[#C3F5FF] w-full py-3 flex flex-col items-center gap-1 scale-95 active:scale-90 transition-transform"
            }
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span className="text-[9px] font-bold uppercase tracking-tighter">
              {item.label}
            </span>
          </button>
        ))}
        <button className="text-[#495057] hover:text-[#C3F5FF] w-full py-3 flex flex-col items-center gap-1 scale-95 active:scale-90 transition-transform mt-auto">
          <span className="material-symbols-outlined">settings</span>
          <span className="text-[9px] font-bold uppercase tracking-tighter">
            Settings
          </span>
        </button>
      </div>
    </nav>
  );
}
