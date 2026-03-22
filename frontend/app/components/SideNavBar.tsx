"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { icon: "hub",                    label: "Network",  href: "/"              },
  { icon: "receipt_long",           label: "Txns",     href: "/transactions"  },
  { icon: "share",                  label: "Trace",    href: "/trace"         },
  { icon: "analytics",              label: "Analytics",href: "/analytics"     },
  { icon: "account_balance_wallet", label: "Wallet",   href: "/wallet/search" },
  { icon: "settings",               label: "Settings", href: "/settings"      },
];

export default function SideNavBar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* ── DESKTOP: left sidebar (≥ 640 px) ─────────────────────── */}
      <nav className="hidden sm:flex fixed left-0 top-14 bottom-0 w-20 flex-col items-center py-4 z-[46] bg-[#0B0E11] font-body tabular-nums">
        <div className="mb-8 text-center">
          <div className="text-[#00E5FF] font-black text-[10px] uppercase tracking-tighter mb-1">
            NetView
          </div>
          <div className="text-[#495057] text-[8px] uppercase">Navigate</div>
        </div>

        <div className="flex flex-col gap-2 w-full flex-1">
          {navItems.slice(0, 5).map((item) => (
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

          {/* Settings at bottom */}
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

      {/* ── MOBILE: bottom tab bar (< 640 px) ─────────────────────── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 h-16 z-[46] bg-[#0a0d10] border-t border-[#1c2d42]/60 flex items-center px-1">
        {navItems.slice(0, 4).map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-1 transition-all duration-200"
            >
              {/* pill indicator */}
              <span
                className="flex items-center justify-center w-12 h-7 rounded-full transition-all duration-200"
                style={active ? { background: "rgba(0,229,255,0.18)", border: "1px solid rgba(0,229,255,0.35)" } : {}}
              >
                <span
                  className="material-symbols-outlined text-[20px] transition-colors duration-200"
                  style={{
                    color: active ? "#00E5FF" : "#495057",
                    fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0",
                  }}
                >
                  {item.icon}
                </span>
              </span>
              <span
                className="text-[9px] font-bold uppercase tracking-widest leading-none transition-colors duration-200"
                style={{ color: active ? "#00E5FF" : "#495057" }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
