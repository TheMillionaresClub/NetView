"use client";

import TopNavBar from "../components/TopNavBar";
import SideNavBar from "../components/SideNavBar";

const NETWORK_STATS = [
  { label: "Total Wallets Tracked", value: "1,247",     icon: "group",        change: "+12%"  },
  { label: "24h Volume",            value: "$4.2M",     icon: "trending_up",  change: "+8.3%" },
  { label: "Active Addresses",      value: "389",       icon: "hub",          change: "+3.1%" },
  { label: "Avg Tx Value",          value: "1,205 TON", icon: "diamond",      change: "-2.4%" },
];

const TOP_WALLETS = [
  { rank: 1, address: "EQD-...SLsq", label: "Whale #1",    balance: "97,919 TON", volume: "$2.1M",  type: "whale"    },
  { rank: 2, address: "EQAk...R9UO", label: "Staker",      balance: "45,200 TON", volume: "$890K",  type: "investor" },
  { rank: 3, address: "EQBb...Ljy8", label: "DEX Bot",     balance: "12,500 TON", volume: "$650K",  type: "trader"   },
  { rank: 4, address: "EQCX...mK4w", label: "LP Provider", balance: "8,100 TON",  volume: "$340K",  type: "investor" },
  { rank: 5, address: "EQFp...n7Yw", label: "Collector",   balance: "3,400 TON",  volume: "$120K",  type: "degen"    },
];

const TOKEN_FLOWS = [
  { token: "TON",  inflow: "$1.8M", outflow: "$1.2M", net: "+$600K",  direction: "positive" },
  { token: "USDT", inflow: "$890K", outflow: "$920K", net: "-$30K",   direction: "negative" },
  { token: "NOT",  inflow: "$340K", outflow: "$110K", net: "+$230K",  direction: "positive" },
  { token: "DOGS", inflow: "$120K", outflow: "$95K",  net: "+$25K",   direction: "positive" },
  { token: "STON", inflow: "$78K",  outflow: "$180K", net: "-$102K",  direction: "negative" },
];

const RISK_ALERTS = [
  { severity: "high",   message: "Unusual outflow detected from EQD-...SLsq — 50,000 TON in 2 hrs", time: "12 min ago" },
  { severity: "medium", message: "New whale EQFp...n7Yw accumulated 3,400 TON in 24h",              time: "1 hr ago"   },
  { severity: "low",    message: "DEX bot EQBb...Ljy8 increased swap frequency by 300%",             time: "3 hr ago"   },
];

const SEVERITY_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  high:   { bg: "bg-error/10",        text: "text-error",        dot: "bg-error"        },
  medium: { bg: "bg-[#ffd740]/10",    text: "text-[#ffd740]",    dot: "bg-[#ffd740]"    },
  low:    { bg: "bg-outline/10",      text: "text-outline",      dot: "bg-outline"      },
};

const TYPE_COLOR: Record<string, string> = {
  whale:    "text-[#a855f7]",
  investor: "text-[#06b6d4]",
  trader:   "text-[#3b82f6]",
  degen:    "text-[#22c55e]",
};

export default function AnalyticsPage() {
  return (
    <>
      <TopNavBar />
      <SideNavBar />
      <main className="fixed left-0 sm:left-20 right-0 top-14 bottom-16 sm:bottom-0 bg-surface-container-lowest overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-5 sm:py-8 space-y-6">

          {/* ── Header ── */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-headline font-bold text-primary-container tracking-tight uppercase">
                Analytics
              </h1>
              <p className="text-[10px] text-outline mt-0.5 uppercase tracking-widest">
                TON Network Intelligence Dashboard
              </p>
            </div>
            <div className="bg-surface-container-high px-3 py-1.5 shrink-0">
              <span className="text-[10px] text-outline uppercase tracking-widest">Last 24h</span>
            </div>
          </div>

          {/* ── Stats Grid: 2 cols mobile / 4 cols desktop ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-surface-container-highest">
            {NETWORK_STATS.map((stat) => (
              <div key={stat.label} className="bg-surface p-4 sm:p-5">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="material-symbols-outlined text-sm text-outline">{stat.icon}</span>
                  <span className="text-[8px] sm:text-[9px] text-outline uppercase tracking-widest leading-tight">
                    {stat.label}
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-headline font-bold tabular-nums text-on-surface">
                  {stat.value}
                </div>
                <div className={`text-[10px] tabular-nums mt-1 ${
                  stat.change.startsWith("+") ? "text-primary-container" : "text-error"
                }`}>
                  {stat.change}
                </div>
              </div>
            ))}
          </div>

          {/* ── Top Wallets + Risk Alerts: stacked mobile / side-by-side desktop ── */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 sm:gap-6">

            {/* Top Wallets */}
            <div className="sm:col-span-3 bg-surface border border-surface-container-highest">
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-surface-container-highest">
                <h3 className="text-[10px] font-headline font-black tracking-widest uppercase text-outline">
                  Top Wallets by Volume
                </h3>
              </div>

              {/* Desktop table header */}
              <div className="hidden sm:grid grid-cols-[28px_1fr_110px_80px_80px] gap-2 px-6 py-2 border-b border-surface-container-highest text-[9px] font-headline font-bold uppercase tracking-widest text-outline">
                <span>#</span><span>Address</span><span>Balance</span><span>Volume</span><span>Type</span>
              </div>

              {TOP_WALLETS.map((w) => (
                <div key={w.rank} className="border-b border-surface-container-highest/50 hover:bg-surface-container-low/30 transition-colors">
                  {/* Desktop row */}
                  <div className="hidden sm:grid grid-cols-[28px_1fr_110px_80px_80px] gap-2 px-6 py-3 items-center">
                    <span className="text-xs tabular-nums text-outline">{w.rank}</span>
                    <div className="min-w-0">
                      <span className="text-xs tabular-nums text-primary-container font-mono">{w.address}</span>
                      <span className="text-[10px] text-outline ml-2">{w.label}</span>
                    </div>
                    <span className="text-xs tabular-nums font-headline">{w.balance}</span>
                    <span className="text-xs tabular-nums font-headline">{w.volume}</span>
                    <span className={`text-[10px] uppercase font-bold ${TYPE_COLOR[w.type] ?? "text-outline"}`}>{w.type}</span>
                  </div>
                  {/* Mobile row: compact 2-line card */}
                  <div className="sm:hidden flex items-center gap-3 px-4 py-3">
                    <span className="text-[10px] tabular-nums text-outline w-4 shrink-0">{w.rank}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-primary-container truncate">{w.address}</span>
                        <span className={`text-[9px] uppercase font-bold shrink-0 ${TYPE_COLOR[w.type] ?? "text-outline"}`}>{w.type}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-outline">{w.label}</span>
                        <span className="text-[10px] tabular-nums text-on-surface">{w.volume}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Risk Alerts */}
            <div className="sm:col-span-2 bg-surface border border-surface-container-highest">
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-surface-container-highest">
                <h3 className="text-[10px] font-headline font-black tracking-widest uppercase text-outline">
                  Risk Alerts
                </h3>
              </div>
              <div className="divide-y divide-surface-container-highest/50">
                {RISK_ALERTS.map((alert, i) => {
                  const s = SEVERITY_STYLE[alert.severity];
                  return (
                    <div key={i} className={`px-4 sm:px-6 py-3 sm:py-4 ${s.bg}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                        <span className={`text-[10px] font-bold uppercase ${s.text}`}>{alert.severity}</span>
                        <span className="text-[10px] text-outline ml-auto tabular-nums shrink-0">{alert.time}</span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">{alert.message}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Token Flow Table ── */}
          <div className="bg-surface border border-surface-container-highest">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-surface-container-highest">
              <h3 className="text-[10px] font-headline font-black tracking-widest uppercase text-outline">
                Token Flow Analysis (24h)
              </h3>
            </div>

            {/* Desktop header */}
            <div className="hidden sm:grid grid-cols-[80px_1fr_1fr_1fr_32px] gap-4 px-6 py-2 border-b border-surface-container-highest text-[9px] font-headline font-bold uppercase tracking-widest text-outline">
              <span>Token</span>
              <span className="text-right">Inflow</span>
              <span className="text-right">Outflow</span>
              <span className="text-right">Net</span>
              <span />
            </div>

            {TOKEN_FLOWS.map((tf) => (
              <div key={tf.token} className="border-b border-surface-container-highest/50 hover:bg-surface-container-low/30 transition-colors">
                {/* Desktop row */}
                <div className="hidden sm:grid grid-cols-[80px_1fr_1fr_1fr_32px] gap-4 px-6 py-3 items-center">
                  <span className="text-xs font-bold uppercase">{tf.token}</span>
                  <span className="text-xs tabular-nums text-primary-container text-right font-headline">{tf.inflow}</span>
                  <span className="text-xs tabular-nums text-error text-right font-headline">{tf.outflow}</span>
                  <span className={`text-xs tabular-nums text-right font-headline font-bold ${
                    tf.direction === "positive" ? "text-primary-container" : "text-error"
                  }`}>{tf.net}</span>
                  <span className={`material-symbols-outlined text-sm ${
                    tf.direction === "positive" ? "text-primary-container" : "text-error"
                  }`}>{tf.direction === "positive" ? "trending_up" : "trending_down"}</span>
                </div>
                {/* Mobile row: token + net prominent, inflow/outflow below */}
                <div className="sm:hidden px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold uppercase">{tf.token}</span>
                    <div className="flex items-center gap-1">
                      <span className={`text-sm font-headline font-bold tabular-nums ${
                        tf.direction === "positive" ? "text-primary-container" : "text-error"
                      }`}>{tf.net}</span>
                      <span className={`material-symbols-outlined text-sm ${
                        tf.direction === "positive" ? "text-primary-container" : "text-error"
                      }`}>{tf.direction === "positive" ? "trending_up" : "trending_down"}</span>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-[10px] text-outline">In: <span className="text-primary-container tabular-nums">{tf.inflow}</span></span>
                    <span className="text-[10px] text-outline">Out: <span className="text-error tabular-nums">{tf.outflow}</span></span>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </main>
    </>
  );
}
