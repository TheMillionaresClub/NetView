"use client";

import { useState } from "react";
import TopNavBar from "../../components/TopNavBar";
import SideNavBar from "../../components/SideNavBar";

// ── Types matching WalletProfile from wallet-scraper ────────────────────────

interface SourceErrorReport {
  source_name: string;
  error: string;
}

interface DomainInsight {
  domain: string;
  expiry_lt: number | null;
}

interface TelegramInsight {
  username: string;
  purchase_date: number | null;
  fragment_url: string;
}

interface NftProfileData {
  getgems_username: string | null;
  nft_count: number;
  collections: string[];
}

interface JettonBalance {
  symbol: string;
  name: string | null;
  balance: string;
  usd_value: number | null;
  jetton_address: string | null;
}

interface JettonPortfolioData {
  balances: JettonBalance[];
}

interface LabelInsight {
  source: string;
  label: string;
  category: string | null;
}

interface RiskInsight {
  source: string;
  score: number;
  flags: string[];
}

interface AccountMeta {
  balance_ton: number;
  wallet_type: string;
  tx_count: number;
  is_active: boolean;
  last_activity: number | null;
  linked_name: string | null;
  icon_url: string | null;
  source: string;
}

interface FragmentInsight {
  username: string;
  price_ton: number | null;
  owner_wallet: string;
}

interface TelegramIdentityData {
  owned_usernames: string[];
  owned_phone_numbers: string[];
  dns_records: string[];
  linked_telegram: string | null;
  avatar_url: string | null;
}

interface CounterpartyIdentity {
  address: string;
  name: string;
  icon_url: string | null;
  is_wallet: boolean;
  role: string;
}

interface CounterpartyIdentitiesData {
  identities: CounterpartyIdentity[];
  events_scanned: number;
}

type WalletInsight =
  | { type: "TonDomain" } & DomainInsight
  | { type: "TelegramUsername" } & TelegramInsight
  | { type: "NftProfile" } & NftProfileData
  | { type: "JettonPortfolio" } & JettonPortfolioData
  | { type: "WalletLabel" } & LabelInsight
  | { type: "RiskScore" } & RiskInsight
  | { type: "AccountMeta" } & AccountMeta
  | { type: "FragmentListing" } & FragmentInsight
  | { type: "TelegramIdentity" } & TelegramIdentityData
  | { type: "CounterpartyIdentities" } & CounterpartyIdentitiesData;

interface WalletProfile {
  address: string;
  insights: WalletInsight[];
  errors: SourceErrorReport[];
  elapsed_ms: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const API = "http://localhost:3001";

function shortAddr(a: string) {
  return a.length > 20 ? a.slice(0, 8) + "..." + a.slice(-6) : a;
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-[#181B20] border border-[#23272B] p-5 space-y-4">
      <h2 className="text-[9px] font-black uppercase tracking-widest text-[#495057]">{title}</h2>
      {children}
    </div>
  );
}

// ── Preset wallet addresses for quick testing ───────────────────────────────

const PRESETS = [
  { label: "Testnet - Wallet A", addr: "0QBbtZtF0cYG5xj7JvpbUhHIkMqx3PhE4FVqAXJx9k-Ljy8_", net: "testnet" as const },
  { label: "Testnet - Wallet B", addr: "0QD1hNskAprdzNaWFYE46Np1AjF0bUa3eIBohc4BLXIYlEGV", net: "testnet" as const },
  { label: "Mainnet - Rich Wallet", addr: "EQACuz151snlY46PKdUOkyiCf0zzcxMsN6XmKQkSKZjkvyFH", net: "mainnet" as const },
  { label: "Mainnet - Normal", addr: "UQAGXzN4NqPhUUpHkK0iCQRwMWbR8rTAzQpgf4JKZwLYMjUK", net: "mainnet" as const },
  { label: "Mainnet - Telegram Identity", addr: "0:9b6aa17c715d8960129a15213f3c6702cbd7c815de1e61e4973ddeb6c3a61ddd", net: "mainnet" as const },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function WalletScraperPage() {
  const [address, setAddress] = useState(PRESETS[4].addr);
  const [network, setNetwork] = useState<"testnet" | "mainnet">(PRESETS[4].net);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<WalletProfile | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);

  const fetchProfile = async () => {
    if (!address.trim()) return;
    setLoading(true);
    setError(null);
    setProfile(null);
    setDurationMs(null);

    const t0 = performance.now();
    try {
      const params = new URLSearchParams({ address: address.trim(), network });
      const resp = await fetch(`${API}/api/wallet-scraper?${params}`);
      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.error ?? `HTTP ${resp.status}`);
      setProfile(data.result as WalletProfile);
    } catch (e: unknown) {
      setError((e as Error).message ?? "Unknown error");
    } finally {
      setDurationMs(Math.round(performance.now() - t0));
      setLoading(false);
    }
  };

  const accountMeta = profile?.insights.find((i) => i.type === "AccountMeta") as (WalletInsight & { type: "AccountMeta" }) | undefined;
  const identity = profile?.insights.find((i) => i.type === "TelegramIdentity") as (WalletInsight & { type: "TelegramIdentity" }) | undefined;
  const counterparties = profile?.insights.find((i) => i.type === "CounterpartyIdentities") as (WalletInsight & { type: "CounterpartyIdentities" }) | undefined;
  const nftProfile = profile?.insights.find((i) => i.type === "NftProfile") as (WalletInsight & { type: "NftProfile" }) | undefined;
  const jettonPortfolio = profile?.insights.find((i) => i.type === "JettonPortfolio") as (WalletInsight & { type: "JettonPortfolio" }) | undefined;
  const domains = profile?.insights.filter((i) => i.type === "TonDomain") as (WalletInsight & { type: "TonDomain" })[] | undefined;
  const labels = profile?.insights.filter((i) => i.type === "WalletLabel") as (WalletInsight & { type: "WalletLabel" })[] | undefined;

  return (
    <>
      <TopNavBar />
      <SideNavBar />
      <main className="fixed left-20 right-0 top-14 bottom-0 bg-[#0B0E11] text-[#E0E0E0] overflow-y-auto font-body">
        <div className="max-w-5xl mx-auto p-8 space-y-6">

          {/* Header */}
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-3">
              <span className="material-symbols-outlined text-[#7C4DFF] text-3xl">person_search</span>
              Wallet Scraper
            </h1>
            <p className="text-[#888] text-sm mt-1">
              Off-chain intelligence via{" "}
              <code className="text-[#7C4DFF] text-xs">/api/wallet-scraper</code>
              : Telegram identity, NFTs, jettons, DNS, explorer labels.
            </p>
          </div>

          {/* Input */}
          <div className="rounded-2xl bg-[#181B20] border border-[#23272B] p-5">
            {/* Presets */}
            <div className="flex flex-wrap gap-2 mb-4">
              {PRESETS.map((p) => (
                <button
                  key={p.addr}
                  onClick={() => { setAddress(p.addr); setNetwork(p.net); }}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all
                             border border-[#23272B] hover:border-[#7C4DFF]/50"
                  style={{
                    color: address === p.addr ? "#7C4DFF" : "#888",
                    background: address === p.addr ? "rgba(124,77,255,0.1)" : "#0B0E11",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-4 mb-4">
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-[#7C4DFF] mb-1.5 block">
                  Wallet Address
                </label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="UQ... / EQ... / 0Q... / 0:hex..."
                  className="w-full px-4 py-3 rounded-xl bg-[#0B0E11] border border-[#23272B]
                             text-white placeholder-[#495057] focus:border-[#7C4DFF] focus:outline-none
                             text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-[#495057] mb-1.5 block">
                  Network
                </label>
                <select
                  value={network}
                  onChange={(e) => setNetwork(e.target.value as "testnet" | "mainnet")}
                  className="w-full px-3 py-3 rounded-xl bg-[#0B0E11] border border-[#23272B]
                             text-white text-xs focus:outline-none focus:border-[#7C4DFF]"
                >
                  <option value="mainnet">Mainnet</option>
                  <option value="testnet">Testnet</option>
                </select>
              </div>
            </div>
            <button
              onClick={fetchProfile}
              disabled={loading || !address.trim()}
              className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider
                         transition-all duration-200 disabled:opacity-40"
              style={{ background: "rgba(124,77,255,0.15)", color: "#7C4DFF", border: "1px solid rgba(124,77,255,0.3)" }}
            >
              {loading ? "Scraping..." : "Scrape Wallet"}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl bg-[#FF1744]/10 border border-[#FF1744]/30 px-4 py-3 text-sm text-[#FF5252]">
              {error}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-3 py-10 justify-center">
              <svg className="animate-spin h-5 w-5 text-[#7C4DFF]" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
                  strokeDasharray="60" strokeLinecap="round" />
              </svg>
              <span className="text-sm text-[#888]">Scraping wallet intelligence...</span>
            </div>
          )}

          {profile && (
            <>
              {/* Summary Bar */}
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-xs text-[#495057]">
                  {profile.insights.length} insight{profile.insights.length !== 1 ? "s" : ""} found
                </span>
                {profile.errors.length > 0 && (
                  <span className="text-xs text-[#FF5252]">
                    {profile.errors.length} source error{profile.errors.length !== 1 ? "s" : ""}
                  </span>
                )}
                {durationMs !== null && (
                  <span className="text-xs text-[#495057] ml-auto">{durationMs}ms (WASM: {profile.elapsed_ms}ms)</span>
                )}
              </div>

              {/* Telegram Identity — the main feature */}
              {(accountMeta?.linked_name || identity) && (
                <SectionCard title="Telegram Identity">
                  <div className="flex items-start gap-5">
                    {/* Avatar */}
                    {(accountMeta?.icon_url || identity?.avatar_url) && (
                      <img
                        src={accountMeta?.icon_url || identity?.avatar_url || ""}
                        alt="Telegram avatar"
                        className="w-16 h-16 rounded-full border-2 border-[#7C4DFF]/50 flex-shrink-0"
                      />
                    )}
                    <div className="space-y-2 flex-1">
                      {/* Linked telegram from account */}
                      {accountMeta?.linked_name && (
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[#495057] w-32">Linked Telegram</span>
                          <span className="text-sm font-bold text-[#7C4DFF]">
                            @{accountMeta.linked_name.replace(".t.me", "")}
                          </span>
                          <a
                            href={`https://t.me/${accountMeta.linked_name.replace(".t.me", "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#495057] hover:text-[#7C4DFF] transition"
                          >
                            Open in Telegram
                          </a>
                        </div>
                      )}
                      {/* Owned usernames */}
                      {identity && identity.owned_usernames.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[#495057] w-32">Owned Usernames</span>
                          <div className="flex flex-wrap gap-2">
                            {identity.owned_usernames.map((u) => (
                              <span key={u} className="px-2 py-0.5 rounded-lg bg-[#7C4DFF]/15 text-[#7C4DFF] text-xs font-bold">
                                @{u}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Owned phone numbers */}
                      {identity && identity.owned_phone_numbers.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[#495057] w-32">Phone Numbers</span>
                          <div className="flex flex-wrap gap-2">
                            {identity.owned_phone_numbers.map((p) => (
                              <span key={p} className="px-2 py-0.5 rounded-lg bg-[#FFD600]/15 text-[#FFD600] text-xs font-bold">
                                {p}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* DNS */}
                      {identity && identity.dns_records.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[#495057] w-32">DNS Records</span>
                          <div className="flex flex-wrap gap-2">
                            {identity.dns_records.map((d) => (
                              <span key={d} className="text-xs text-[#00E5FF] font-mono">{d}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </SectionCard>
              )}

              {/* Account Meta */}
              {accountMeta && (
                <SectionCard title="Account Info">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    <div className="rounded-xl bg-[#0B0E11] border border-[#23272B] px-3 py-2.5">
                      <div className="text-[9px] font-bold uppercase tracking-widest text-[#495057] mb-1">Address</div>
                      <div className="text-xs font-mono text-white break-all">{profile.address}</div>
                    </div>
                    <div className="rounded-xl bg-[#0B0E11] border border-[#23272B] px-3 py-2.5">
                      <div className="text-[9px] font-bold uppercase tracking-widest text-[#495057] mb-1">Balance</div>
                      <div className="text-sm font-bold text-[#00E5FF]">{accountMeta.balance_ton.toFixed(4)} TON</div>
                    </div>
                    <div className="rounded-xl bg-[#0B0E11] border border-[#23272B] px-3 py-2.5">
                      <div className="text-[9px] font-bold uppercase tracking-widest text-[#495057] mb-1">Wallet Type</div>
                      <div className="text-sm text-white">{accountMeta.wallet_type}</div>
                    </div>
                    <div className="rounded-xl bg-[#0B0E11] border border-[#23272B] px-3 py-2.5">
                      <div className="text-[9px] font-bold uppercase tracking-widest text-[#495057] mb-1">Status</div>
                      <div className={`text-sm font-bold ${accountMeta.is_active ? "text-[#00E676]" : "text-[#FF5252]"}`}>
                        {accountMeta.is_active ? "Active" : "Inactive"}
                      </div>
                    </div>
                  </div>
                </SectionCard>
              )}

              {/* TON Domains */}
              {domains && domains.length > 0 && (
                <SectionCard title={`TON Domains (${domains.length})`}>
                  <div className="flex flex-wrap gap-2">
                    {domains.map((d) => (
                      <span key={d.domain} className="px-3 py-1.5 rounded-lg bg-[#00E5FF]/10 text-[#00E5FF] text-xs font-bold border border-[#00E5FF]/20">
                        {d.domain}
                      </span>
                    ))}
                  </div>
                </SectionCard>
              )}

              {/* Explorer Labels */}
              {labels && labels.length > 0 && (
                <SectionCard title="Explorer Labels">
                  {labels.map((l, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs">
                      <span className="px-2 py-0.5 rounded bg-[#FFD600]/15 text-[#FFD600] font-bold">{l.label}</span>
                      {l.category && <span className="text-[#495057]">{l.category}</span>}
                      <span className="text-[#495057] ml-auto">via {l.source}</span>
                    </div>
                  ))}
                </SectionCard>
              )}

              {/* NFTs */}
              {nftProfile && nftProfile.nft_count > 0 && (
                <SectionCard title={`NFTs (${nftProfile.nft_count})`}>
                  {nftProfile.collections.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {nftProfile.collections.filter(Boolean).map((c) => (
                        <span key={c} className="px-2 py-1 rounded-lg bg-[#0B0E11] border border-[#23272B] text-xs text-[#aaa]">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                  {nftProfile.getgems_username && (
                    <p className="text-xs text-[#888]">GetGems username: <span className="text-white">{nftProfile.getgems_username}</span></p>
                  )}
                </SectionCard>
              )}

              {/* Counterparty Identities */}
              {counterparties && counterparties.identities.length > 0 && (
                <SectionCard title={`Counterparty Telegram Identities (${counterparties.identities.length} from ${counterparties.events_scanned} events)`}>
                  <div className="space-y-2">
                    {counterparties.identities.map((cp) => (
                      <div key={cp.address} className="flex items-center gap-3 py-2 border-t border-[#23272B] first:border-t-0">
                        {cp.icon_url && (
                          <img src={cp.icon_url} alt={cp.name} className="w-8 h-8 rounded-full border border-[#23272B] flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-[#7C4DFF]">@{cp.name.replace(".t.me", "")}</span>
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${cp.role === "sender" ? "bg-[#FF6D00]/15 text-[#FF9100]" : "bg-[#00E676]/15 text-[#00E676]"}`}>
                              {cp.role}
                            </span>
                          </div>
                          <div className="text-[10px] font-mono text-[#495057] truncate">{cp.address}</div>
                        </div>
                        <a
                          href={`https://t.me/${cp.name.replace(".t.me", "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-[#495057] hover:text-[#7C4DFF] transition flex-shrink-0"
                        >
                          Open →
                        </a>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}

              {/* Jettons */}
              {jettonPortfolio && jettonPortfolio.balances.length > 0 && (
                <SectionCard title={`Jettons (${jettonPortfolio.balances.length})`}>
                  <div className="overflow-auto rounded-xl border border-[#23272B]">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-[#0B0E11] text-[#495057] uppercase tracking-wider">
                          <th className="text-left px-4 py-2.5">Token</th>
                          <th className="text-right px-4 py-2.5">Balance</th>
                          <th className="text-right px-4 py-2.5">USD Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jettonPortfolio.balances.map((j, i) => (
                          <tr key={i} className="border-t border-[#23272B] hover:bg-[#23272B]/40 transition">
                            <td className="px-4 py-2.5">
                              <span className="font-bold text-white">{j.symbol}</span>
                              {j.name && <span className="text-[#495057] ml-2">({j.name})</span>}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-[#00E5FF]">{j.balance}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-[#495057]">
                              {j.usd_value != null ? `$${j.usd_value.toFixed(2)}` : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              )}

              {/* Source Errors */}
              {profile.errors.length > 0 && (
                <SectionCard title={`Source Errors (${profile.errors.length})`}>
                  <div className="space-y-1">
                    {profile.errors.map((e, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs py-1.5 border-t border-[#23272B] first:border-t-0">
                        <span className="px-2 py-0.5 rounded bg-[#FF1744]/15 text-[#FF5252] font-bold">{e.source_name}</span>
                        <span className="text-[#888]">{e.error}</span>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}

              {/* Raw JSON */}
              <SectionCard title="Raw JSON">
                <pre className="text-[10px] text-[#495057] font-mono bg-[#0B0E11] rounded-xl p-4 overflow-auto max-h-96 border border-[#23272B]">
                  {JSON.stringify(profile, null, 2)}
                </pre>
              </SectionCard>
            </>
          )}
        </div>
      </main>
    </>
  );
}
