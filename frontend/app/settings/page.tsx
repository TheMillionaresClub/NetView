"use client";

import { useState } from "react";
import TopNavBar from "../components/TopNavBar";
import SideNavBar from "../components/SideNavBar";

interface SettingSection {
  title: string;
  icon: string;
  children: React.ReactNode;
}

function Section({ title, icon, children }: SettingSection) {
  return (
    <div className="bg-surface border border-surface-container-highest mb-6">
      <div className="px-6 py-4 border-b border-surface-container-highest flex items-center gap-2">
        <span className="material-symbols-outlined text-sm text-outline">{icon}</span>
        <h3 className="text-[10px] font-headline font-black tracking-widest uppercase text-outline">
          {title}
        </h3>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function Toggle({ label, description, defaultOn = false }: { label: string; description: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <div className="text-xs font-medium text-on-surface">{label}</div>
        <div className="text-[10px] text-outline mt-0.5">{description}</div>
      </div>
      <button
        onClick={() => setOn(!on)}
        className={`w-10 h-5 flex items-center px-0.5 transition-colors ${
          on ? "bg-primary-container" : "bg-surface-container-highest"
        }`}
      >
        <div className={`w-4 h-4 bg-surface transition-transform ${on ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const [network, setNetwork] = useState("testnet");
  const [rpcUrl, setRpcUrl] = useState("https://testnet.toncenter.com/api/v2/jsonRPC");
  const [apiKey, setApiKey] = useState("");

  return (
    <>
      <TopNavBar />
      <SideNavBar />
      <main className="fixed left-0 sm:left-20 right-0 top-14 bottom-16 sm:bottom-0 bg-surface-container-lowest overflow-y-auto">
        <div className="max-w-3xl mx-auto p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-headline font-bold text-primary-container tracking-tight uppercase">
              Settings
            </h1>
            <p className="text-xs text-outline mt-1 uppercase tracking-widest">
              Configuration & Preferences
            </p>
          </div>

          {/* Network */}
          <Section title="Network" icon="hub">
            <div className="mb-4">
              <label className="text-[10px] text-outline uppercase tracking-widest block mb-2">
                TON Network
              </label>
              <div className="flex gap-2">
                {["testnet", "mainnet"].map((n) => (
                  <button
                    key={n}
                    onClick={() => setNetwork(n)}
                    className={`px-4 py-2 text-[10px] font-headline font-bold uppercase tracking-widest transition-all ${
                      network === n
                        ? "bg-[#00E5FF] text-[#0B0E11]"
                        : "bg-surface-container-high text-outline hover:text-on-surface"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="text-[10px] text-outline uppercase tracking-widest block mb-2">
                RPC Endpoint
              </label>
              <input
                type="text"
                value={rpcUrl}
                onChange={(e) => setRpcUrl(e.target.value)}
                className="w-full bg-surface-container-low px-4 py-2.5 text-xs font-mono text-on-surface-variant outline-none border border-surface-container-highest focus:border-primary-container transition-colors"
              />
            </div>

            <div>
              <label className="text-[10px] text-outline uppercase tracking-widest block mb-2">
                API Key (optional)
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your TonCenter API key..."
                className="w-full bg-surface-container-low px-4 py-2.5 text-xs font-mono text-on-surface-variant placeholder:text-on-surface-variant/30 outline-none border border-surface-container-highest focus:border-primary-container transition-colors"
              />
            </div>
          </Section>

          {/* Display */}
          <Section title="Display" icon="palette">
            <div className="divide-y divide-surface-container-highest/50">
              <Toggle
                label="Dark Mode"
                description="Use dark theme (currently the only theme)"
                defaultOn={true}
              />
              <Toggle
                label="Animations"
                description="Enable node animations and transitions in the graph"
                defaultOn={true}
              />
              <Toggle
                label="Show Grid"
                description="Display background grid on the network graph"
                defaultOn={true}
              />
              <Toggle
                label="Compact Mode"
                description="Reduce padding and font sizes for more data density"
              />
            </div>
          </Section>

          {/* Notifications */}
          <Section title="Alerts & Notifications" icon="notifications">
            <div className="divide-y divide-surface-container-highest/50">
              <Toggle
                label="Whale Alerts"
                description="Notify when large transfers (>10,000 TON) are detected"
                defaultOn={true}
              />
              <Toggle
                label="Risk Scoring"
                description="Highlight wallets with unusual activity patterns"
                defaultOn={true}
              />
              <Toggle
                label="Price Alerts"
                description="Get notified on significant TON price movements"
              />
            </div>
          </Section>

          {/* Wallet */}
          <Section title="Connected Wallet" icon="account_balance_wallet">
            <p className="text-xs text-on-surface-variant">
              Manage your TON wallet connection from the top navigation bar.
              Your connected wallet is used for identity verification and optional on-chain actions.
            </p>
          </Section>

          {/* Danger Zone */}
          <div className="bg-surface border border-error/20 mb-6">
            <div className="px-6 py-4 border-b border-error/20 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-error">warning</span>
              <h3 className="text-[10px] font-headline font-black tracking-widest uppercase text-error">
                Danger Zone
              </h3>
            </div>
            <div className="p-6 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-on-surface">Reset All Data</div>
                <div className="text-[10px] text-outline mt-0.5">
                  Clear all local data including saved wallets and preferences
                </div>
              </div>
              <button className="px-4 py-2 text-[10px] font-headline font-bold uppercase tracking-widest bg-error/10 text-error border border-error/20 hover:bg-error/20 transition-colors">
                Reset
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
