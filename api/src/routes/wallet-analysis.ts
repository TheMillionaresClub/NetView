import { Router } from "express";
import { getWalletInfoWasm } from "../lib/wasm-loader.js";
import { getWalletScraperWasm } from "../lib/wasm-loader-scraper.js";

const router = Router();
const RPC_API_KEY = process.env.RPC_API_KEY ?? undefined;
const TONAPI_KEY  = process.env.TONAPI_KEY  ?? undefined;

// ── Convert scraper WalletProfile → wallet-info WalletProfile format ─────────

function scraperToWalletProfile(scraperProfile: any): any {
    const insights: any[] = scraperProfile.insights ?? [];

    // Extract each insight type
    const meta = insights.find((i: any) => i.type === "AccountMeta");
    const jettonPortfolio = insights.find((i: any) => i.type === "JettonPortfolio");
    const nftProfile = insights.find((i: any) => i.type === "NftProfile");
    const domains = insights.filter((i: any) => i.type === "TonDomain");
    const labels = insights.filter((i: any) => i.type === "WalletLabel");
    const counterparties = insights.find((i: any) => i.type === "CounterpartyIdentities");
    const telegramId = insights.find((i: any) => i.type === "TelegramIdentity");

    // ── state ──────────────────────────────────────────────────────────────────
    const balanceNano = Math.round((meta?.balance_ton ?? 0) * 1e9);
    const state = meta ? {
        address: scraperProfile.address,
        balance: balanceNano,
        status: meta.is_active ? "active" : "inactive",
        wallet_type: meta.wallet_type !== "unknown" ? meta.wallet_type : null,
        seqno: null,
        is_wallet: meta.wallet_type !== "unknown",
    } : null;

    const info = meta ? {
        wallet_type: meta.wallet_type !== "unknown" ? meta.wallet_type : null,
        seqno: null,
        account_state: meta.is_active ? "active" : "uninit",
    } : null;

    // ── jettons ────────────────────────────────────────────────────────────────
    const jettons = (jettonPortfolio?.balances ?? []).map((b: any) => ({
        jetton_address: b.jetton_address ?? "",
        wallet_address: "",
        balance: b.balance ?? "0",
        name: b.name ?? null,
        symbol: b.symbol ?? "",
        decimals: null,
        image: null,
    }));

    // ── nfts (from scraper NftProfile — it gives count + collections, not items)
    // Build placeholder NFT entries from collection names so the UI shows something
    const nfts: any[] = [];
    if (nftProfile && nftProfile.nft_count > 0) {
        for (const col of (nftProfile.collections ?? [])) {
            nfts.push({
                address: "",
                collection_name: col,
                name: col,
                image: null,
                on_sale: false,
                verified: false,
            });
        }
    }

    // ── dns_names ──────────────────────────────────────────────────────────────
    const dns_names = domains.map((d: any) => ({
        name: d.domain ?? "",
        category: "dns",
        value: d.domain ?? "",
    }));

    // ── classification heuristics ──────────────────────────────────────────────
    const txCount = meta?.tx_count ?? 0;
    const signals: string[] = [];
    let kind = "HumanWallet";
    let confidence = 0.7;

    if (state && !state.is_wallet && state.status === "active") {
        kind = "SmartContract";
        confidence = 0.9;
        signals.push(`wallet_type='${meta?.wallet_type}' → smart contract`);
    } else if (txCount > 10000) {
        kind = "BotWallet";
        confidence = 0.8;
        signals.push(`tx_count=${txCount} → high-activity bot wallet`);
    } else if (txCount > 0) {
        signals.push(`tx_count=${txCount} → human wallet`);
    } else {
        signals.push("no bot/contract signals detected → classified as human wallet");
    }

    // Add label info to signals
    for (const l of labels) {
        signals.push(`label: "${l.label}" (${l.source})`);
        if (l.label.toLowerCase().includes("exchange")) {
            kind = "Exchange";
            confidence = 0.85;
        }
    }

    // ── recent_transactions: counterparty events as pseudo-transactions ───────
    // The scraper doesn't have raw transactions, but CounterpartyIdentities
    // gives us the addresses that interacted. We build minimal tx entries so
    // the UI shows *something* in the right column.
    const recent_transactions: any[] = [];
    if (counterparties?.identities) {
        for (const cp of counterparties.identities) {
            recent_transactions.push({
                address: cp.address,
                action: cp.role === "sender" ? "Receive" : "Send",
                amount: 0,
                timestamp: 0,
                fee: 0,
            });
        }
    }

    // ── interacted_wallets (empty — scraper doesn't fetch counterparty balances)
    const interacted_wallets: Record<string, string> = {};

    return {
        address: scraperProfile.address,
        state,
        info,
        jettons,
        nfts,
        dns_names,
        recent_transactions,
        interacted_wallets,
        classification: { kind, confidence, signals },
        // Pass through the raw scraper data so the frontend can also use it directly
        _scraper: scraperProfile,
    };
}

// ── Routes ───────────────────────────────────────────────────────────────────

// GET /api/wallet-analysis?address=...&network=mainnet|testnet
router.get("/", async (req, res) => {
    const { address, network = "testnet" } = req.query as Record<string, string>;

    if (!address) {
        return res.status(400).json({ error: "Missing ?address= query parameter" });
    }

    try {
        let result: any;

        if (network === "mainnet") {
            // On mainnet, use wallet-scraper (tonapi-based) as the primary data source
            const scraper = await getWalletScraperWasm();
            const raw: string = await scraper.scrape_wallet(address, "mainnet", TONAPI_KEY ?? null);
            const scraperProfile = JSON.parse(raw);
            result = scraperToWalletProfile(scraperProfile);
        } else {
            // Testnet: use Rust wallet-info WASM (toncenter-based, works with RPC key)
            const bg = await getWalletInfoWasm();
            const raw = await bg.analyze_wallet(address, network, RPC_API_KEY ?? null);
            result = typeof raw === "string" ? JSON.parse(raw) : JSON.parse(JSON.stringify(raw));
        }

        return res.json({ ok: true, result });
    } catch (err) {
        console.error("wallet-analysis error:", err);
        return res.status(500).json({ error: (err as Error).message ?? String(err) });
    }
});

// GET /api/wallet-analysis/full?address=...&network=mainnet|testnet
router.get("/full", async (req, res) => {
    const { address, network = "testnet" } = req.query as Record<string, string>;

    if (!address) {
        return res.status(400).json({ error: "Missing ?address= query parameter" });
    }

    try {
        let result: any;

        if (network === "mainnet") {
            const scraper = await getWalletScraperWasm();
            const raw: string = await scraper.scrape_wallet(address, "mainnet", TONAPI_KEY ?? null);
            const scraperProfile = JSON.parse(raw);
            result = scraperToWalletProfile(scraperProfile);
        } else {
            const bg = await getWalletInfoWasm();
            const json: string = await bg.full_analysis(address, network, RPC_API_KEY ?? null);
            result = JSON.parse(json);
        }

        return res.json({ ok: true, result });
    } catch (err) {
        console.error("wallet-analysis/full error:", err);
        return res.status(500).json({ error: (err as Error).message ?? String(err) });
    }
});

export default router;
