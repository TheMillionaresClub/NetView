"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTonConnectUI, useTonAddress, useTonWallet, CHAIN } from "@tonconnect/ui-react";
import TopNavBar from "../components/TopNavBar";
import SideNavBar from "../components/SideNavBar";

const EXPRESS_API = process.env.NEXT_PUBLIC_EXPRESS_API_URL || "http://localhost:3001";
const PAYMENT_ADDRESS = "0QBbtZtF0cYG5xj7JvpbUhHIkMqx3PhE4FVqAXJx9k-Ljy8_";

// ── Types matching Rust structs ──────────────────────────────────

interface NetworkStats {
  latest_block_seqno: number;
  latest_block_timestamp: number;
  tps_estimate: number;
  total_accounts: number | null;
  total_transactions_all_time: number | null;
  transactions_per_day: number | null;
  active_wallets_daily: number | null;
  active_wallets_monthly: number | null;
  validator_count: number;
  total_validator_stake_ton: number;
  annual_inflation_rate_pct: number | null;
  burned_per_day_ton: number | null;
  minted_per_day_ton: number | null;
  total_supply_ton: number | null;
}

interface MarketData {
  source: string;
  price_usd: number;
  price_btc: number | null;
  price_eth: number | null;
  market_cap_usd: number;
  fully_diluted_valuation_usd: number;
  volume_24h_usd: number;
  price_change_24h_pct: number;
  high_24h_usd: number;
  low_24h_usd: number;
  circulating_supply: number;
  total_supply: number;
}

interface BlockSummary {
  seqno: number;
  timestamp: number;
  tx_count: number;
  shard_count: number;
  workchain: number;
}

interface TransactionSummary {
  hash: string;
  lt: number;
  from: string;
  to: string;
  amount_ton: number | null;
  op_type: string;
  timestamp: number;
  fee_ton: number;
}

interface JettonListing {
  address: string;
  name: string;
  symbol: string;
  total_supply: string;
  decimals: number;
  description: string | null;
  image_url: string | null;
  mintable: boolean;
}

interface DexStats {
  name: string;
  tvl_usd: number;
  volume_24h_usd: number;
  pool_count: number;
  trade_count_24h: number;
}

interface PoolSummary {
  address: string;
  dex: string;
  token0_symbol: string;
  token1_symbol: string;
  tvl_usd: number;
  volume_24h_usd: number;
  apy: number | null;
}

interface DexTokenStats {
  symbol: string;
  address: string;
  price_usd: number;
  price_change_24h_pct: number;
  volume_24h_usd: number;
  market_cap_usd: number | null;
}

interface DexOverview {
  total_tvl_usd: number;
  total_volume_24h_usd: number;
  total_trades_24h: number;
  exchanges: DexStats[];
  top_pools: PoolSummary[];
  top_tokens: DexTokenStats[];
}

interface TonNetworkSnapshot {
  fetched_at_ms: number;
  network: NetworkStats | null;
  market: MarketData | null;
  latest_blocks: BlockSummary[];
  latest_transactions: TransactionSummary[];
  new_jettons: JettonListing[];
  dex: DexOverview | null;
  errors: { source_name: string; error: string }[];
}

interface StatsResponse {
  snapshot: TonNetworkSnapshot;
  sources_used: string[];
  sources_failed: { source_name: string; error: string }[];
  fetched_at_ms: number;
}

// ── Formatting helpers ───────────────────────────────────────────

function fmt(n: number | null | undefined, opts?: { decimals?: number; prefix?: string; suffix?: string }) {
  if (n == null) return "—";
  const d = opts?.decimals ?? 0;
  const str = n >= 1_000_000_000 ? (n / 1_000_000_000).toFixed(1) + "B"
    : n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + "M"
    : n >= 1_000 ? (n / 1_000).toFixed(1) + "K"
    : d > 0 ? n.toFixed(d) : n.toLocaleString();
  return (opts?.prefix ?? "") + str + (opts?.suffix ?? "");
}

function fmtUsd(n: number | null | undefined) {
  return fmt(n, { prefix: "$" });
}

function shortAddr(a: string) {
  if (!a || a.length <= 14) return a || "—";
  return a.slice(0, 6) + "..." + a.slice(-4);
}

function timeAgo(unix: number) {
  const diff = Math.floor(Date.now() / 1000) - unix;
  if (diff < 60) return diff + "s ago";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return Math.floor(diff / 86400) + "d ago";
}

// ── Active tab type ──────────────────────────────────────────────

type Tab = "overview" | "blocks" | "transactions" | "jettons" | "dex";

// ── Component ────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [hasAccess, setHasAccess] = useState(false);
  const [paying, setPaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StatsResponse | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const eventSourceRef = useRef<EventSource | null>(null);

  const [tonConnectUI] = useTonConnectUI();
  const userAddr = useTonAddress();
  const tonWallet = useTonWallet();
  const network = tonWallet?.account?.chain === "-239" ? "mainnet" : "testnet";

  // ── Payment flow ────────────────────────────────────────────
  const handlePay = useCallback(async () => {
    if (!userAddr) {
      setError("Connect your TON wallet first");
      return;
    }

    setPaying(true);
    setError(null);

    try {
      // 1. Send payment via TonConnect
      const tx = await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        network: network === "mainnet" ? CHAIN.MAINNET : CHAIN.TESTNET,
        messages: [{ address: PAYMENT_ADDRESS, amount: "10000000" }],
      });

      if (!tx.boc) throw new Error("Transaction was not signed");

      // 2. Payment confirmed — fetch data from the API
      setLoading(true);
      const resp = await fetch(`${EXPRESS_API}/api/ton-stats`);

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${resp.status}`);
      }

      const json = await resp.json();
      const result: StatsResponse = json.result ?? json;
      setData(result);
      setLastUpdate(Date.now());
      setHasAccess(true);

      // 3. Start SSE stream for real-time updates
      startStream();
    } catch (e: unknown) {
      setError((e as Error).message ?? "Payment failed");
    } finally {
      setPaying(false);
      setLoading(false);
    }
  }, [userAddr, tonConnectUI, network]);

  // ── SSE streaming ───────────────────────────────────────────
  const startStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `${EXPRESS_API}/api/ton-stats/stream`;
    const es = new EventSource(url);
    eventSourceRef.current = es;
    setStreaming(true);

    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "snapshot" || msg.type === "update") {
          const result = msg.data?.result ?? msg.data;
          setData(result);
          setLastUpdate(Date.now());
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      setStreaming(false);
      es.close();
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  const snap = data?.snapshot;
  const net = snap?.network;
  const market = snap?.market;

  // ── Payment wall ────────────────────────────────────────────
  if (!hasAccess) {
    return (
      <>
        <TopNavBar />
        <SideNavBar />
        <main className="fixed left-0 sm:left-20 right-0 top-14 bottom-16 sm:bottom-0 bg-surface-container-lowest overflow-y-auto">
          <div className="max-w-md mx-auto px-4 py-20 text-center space-y-6">
            <span className="material-symbols-outlined text-5xl text-primary-container">lock</span>
            <h1 className="text-2xl font-headline font-bold text-primary-container uppercase tracking-tight">
              Analytics Dashboard
            </h1>
            <p className="text-sm text-outline leading-relaxed">
              Real-time TON network intelligence — market data, blocks, transactions,
              jettons, and DEX activity from multiple sources.
            </p>
            <div className="bg-surface border border-surface-container-highest p-6 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-outline">Access cost</span>
                <span className="font-headline font-bold text-on-surface">0.01 TON</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-outline">Includes</span>
                <span className="font-headline font-bold text-on-surface">Real-time streaming</span>
              </div>
              <button
                onClick={handlePay}
                disabled={paying || !userAddr}
                className="w-full bg-primary-container text-on-primary-container py-3 px-4 font-headline font-bold uppercase text-sm tracking-widest hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {paying ? "Processing..." : !userAddr ? "Connect Wallet First" : "Pay & Access"}
              </button>
              {!userAddr && (
                <p className="text-[10px] text-outline">
                  Connect your TON wallet using the button in the top navigation bar.
                </p>
              )}
            </div>
            {error && (
              <div className="bg-error/10 border border-error/30 px-4 py-3">
                <p className="text-xs text-error">{error}</p>
              </div>
            )}
          </div>
        </main>
      </>
    );
  }

  // ── Loading state ───────────────────────────────────────────
  if (loading && !data) {
    return (
      <>
        <TopNavBar />
        <SideNavBar />
        <main className="fixed left-0 sm:left-20 right-0 top-14 bottom-16 sm:bottom-0 bg-surface-container-lowest flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-8 h-8 border-2 border-primary-container border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-outline uppercase tracking-widest">Fetching live data...</p>
          </div>
        </main>
      </>
    );
  }

  // ── Tabs ────────────────────────────────────────────────────
  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "overview", label: "Overview", icon: "dashboard" },
    { id: "blocks", label: "Blocks", icon: "grid_view" },
    { id: "transactions", label: "Txns", icon: "receipt_long" },
    { id: "jettons", label: "Jettons", icon: "token" },
    { id: "dex", label: "DEX", icon: "swap_horiz" },
  ];

  return (
    <>
      <TopNavBar />
      <SideNavBar />
      <main className="fixed left-0 sm:left-20 right-0 top-14 bottom-16 sm:bottom-0 bg-surface-container-lowest overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-5 sm:py-8 space-y-6">

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
            <div className="flex items-center gap-3">
              {streaming && (
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse" />
                  <span className="text-[10px] text-primary-container uppercase tracking-widest">Live</span>
                </div>
              )}
              {lastUpdate && (
                <div className="bg-surface-container-high px-3 py-1.5 shrink-0">
                  <span className="text-[10px] text-outline uppercase tracking-widest">
                    Updated {timeAgo(Math.floor(lastUpdate / 1000))}
                  </span>
                </div>
              )}
              {data?.sources_failed && data.sources_failed.length > 0 && (
                <div className="bg-error/10 px-3 py-1.5 shrink-0" title={data.sources_failed.map(e => `${e.source_name}: ${e.error}`).join("\n")}>
                  <span className="text-[10px] text-error uppercase tracking-widest">
                    {data.sources_failed.length} source{data.sources_failed.length > 1 ? "s" : ""} failed
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Tab nav ── */}
          <div className="flex gap-0 border-b border-surface-container-highest overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-[10px] uppercase tracking-widest font-headline font-bold transition-colors shrink-0 ${
                  activeTab === tab.id
                    ? "text-primary-container border-b-2 border-primary-container"
                    : "text-outline hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-sm">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Overview tab ── */}
          {activeTab === "overview" && (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-surface-container-highest">
                {[
                  { label: "TON Price", value: market ? `$${market.price_usd.toFixed(2)}` : "—", icon: "paid", change: market ? `${market.price_change_24h_pct >= 0 ? "+" : ""}${market.price_change_24h_pct.toFixed(1)}%` : "" },
                  { label: "Market Cap", value: fmtUsd(market?.market_cap_usd), icon: "account_balance", change: "" },
                  { label: "24h Volume", value: fmtUsd(market?.volume_24h_usd), icon: "trending_up", change: "" },
                  { label: "TPS", value: net ? net.tps_estimate.toFixed(1) : "—", icon: "speed", change: "" },
                  { label: "Validators", value: net ? net.validator_count.toLocaleString() : "—", icon: "security", change: "" },
                  { label: "Total Stake", value: net ? fmt(net.total_validator_stake_ton, { suffix: " TON" }) : "—", icon: "diamond", change: "" },
                  { label: "Latest Block", value: net ? `#${net.latest_block_seqno.toLocaleString()}` : "—", icon: "grid_view", change: "" },
                  { label: "Active Wallets", value: fmt(net?.active_wallets_daily), icon: "group", change: "" },
                ].map((stat) => (
                  <div key={stat.label} className="bg-surface p-4 sm:p-5">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="material-symbols-outlined text-sm text-outline">{stat.icon}</span>
                      <span className="text-[8px] sm:text-[9px] text-outline uppercase tracking-widest leading-tight">
                        {stat.label}
                      </span>
                    </div>
                    <div className="text-lg sm:text-xl font-headline font-bold tabular-nums text-on-surface">
                      {stat.value}
                    </div>
                    {stat.change && (
                      <div className={`text-[10px] tabular-nums mt-1 ${
                        stat.change.startsWith("+") ? "text-primary-container" : "text-error"
                      }`}>
                        {stat.change}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Market + DEX Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {/* Market Detail */}
                <div className="bg-surface border border-surface-container-highest">
                  <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-surface-container-highest">
                    <h3 className="text-[10px] font-headline font-black tracking-widest uppercase text-outline">
                      Market Data {market ? `(${market.source})` : ""}
                    </h3>
                  </div>
                  <div className="divide-y divide-surface-container-highest/50">
                    {market && [
                      ["Circulating Supply", fmt(market.circulating_supply, { suffix: " TON" })],
                      ["Total Supply", fmt(market.total_supply, { suffix: " TON" })],
                      ["FDV", fmtUsd(market.fully_diluted_valuation_usd)],
                      ["24h High", `$${market.high_24h_usd.toFixed(2)}`],
                      ["24h Low", `$${market.low_24h_usd.toFixed(2)}`],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between px-4 sm:px-6 py-2.5">
                        <span className="text-[10px] text-outline uppercase tracking-widest">{label}</span>
                        <span className="text-xs tabular-nums font-headline">{value}</span>
                      </div>
                    ))}
                    {!market && (
                      <div className="px-4 sm:px-6 py-4 text-xs text-outline">No market data available</div>
                    )}
                  </div>
                </div>

                {/* DEX Summary */}
                <div className="bg-surface border border-surface-container-highest">
                  <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-surface-container-highest">
                    <h3 className="text-[10px] font-headline font-black tracking-widest uppercase text-outline">
                      DEX Overview
                    </h3>
                  </div>
                  {snap?.dex ? (
                    <div className="divide-y divide-surface-container-highest/50">
                      <div className="flex items-center justify-between px-4 sm:px-6 py-2.5">
                        <span className="text-[10px] text-outline uppercase tracking-widest">Total TVL</span>
                        <span className="text-xs tabular-nums font-headline">{fmtUsd(snap.dex.total_tvl_usd)}</span>
                      </div>
                      <div className="flex items-center justify-between px-4 sm:px-6 py-2.5">
                        <span className="text-[10px] text-outline uppercase tracking-widest">24h Volume</span>
                        <span className="text-xs tabular-nums font-headline">{fmtUsd(snap.dex.total_volume_24h_usd)}</span>
                      </div>
                      {snap.dex.exchanges.map((ex) => (
                        <div key={ex.name} className="flex items-center justify-between px-4 sm:px-6 py-2.5">
                          <span className="text-[10px] text-outline uppercase tracking-widest">{ex.name}</span>
                          <span className="text-xs tabular-nums font-headline">TVL {fmtUsd(ex.tvl_usd)} / Vol {fmtUsd(ex.volume_24h_usd)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 sm:px-6 py-4 text-xs text-outline">No DEX data available</div>
                  )}
                </div>
              </div>

              {/* Network Detail */}
              {net && (
                <div className="bg-surface border border-surface-container-highest">
                  <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-surface-container-highest">
                    <h3 className="text-[10px] font-headline font-black tracking-widest uppercase text-outline">
                      Network Stats
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-surface-container-highest/50">
                    {[
                      ["Total Accounts", fmt(net.total_accounts)],
                      ["Txs / Day", fmt(net.transactions_per_day)],
                      ["Monthly Active", fmt(net.active_wallets_monthly)],
                      ["Total Supply", fmt(net.total_supply_ton, { suffix: " TON" })],
                      ["Inflation", net.annual_inflation_rate_pct != null ? `${net.annual_inflation_rate_pct.toFixed(1)}%` : "—"],
                      ["Burned / Day", net.burned_per_day_ton != null ? fmt(net.burned_per_day_ton, { suffix: " TON" }) : "—"],
                      ["Minted / Day", net.minted_per_day_ton != null ? fmt(net.minted_per_day_ton, { suffix: " TON" }) : "—"],
                      ["Block Time", net.latest_block_timestamp ? timeAgo(net.latest_block_timestamp) : "—"],
                    ].map(([label, value]) => (
                      <div key={label} className="px-4 sm:px-6 py-3 text-center">
                        <div className="text-[8px] text-outline uppercase tracking-widest mb-1">{label}</div>
                        <div className="text-sm font-headline font-bold tabular-nums">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Blocks tab ── */}
          {activeTab === "blocks" && (
            <div className="bg-surface border border-surface-container-highest">
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-surface-container-highest">
                <h3 className="text-[10px] font-headline font-black tracking-widest uppercase text-outline">
                  Latest Masterchain Blocks ({snap?.latest_blocks.length ?? 0})
                </h3>
              </div>
              <div className="hidden sm:grid grid-cols-[80px_1fr_80px_80px_80px] gap-2 px-6 py-2 border-b border-surface-container-highest text-[9px] font-headline font-bold uppercase tracking-widest text-outline">
                <span>Seqno</span><span>Time</span><span>Txs</span><span>Shards</span><span>Chain</span>
              </div>
              {snap?.latest_blocks.map((b) => (
                <div key={b.seqno} className="border-b border-surface-container-highest/50 hover:bg-surface-container-low/30 transition-colors">
                  <div className="hidden sm:grid grid-cols-[80px_1fr_80px_80px_80px] gap-2 px-6 py-3 items-center">
                    <span className="text-xs tabular-nums text-primary-container font-mono">#{b.seqno.toLocaleString()}</span>
                    <span className="text-xs tabular-nums text-outline">{timeAgo(b.timestamp)}</span>
                    <span className="text-xs tabular-nums font-headline">{b.tx_count}</span>
                    <span className="text-xs tabular-nums font-headline">{b.shard_count}</span>
                    <span className="text-xs tabular-nums text-outline">{b.workchain}</span>
                  </div>
                  <div className="sm:hidden px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-primary-container">#{b.seqno.toLocaleString()}</span>
                      <span className="text-[10px] text-outline">{timeAgo(b.timestamp)}</span>
                    </div>
                    <div className="flex gap-3 mt-1">
                      <span className="text-[10px] text-outline">{b.tx_count} txs</span>
                      <span className="text-[10px] text-outline">{b.shard_count} shards</span>
                    </div>
                  </div>
                </div>
              ))}
              {(!snap?.latest_blocks || snap.latest_blocks.length === 0) && (
                <div className="px-6 py-8 text-center text-xs text-outline">No block data available</div>
              )}
            </div>
          )}

          {/* ── Transactions tab ── */}
          {activeTab === "transactions" && (
            <div className="bg-surface border border-surface-container-highest">
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-surface-container-highest">
                <h3 className="text-[10px] font-headline font-black tracking-widest uppercase text-outline">
                  Latest Network Transactions ({snap?.latest_transactions.length ?? 0})
                </h3>
              </div>
              <div className="hidden sm:grid grid-cols-[100px_1fr_1fr_80px_80px_70px] gap-2 px-6 py-2 border-b border-surface-container-highest text-[9px] font-headline font-bold uppercase tracking-widest text-outline">
                <span>Hash</span><span>From</span><span>To</span><span>Amount</span><span>Fee</span><span>Time</span>
              </div>
              {snap?.latest_transactions.slice(0, 50).map((tx) => (
                <div key={tx.hash} className="border-b border-surface-container-highest/50 hover:bg-surface-container-low/30 transition-colors">
                  <div className="hidden sm:grid grid-cols-[100px_1fr_1fr_80px_80px_70px] gap-2 px-6 py-3 items-center">
                    <span className="text-xs tabular-nums text-primary-container font-mono truncate" title={tx.hash}>{tx.hash.slice(0, 10)}...</span>
                    <span className="text-xs tabular-nums font-mono truncate text-outline" title={tx.from}>{shortAddr(tx.from)}</span>
                    <span className="text-xs tabular-nums font-mono truncate text-outline" title={tx.to}>{shortAddr(tx.to)}</span>
                    <span className="text-xs tabular-nums font-headline">{tx.amount_ton != null ? tx.amount_ton.toFixed(2) : "—"}</span>
                    <span className="text-xs tabular-nums text-outline">{tx.fee_ton.toFixed(4)}</span>
                    <span className="text-xs tabular-nums text-outline">{timeAgo(tx.timestamp)}</span>
                  </div>
                  <div className="sm:hidden px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-primary-container">{tx.hash.slice(0, 12)}...</span>
                      <span className="text-[10px] text-outline">{timeAgo(tx.timestamp)}</span>
                    </div>
                    <div className="flex gap-3 mt-1 text-[10px]">
                      <span className="text-outline">{shortAddr(tx.from)} → {shortAddr(tx.to)}</span>
                      {tx.amount_ton != null && <span className="font-headline">{tx.amount_ton.toFixed(2)} TON</span>}
                    </div>
                  </div>
                </div>
              ))}
              {(!snap?.latest_transactions || snap.latest_transactions.length === 0) && (
                <div className="px-6 py-8 text-center text-xs text-outline">No transaction data available</div>
              )}
            </div>
          )}

          {/* ── Jettons tab ── */}
          {activeTab === "jettons" && (
            <div className="bg-surface border border-surface-container-highest">
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-surface-container-highest">
                <h3 className="text-[10px] font-headline font-black tracking-widest uppercase text-outline">
                  New Jettons ({snap?.new_jettons.length ?? 0})
                </h3>
              </div>
              <div className="hidden sm:grid grid-cols-[1fr_80px_80px_60px_60px] gap-2 px-6 py-2 border-b border-surface-container-highest text-[9px] font-headline font-bold uppercase tracking-widest text-outline">
                <span>Name</span><span>Symbol</span><span>Supply</span><span>Decimals</span><span>Mintable</span>
              </div>
              {snap?.new_jettons.slice(0, 50).map((j) => (
                <div key={j.address} className="border-b border-surface-container-highest/50 hover:bg-surface-container-low/30 transition-colors">
                  <div className="hidden sm:grid grid-cols-[1fr_80px_80px_60px_60px] gap-2 px-6 py-3 items-center">
                    <div className="min-w-0 flex items-center gap-2">
                      {j.image_url && <img src={j.image_url} alt="" className="w-5 h-5 rounded-full shrink-0" loading="lazy" />}
                      <div className="min-w-0">
                        <span className="text-xs font-headline truncate block">{j.name || "Unnamed"}</span>
                        <span className="text-[10px] text-outline font-mono truncate block">{shortAddr(j.address)}</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold uppercase">{j.symbol || "—"}</span>
                    <span className="text-xs tabular-nums text-outline">{j.total_supply ? fmt(parseFloat(j.total_supply) / Math.pow(10, j.decimals)) : "—"}</span>
                    <span className="text-xs tabular-nums text-outline">{j.decimals}</span>
                    <span className={`text-[10px] uppercase font-bold ${j.mintable ? "text-primary-container" : "text-outline"}`}>
                      {j.mintable ? "Yes" : "No"}
                    </span>
                  </div>
                  <div className="sm:hidden px-4 py-3">
                    <div className="flex items-center gap-2">
                      {j.image_url && <img src={j.image_url} alt="" className="w-5 h-5 rounded-full shrink-0" loading="lazy" />}
                      <span className="text-xs font-headline truncate">{j.name || "Unnamed"}</span>
                      <span className="text-[10px] font-bold text-outline uppercase ml-auto">{j.symbol || "—"}</span>
                    </div>
                    <div className="flex gap-3 mt-1 text-[10px] text-outline">
                      <span>{shortAddr(j.address)}</span>
                      <span>{j.mintable ? "Mintable" : "Fixed"}</span>
                    </div>
                  </div>
                </div>
              ))}
              {(!snap?.new_jettons || snap.new_jettons.length === 0) && (
                <div className="px-6 py-8 text-center text-xs text-outline">No jetton data available</div>
              )}
            </div>
          )}

          {/* ── DEX tab ── */}
          {activeTab === "dex" && snap?.dex && (
            <>
              {/* DEX Exchange Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {snap.dex.exchanges.map((ex) => (
                  <div key={ex.name} className="bg-surface border border-surface-container-highest p-4 sm:p-6">
                    <h4 className="text-sm font-headline font-bold uppercase mb-3">{ex.name}</h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[9px] text-outline uppercase tracking-widest block">TVL</span>
                        <span className="font-headline font-bold">{fmtUsd(ex.tvl_usd)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-outline uppercase tracking-widest block">24h Volume</span>
                        <span className="font-headline font-bold">{fmtUsd(ex.volume_24h_usd)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-outline uppercase tracking-widest block">Pools</span>
                        <span className="font-headline font-bold">{ex.pool_count}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-outline uppercase tracking-widest block">24h Trades</span>
                        <span className="font-headline font-bold">{ex.trade_count_24h.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Top Pools */}
              <div className="bg-surface border border-surface-container-highest">
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-surface-container-highest">
                  <h3 className="text-[10px] font-headline font-black tracking-widest uppercase text-outline">
                    Top Pools by TVL
                  </h3>
                </div>
                <div className="hidden sm:grid grid-cols-[1fr_80px_80px_80px_60px] gap-2 px-6 py-2 border-b border-surface-container-highest text-[9px] font-headline font-bold uppercase tracking-widest text-outline">
                  <span>Pair</span><span>DEX</span><span>TVL</span><span>Volume</span><span>APY</span>
                </div>
                {snap.dex.top_pools.slice(0, 20).map((pool, i) => (
                  <div key={pool.address + i} className="border-b border-surface-container-highest/50 hover:bg-surface-container-low/30 transition-colors">
                    <div className="hidden sm:grid grid-cols-[1fr_80px_80px_80px_60px] gap-2 px-6 py-3 items-center">
                      <span className="text-xs font-headline font-bold">{pool.token0_symbol} / {pool.token1_symbol}</span>
                      <span className="text-[10px] text-outline uppercase">{pool.dex}</span>
                      <span className="text-xs tabular-nums font-headline">{fmtUsd(pool.tvl_usd)}</span>
                      <span className="text-xs tabular-nums font-headline">{fmtUsd(pool.volume_24h_usd)}</span>
                      <span className="text-xs tabular-nums text-primary-container">{pool.apy != null ? `${pool.apy.toFixed(1)}%` : "—"}</span>
                    </div>
                    <div className="sm:hidden px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-headline font-bold">{pool.token0_symbol}/{pool.token1_symbol}</span>
                        <span className="text-[10px] text-outline uppercase">{pool.dex}</span>
                      </div>
                      <div className="flex gap-3 mt-1 text-[10px]">
                        <span className="text-outline">TVL {fmtUsd(pool.tvl_usd)}</span>
                        <span className="text-outline">Vol {fmtUsd(pool.volume_24h_usd)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Top Tokens */}
              <div className="bg-surface border border-surface-container-highest">
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-surface-container-highest">
                  <h3 className="text-[10px] font-headline font-black tracking-widest uppercase text-outline">
                    Top DEX Tokens by Volume
                  </h3>
                </div>
                <div className="hidden sm:grid grid-cols-[1fr_80px_80px_80px] gap-2 px-6 py-2 border-b border-surface-container-highest text-[9px] font-headline font-bold uppercase tracking-widest text-outline">
                  <span>Token</span><span>Price</span><span>24h Change</span><span>Volume</span>
                </div>
                {snap.dex.top_tokens.slice(0, 20).map((tok, i) => (
                  <div key={tok.address + i} className="border-b border-surface-container-highest/50 hover:bg-surface-container-low/30 transition-colors">
                    <div className="hidden sm:grid grid-cols-[1fr_80px_80px_80px] gap-2 px-6 py-3 items-center">
                      <span className="text-xs font-headline font-bold uppercase">{tok.symbol}</span>
                      <span className="text-xs tabular-nums font-headline">${tok.price_usd.toFixed(tok.price_usd < 0.01 ? 6 : 2)}</span>
                      <span className={`text-xs tabular-nums ${tok.price_change_24h_pct >= 0 ? "text-primary-container" : "text-error"}`}>
                        {tok.price_change_24h_pct >= 0 ? "+" : ""}{tok.price_change_24h_pct.toFixed(1)}%
                      </span>
                      <span className="text-xs tabular-nums font-headline">{fmtUsd(tok.volume_24h_usd)}</span>
                    </div>
                    <div className="sm:hidden px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-headline font-bold uppercase">{tok.symbol}</span>
                        <span className="text-xs tabular-nums">${tok.price_usd.toFixed(tok.price_usd < 0.01 ? 6 : 2)}</span>
                      </div>
                      <div className="flex gap-3 mt-1 text-[10px]">
                        <span className={tok.price_change_24h_pct >= 0 ? "text-primary-container" : "text-error"}>
                          {tok.price_change_24h_pct >= 0 ? "+" : ""}{tok.price_change_24h_pct.toFixed(1)}%
                        </span>
                        <span className="text-outline">Vol {fmtUsd(tok.volume_24h_usd)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {activeTab === "dex" && !snap?.dex && (
            <div className="bg-surface border border-surface-container-highest px-6 py-8 text-center text-xs text-outline">
              No DEX data available
            </div>
          )}

        </div>
      </main>
    </>
  );
}
