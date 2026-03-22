"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import TopNavBar from "../../components/TopNavBar";
import SideNavBar from "../../components/SideNavBar";

interface WalletInfo {
  address: string;
  balance_nano: string;
  balance_ton: string;
}

const MOCK_TOKENS = [
  { symbol: "TON", icon: "diamond", amount: "—", usd: "—" },
  { symbol: "USDT", icon: "monetization_on", amount: "12,500.00", usd: "$12,500" },
  { symbol: "NOT", icon: "notifications", amount: "1,200,000", usd: "$4,320" },
];

const MOCK_ACTIVITY = [
  { action: "Received", from: "EQAk...R9UO", value: "1,259 TON", time: "2 min ago", icon: "north_west", color: "text-primary-container" },
  { action: "Sent", from: "EQBb...Ljy8", value: "500 USDT", time: "15 min ago", icon: "south_east", color: "text-error" },
  { action: "Staked", from: "Pool #42", value: "5,000 TON", time: "1 hr ago", icon: "lock", color: "text-tertiary" },
  { action: "Swap", from: "DEX", value: "200 TON → 1.2M NOT", time: "3 hr ago", icon: "currency_exchange", color: "text-secondary" },
  { action: "Received", from: "EQD-...SLsq", value: "100 TON", time: "6 hr ago", icon: "north_west", color: "text-primary-container" },
];

export default function WalletPage() {
  const params = useParams();
  const address = params.address as string;

  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;

    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/api/wallet-info?address=${encodeURIComponent(address)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          // API might return raw number or object
          const result = data.result;
          if (typeof result === "number" || typeof result === "string") {
            const nano = String(result);
            setWallet({
              address,
              balance_nano: nano,
              balance_ton: (Number(nano) / 1e9).toFixed(4),
            });
          } else {
            setWallet(result);
          }
        } else {
          setError(data.error || "Unknown error");
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [address]);

  const truncAddr = address
    ? `${address.slice(0, 8)}...${address.slice(-6)}`
    : "";

  return (
    <>
      <TopNavBar />
      <SideNavBar />
      <main className="fixed left-0 sm:left-20 right-0 top-14 bottom-16 sm:bottom-0 bg-surface-container-lowest overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8">
          {/* Address Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-primary-container/10 border border-primary-container/30 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary-container">
                  account_balance_wallet
                </span>
              </div>
              <div>
                <h1 className="text-lg font-headline font-bold text-on-surface tracking-tight">
                  Wallet Explorer
                </h1>
                <code className="text-[10px] text-outline tabular-nums block">
                  {address}
                </code>
              </div>
            </div>
          </div>

          {/* Balance Card */}
          <div className="bg-surface border border-surface-container-highest p-6 mb-6">
            <div className="text-[9px] text-outline uppercase tracking-widest mb-2">
              TON Balance
            </div>
            {loading ? (
              <div className="text-sm text-secondary animate-pulse uppercase tracking-widest font-headline">
                Loading...
              </div>
            ) : error ? (
              <div className="text-sm text-error">{error}</div>
            ) : wallet ? (
              <div>
                <div className="text-3xl font-headline font-bold text-primary-container tabular-nums">
                  {Number(wallet.balance_ton).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  <span className="text-sm text-outline ml-2">TON</span>
                </div>
                <div className="text-[10px] text-outline tabular-nums mt-1">
                  {Number(wallet.balance_nano).toLocaleString()} nanotons
                </div>
              </div>
            ) : null}
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-px bg-surface-container-highest mb-6">
            <div className="bg-surface p-5">
              <div className="text-[9px] text-outline uppercase tracking-widest mb-1">
                Transactions
              </div>
              <div className="text-xl font-headline tabular-nums text-on-surface">
                247
              </div>
            </div>
            <div className="bg-surface p-5">
              <div className="text-[9px] text-outline uppercase tracking-widest mb-1">
                First Active
              </div>
              <div className="text-xl font-headline tabular-nums text-on-surface">
                2024
              </div>
            </div>
            <div className="bg-surface p-5">
              <div className="text-[9px] text-outline uppercase tracking-widest mb-1">
                Contract Type
              </div>
              <div className="text-xl font-headline text-on-surface">
                Wallet v4
              </div>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-2 gap-6">
            {/* Tokens */}
            <div className="bg-surface border border-surface-container-highest">
              <div className="px-6 py-4 border-b border-surface-container-highest">
                <h3 className="text-[10px] font-headline font-black tracking-widest uppercase text-outline">
                  Token Holdings
                </h3>
              </div>
              <div className="divide-y divide-surface-container-highest/50">
                {MOCK_TOKENS.map((t) => (
                  <div key={t.symbol} className="px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 bg-surface-container-high flex items-center justify-center">
                        <span className="material-symbols-outlined text-sm">{t.icon}</span>
                      </div>
                      <span className="text-xs font-bold uppercase">{t.symbol}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs tabular-nums font-headline">
                        {t.symbol === "TON" && wallet ? Number(wallet.balance_ton).toLocaleString(undefined, { maximumFractionDigits: 2 }) : t.amount}
                      </div>
                      <div className="text-[10px] text-outline tabular-nums">
                        {t.symbol === "TON" && wallet ? `$${(Number(wallet.balance_ton) * 3.45).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : t.usd}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-surface border border-surface-container-highest">
              <div className="px-6 py-4 border-b border-surface-container-highest">
                <h3 className="text-[10px] font-headline font-black tracking-widest uppercase text-outline">
                  Recent Activity
                </h3>
              </div>
              <div className="divide-y divide-surface-container-highest/50">
                {MOCK_ACTIVITY.map((a, i) => (
                  <div key={i} className="px-6 py-3 flex items-center gap-3">
                    <span className={`material-symbols-outlined text-lg ${a.color}`}>
                      {a.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between">
                        <span className="text-[10px] font-headline font-bold uppercase">
                          {a.action}
                        </span>
                        <span className="text-[10px] text-outline tabular-nums">
                          {a.time}
                        </span>
                      </div>
                      <div className="text-[10px] text-on-surface-variant truncate">
                        {a.from}
                      </div>
                      <div className="text-xs font-headline text-on-surface tabular-nums mt-0.5">
                        {a.value}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
