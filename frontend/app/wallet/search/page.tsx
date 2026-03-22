"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function WalletSearchPage() {
  const [address, setAddress] = useState("");
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (address.trim()) {
      router.push(`/wallet/${encodeURIComponent(address.trim())}`);
    }
  };

  const recentWallets = [
    { address: "EQD...abc1", label: "Karim — Primary", type: "primary" },
    { address: "EQB...xyz2", label: "Alice — Whale", type: "whale" },
    { address: "EQC...def3", label: "Thomas — Trader", type: "trader" },
    { address: "EQA...ghi4", label: "Sarah — Degen", type: "degen" },
    { address: "EQE...jkl5", label: "Marc — Investor", type: "investor" },
  ];

  const typeColors: Record<string, string> = {
    primary: "#00E5FF",
    whale: "#7C4DFF",
    trader: "#FF6D00",
    degen: "#FF1744",
    investor: "#00E676",
  };

  return (
    <main className="min-h-screen bg-[#0B0E11] text-[#E0E0E0] pl-0 sm:pl-20 pt-14 pb-14 sm:pb-0 font-body">
      <div className="max-w-2xl mx-auto py-16 px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="material-symbols-outlined text-[#00E5FF] text-5xl mb-4 block">
            account_balance_wallet
          </span>
          <h1 className="text-3xl font-black font-heading text-white mb-2">
            Wallet Explorer
          </h1>
          <p className="text-[#888] text-sm">
            Enter a TON wallet address to view balance, tokens, and transaction
            history.
          </p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="mb-12">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#495057]">
                search
              </span>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="EQD... or UQ... (TON address)"
                className="w-full pl-12 pr-4 py-4 rounded-xl bg-[#181B20] border border-[#23272B] text-white placeholder-[#495057] focus:border-[#00E5FF] focus:outline-none transition-colors text-sm font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={!address.trim()}
              className="px-8 py-4 rounded-xl bg-[#00E5FF] text-[#0B0E11] font-bold text-sm hover:bg-[#00B8D4] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Explore
            </button>
          </div>
        </form>

        {/* Recent Wallets */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#495057] mb-4">
            Recent Wallets
          </h2>
          <div className="flex flex-col gap-2">
            {recentWallets.map((w) => (
              <button
                key={w.address}
                onClick={() =>
                  router.push(`/wallet/${encodeURIComponent(w.address)}`)
                }
                className="flex items-center gap-4 px-4 py-3 rounded-xl bg-[#181B20] border border-[#23272B] hover:border-[#00E5FF]/30 transition-all text-left group"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    backgroundColor: `${typeColors[w.type]}20`,
                    color: typeColors[w.type],
                  }}
                >
                  {w.label[0]}
                </div>
                <div className="flex-1">
                  <div className="text-sm text-white font-medium group-hover:text-[#00E5FF] transition-colors">
                    {w.label}
                  </div>
                  <div className="text-xs text-[#495057] font-mono">
                    {w.address}
                  </div>
                </div>
                <span className="material-symbols-outlined text-[#495057] group-hover:text-[#00E5FF] transition-colors text-lg">
                  arrow_forward
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
