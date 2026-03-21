"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { icon: "hub", label: "Network", href: "/" },
  { icon: "receipt_long", label: "Txns", href: "/transactions" },
  { icon: "share", label: "Trace", href: "/trace" },
  { icon: "analytics", label: "Analytics", href: "/analytics" },
  { icon: "account_balance_wallet", label: "Wallet", href: "/wallet/search" },
];

export default function SideNavBar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <nav className="hidden sm:flex fixed left-0 top-14 bottom-0 w-20 flex-col items-center py-4 z-40 bg-[#0B0E11] font-body tabular-nums">
      <div className="mb-8 text-center">
        <div className="text-[#00E5FF] font-black text-[10px] uppercase tracking-tighter mb-1">
          NetView
        </div>
        <div className="text-[#495057] text-[8px] uppercase">Navigate</div>
      </div>
      <div className="flex flex-col gap-2 w-full flex-1">
        {navItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={
              isActive(item.href)
                ? "bg-[#272A2E] text-[#00E5FF] border-l-2 border-[#00E5FF] w-full py-3 flex flex-col items-center gap-1 transition-all duration-200"
                : "text-[#495057] hover:text-[#C3F5FF] hover:bg-[#1a1d21] w-full py-3 flex flex-col items-center gap-1 border-l-2 border-transparent transition-all duration-200"
            }
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span className="text-[9px] font-bold uppercase tracking-tighter">
              {item.label}
            </span>
          </Link>
        ))}
        <div className="flex-1" />
        <Link
          href="/settings"
          className={
            isActive("/settings")
              ? "bg-[#272A2E] text-[#00E5FF] border-l-2 border-[#00E5FF] w-full py-3 flex flex-col items-center gap-1 transition-all duration-200"
              : "text-[#495057] hover:text-[#C3F5FF] hover:bg-[#1a1d21] w-full py-3 flex flex-col items-center gap-1 border-l-2 border-transparent transition-all duration-200"
          }
        >
          <span className="material-symbols-outlined">settings</span>
          <span className="text-[9px] font-bold uppercase tracking-tighter">
            Settings
          </span>
        </Link>
      </div>
    </nav>
  );
}
