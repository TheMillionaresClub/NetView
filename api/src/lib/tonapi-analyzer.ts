/**
 * tonapi-analyzer.ts
 *
 * Implements the same WalletProfile shape as the Rust wallet-info crate,
 * but fetches everything from tonapi.io (v2) instead of toncenter.
 * Works for both mainnet and testnet with the same TONAPI_KEY.
 */

function tonapiBase(network: string): string {
    return network === "mainnet"
        ? "https://tonapi.io/v2"
        : "https://testnet.tonapi.io/v2";
}

async function tonapiGet(
    base: string,
    path: string,
    params: Record<string, string | number> = {},
    apiKey?: string,
): Promise<any> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
    const url = `${base}${path}${qs.toString() ? "?" + qs : ""}`;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const resp = await fetch(url, { headers });
    if (resp.status === 404) return null;
    if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        throw new Error(`tonapi ${resp.status} ${path}: ${body.slice(0, 200)}`);
    }
    return resp.json();
}

// ── Classification (mirrors Rust heuristics) ─────────────────────────────────

interface RustTx { address: string; action: string; amount: number; timestamp: number; fee: number; }

function classify(
    state: any | null,
    txs: RustTx[],
): { kind: string; confidence: number; signals: string[] } {
    const signals: string[] = [];
    let kind = "HumanWallet";
    let confidence = 0.5;

    if (state) {
        if (!state.is_wallet) {
            if (state.status === "uninit") {
                signals.push("uninit + is_wallet=false → new wallet, contract not yet deployed");
                confidence = 0.55;
            } else {
                signals.push(`is_wallet=false with status='${state.status}' → smart contract`);
                return { kind: "SmartContract", confidence: 0.95, signals };
            }
        }
        if (state.wallet_type == null && state.status === "active") {
            signals.push("active status but no wallet_type → likely smart contract");
            kind = "SmartContract";
            confidence = 0.75;
        }
    }
    if (kind === "SmartContract") return { kind, confidence, signals };

    if (txs.length > 0) {
        const oldest = Math.min(...txs.map(t => t.timestamp));
        const newest = Math.max(...txs.map(t => t.timestamp));
        const spanDays = Math.max((newest - oldest) / 86400, 1);
        const txPerDay = txs.length / spanDays;

        if (txPerDay > 50) {
            signals.push(`tx frequency ${txPerDay.toFixed(1)} tx/day exceeds threshold of 50`);
            kind = "BotWallet";
            confidence = 0.80;
        }

        if (txs.length >= 5) {
            const sorted = [...txs].map(t => t.timestamp).sort((a, b) => a - b);
            const intervals = sorted.slice(1).map((t, i) => t - sorted[i]);
            const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const stdDev = Math.sqrt(intervals.map(i => (i - mean) ** 2).reduce((a, b) => a + b, 0) / intervals.length);
            if (stdDev < 30 && mean < 300) {
                signals.push(`tx interval std-dev ${stdDev.toFixed(1)}s < 30s (mean ${mean.toFixed(1)}s) → bot-like regularity`);
                if (kind !== "BotWallet") { kind = "BotWallet"; confidence = 0.75; }
                else { confidence = Math.max(confidence, 0.88); }
            }
        }

        const seqno = state?.seqno ?? 0;
        if (seqno > 10000 && txs.length >= 50) {
            signals.push(`seqno ${seqno} > 10000 and ${txs.length} fetched txs → high-activity account`);
            if (kind === "HumanWallet") { kind = "BotWallet"; confidence = 0.65; }
            else { confidence = Math.max(confidence, 0.80); }
        }

        const sendCount = txs.filter(t => t.action === "Send").length;
        if (txs.length >= 10 && sendCount === txs.length) {
            signals.push(`all ${txs.length} fetched txs are outbound sends → possible exchange/distributor`);
            if (kind === "HumanWallet") { kind = "Exchange"; confidence = 0.65; }
        }
    }

    if (kind === "HumanWallet") {
        signals.push("no bot/contract signals detected → classified as human wallet");
        confidence = 0.70;
    }

    return { kind, confidence, signals };
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function analyzeWalletTonapi(
    address: string,
    network: string,
    apiKey?: string,
): Promise<object> {
    const base = tonapiBase(network);

    // Fetch all data in parallel
    const [accountData, jettonsData, nftsData, txsData] = await Promise.all([
        tonapiGet(base, `/accounts/${encodeURIComponent(address)}`, {}, apiKey),
        tonapiGet(base, `/accounts/${encodeURIComponent(address)}/jettons`, { limit: 100 }, apiKey),
        tonapiGet(base, `/accounts/${encodeURIComponent(address)}/nfts`, { limit: 100 }, apiKey),
        tonapiGet(base, `/blockchain/accounts/${encodeURIComponent(address)}/transactions`, { limit: 100, sort_order: "desc" }, apiKey),
    ]);

    // ── state ──────────────────────────────────────────────────────────────────
    const interfaces: string[] = accountData?.interfaces ?? [];
    const walletType = interfaces.find(i =>
        i.startsWith("wallet_v") || i.startsWith("wallet_highload") || i.startsWith("lockup")
    ) ?? null;
    const state = accountData ? {
        address: accountData.address ?? address,
        balance: Number(accountData.balance ?? 0),
        status: accountData.status ?? "uninit",
        wallet_type: walletType,
        seqno: null as number | null, // tonapi doesn't expose seqno on account endpoint directly
        is_wallet: accountData.is_wallet ?? (walletType != null),
    } : null;

    const info = accountData ? {
        wallet_type: walletType,
        seqno: null as number | null,
        account_state: accountData.status ?? "uninit",
    } : null;

    // ── jettons ────────────────────────────────────────────────────────────────
    const jettons = (jettonsData?.balances ?? []).map((b: any) => ({
        jetton_address: b.jetton?.address ?? "",
        wallet_address: b.wallet_address?.address ?? "",
        balance: String(b.balance ?? "0"),
        name: b.jetton?.name ?? null,
        symbol: b.jetton?.symbol ?? null,
        decimals: b.jetton?.decimals ?? null,
        image: b.jetton?.image ?? null,
    }));

    // ── nfts ───────────────────────────────────────────────────────────────────
    const nfts = (nftsData?.nft_items ?? []).map((n: any) => ({
        address: n.address ?? "",
        collection_name: n.collection?.name ?? null,
        name: n.metadata?.name ?? null,
        image: n.metadata?.image ?? null,
        on_sale: n.sale != null,
        verified: n.verified_collection ?? false,
    }));

    // ── transactions ───────────────────────────────────────────────────────────
    const centerAddr = (accountData?.address ?? address).toLowerCase();
    const recent_transactions: RustTx[] = (txsData?.transactions ?? []).map((tx: any) => {
        const inSrc = tx.in_msg?.source?.address ?? "";
        const fee = Number(tx.total_fees ?? 0);

        // If there's a meaningful incoming message from someone else → Receive
        if (inSrc && inSrc.toLowerCase() !== centerAddr && Number(tx.in_msg?.value ?? 0) > 0) {
            return {
                address: inSrc,
                action: "Receive",
                amount: Number(tx.in_msg.value),
                timestamp: tx.utime ?? 0,
                fee,
            };
        }

        // Otherwise treat first out_msg as Send
        const out = (tx.out_msgs ?? [])[0];
        const dest = out?.destination?.address ?? "";
        if (dest && dest.toLowerCase() !== centerAddr) {
            return {
                address: dest,
                action: "Send",
                amount: Number(out?.value ?? 0),
                timestamp: tx.utime ?? 0,
                fee,
            };
        }

        return null;
    }).filter(Boolean) as RustTx[];

    // ── interacted wallets (balances for unique counterparties) ───────────────
    const uniqueAddrs = [...new Set(recent_transactions.map(tx => tx.address))].slice(0, 20);
    const balanceFuts = uniqueAddrs.map(async addr => {
        try {
            const d = await tonapiGet(base, `/accounts/${encodeURIComponent(addr)}`, {}, apiKey);
            return [addr, String(d?.balance ?? "0")] as [string, string];
        } catch { return [addr, "0"] as [string, string]; }
    });
    const interacted_wallets = Object.fromEntries(await Promise.all(balanceFuts));

    // ── classification ─────────────────────────────────────────────────────────
    const classification = classify(state, recent_transactions);

    return {
        address,
        state,
        info,
        jettons,
        nfts,
        dns_names: [],
        recent_transactions,
        interacted_wallets,
        classification,
    };
}
