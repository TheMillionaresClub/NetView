const assets = [
  { icon: "currency_bitcoin", name: "WBTC", amount: "12.45" },
  { icon: "monetization_on", name: "USDC", amount: "450,230.11" },
  { icon: "token", name: "SOL", amount: "2,104.90" },
];

const transactions = [
  {
    icon: "south_east",
    iconColor: "text-error",
    type: "Transfer Out",
    time: "2m ago",
    detail: "To: Binance_Hot_01",
    amount: "- 50,000 USDC",
    amountColor: "text-error",
  },
  {
    icon: "north_west",
    iconColor: "text-primary-container",
    type: "Swap In",
    time: "14m ago",
    detail: "From: Uniswap V3",
    amount: "+ 2.4 WBTC",
    amountColor: "text-primary-container",
  },
  {
    icon: "north_west",
    iconColor: "text-primary-container",
    type: "Receive",
    time: "1h ago",
    detail: "From: 0x82...a11",
    amount: "+ 1,000 SOL",
    amountColor: "text-primary-container",
  },
];


export default function DetailsPanel() {
  return (
    <aside className="fixed right-0 top-14 bottom-0 w-80 bg-surface border-l border-none shadow-2xl flex flex-col z-40 overflow-y-auto">
      /{/* Header Section */}
      <div className="p-6 border-b border-surface-container-highest">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="font-headline font-bold text-lg tracking-tight text-primary">
              Nebula.eth
            </h2>
            <code className="text-[10px] text-outline tabular-nums">
              0x71C765...d897
            </code>
          </div>
          <div className="bg-primary-container/10 border border-primary-container/20 px-2 py-1">
            <span className="text-[10px] font-black text-primary-container">
              WHALE
            </span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-px bg-surface-container-highest">
          <div className="bg-surface p-3">
            <div className="text-[9px] text-outline uppercase mb-1">
              Risk Score
            </div>
            <div className="text-xl font-headline tabular-nums text-error">
              12.4{" "}
              <span className="text-[10px] text-outline font-normal">LOW</span>
            </div>
          </div>
          <div className="bg-surface p-3">
            <div className="text-[9px] text-outline uppercase mb-1">
              Centrality
            </div>
            <div className="text-xl font-headline tabular-nums text-secondary">
              0.88
            </div>
          </div>
        </div>
      </div>

      {/* Token Balances */}
      <div className="p-6 border-b border-surface-container-highest">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-[10px] font-black tracking-widest uppercase text-outline">
            Assets
          </h3>
          <span className="text-[10px] tabular-nums text-primary">
            $1,244,902.00
          </span>
        </div>
        <div className="space-y-2">
          {assets.map((asset) => (
            <div
              key={asset.name}
              className="flex justify-between items-center group"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-surface-container-high flex items-center justify-center">
                  <span className="material-symbols-outlined text-sm">
                    {asset.icon}
                  </span>
                </div>
                <span className="text-xs font-medium uppercase">
                  {asset.name}
                </span>
              </div>
              <span className="text-xs tabular-nums font-headline">
                {asset.amount}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction Feed */}
      <div className="p-6">
        <h3 className="text-[10px] font-black tracking-widest uppercase text-outline mb-4">
          Recent Flow
        </h3>
        <div className="space-y-4">
          {transactions.map((tx, i) => (
            <div key={i} className="flex gap-3">
              <div className="mt-1">
                <span
                  className={`material-symbols-outlined ${tx.iconColor} text-lg`}
                >
                  {tx.icon}
                </span>
              </div>
              <div>
                <div className="flex justify-between w-48">
                  <span className="text-[10px] font-headline font-bold uppercase">
                    {tx.type}
                  </span>
                  <span className="text-[10px] tabular-nums text-outline">
                    {tx.time}
                  </span>
                </div>
                <div className="text-[10px] tabular-nums text-on-surface-variant truncate w-48">
                  {tx.detail}
                </div>
                <div
                  className={`text-xs font-headline ${tx.amountColor} mt-0.5`}
                >
                  {tx.amount}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
