pub mod api;
pub mod client;
pub mod types;

use std::collections::HashMap;

use futures::{future::join_all, join};
use serde::{Deserialize, Serialize};

use crate::decoder::normalize_address;
use crate::network::Network;
use crate::transactions::Transaction;
use client::TonAnalysisClient;
pub use client::{AnalysisError, Result};
pub use types::{ActorKind, Classification, DnsRecord, JettonBalance, NftItem, WalletInfo, WalletState};

// ── Profile ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletProfile {
    pub address: String,
    pub state: Option<WalletState>,
    pub info: Option<WalletInfo>,
    pub jettons: Vec<JettonBalance>,
    pub nfts: Vec<NftItem>,
    pub dns_names: Vec<DnsRecord>,
    pub recent_transactions: Vec<Transaction>,
    pub interacted_wallets: HashMap<String, String>,
    pub classification: Classification,
}

// ── Public entry point ────────────────────────────────────────────────────────

pub fn make_client(network: &Network, api_key: Option<String>) -> TonAnalysisClient {
    TonAnalysisClient::new(network, api_key)
}

/// Fetch all data for `address` concurrently and return a complete
/// [`WalletProfile`] including interacted wallet balances and a heuristic
/// [`Classification`].
pub async fn analyze_wallet(
    client: &TonAnalysisClient,
    address: &str,
) -> Result<WalletProfile> {
    let address = &normalize_address(address);
    // ── Phase 1: everything that doesn't depend on transactions ──────────────
    let (states_res, info_res, jettons_res, nfts_res, dns_res, txs_res) = join!(
        api::get_wallet_states(client, address),
        api::get_wallet_information(client, address),
        api::get_jetton_wallets(client, address),
        api::get_nft_items(client, address),
        api::get_dns_records(client, address),
        // v2 JSON-RPC — more reliable than v3 REST for tx history
        crate::network::get_transactions_page(
            &client.http, &client.network, address, 100, None, client.api_key(),
        ),
    );

    let state = states_res.ok().and_then(|mut v| {
        if v.is_empty() { None } else { Some(v.remove(0)) }
    });
    let info = info_res.ok();
    let jettons = jettons_res.unwrap_or_default();
    let nfts = nfts_res.unwrap_or_default();
    let dns_names = dns_res.unwrap_or_default();
    let recent_transactions = txs_res
        .map(|p| p.transactions)
        .unwrap_or_default();

    // ── Phase 2: balances for every unique counterparty ──────────────────────
    let unique_addrs: Vec<String> = {
        let mut seen = std::collections::HashSet::new();
        recent_transactions
            .iter()
            .filter(|tx| seen.insert(tx.address.clone()))
            .map(|tx| tx.address.clone())
            .collect()
    };

    let balance_futs = unique_addrs.into_iter().map(|addr| {
        let http = client.http.clone();
        let network = client.network;
        async move {
            let bal = crate::types::fetch_address_balance(&http, &addr, &network)
                .await
                .unwrap_or_else(|_| "0".to_string());
            (addr, bal)
        }
    });
    let interacted_wallets: HashMap<String, String> =
        join_all(balance_futs).await.into_iter().collect();

    let classification = classify(&state, &info, &recent_transactions);

    Ok(WalletProfile {
        address: address.to_string(),
        state,
        info,
        jettons,
        nfts,
        dns_names,
        recent_transactions,
        interacted_wallets,
        classification,
    })
}

/// Thin wrapper kept for API compatibility — `analyze_wallet` now includes
/// interacted wallet balances directly in `WalletProfile`.
pub async fn full_analysis(
    client: &TonAnalysisClient,
    address: &str,
) -> Result<WalletProfile> {
    analyze_wallet(client, address).await
}

// ── Classification heuristics ─────────────────────────────────────────────────

fn classify(
    state: &Option<WalletState>,
    info: &Option<WalletInfo>,
    txs: &[Transaction],
) -> Classification {
    let mut signals: Vec<String> = Vec::new();
    let mut kind = ActorKind::HumanWallet;
    let mut confidence: f32 = 0.5;

    // ── 1. Classify based on wallet state ────────────────────────────────────
    if let Some(ws) = state {
        if !ws.is_wallet {
            if ws.status == "uninit" {
                // Uninitialised: address funded but contract not yet deployed.
                // This is a normal new wallet that hasn't sent its first tx yet.
                signals.push(
                    "uninit + is_wallet=false → new wallet, contract not yet deployed".to_string(),
                );
                // Fall through to tx-based analysis; confidence stays low until
                // we get more data.
                confidence = 0.55;
            } else {
                // active/frozen + is_wallet=false → genuine smart contract
                signals.push(format!(
                    "is_wallet=false with status='{}' → smart contract",
                    ws.status
                ));
                return Classification {
                    kind: ActorKind::SmartContract,
                    confidence: 0.95,
                    signals,
                };
            }
        }

        // ── 2. Active but no wallet_type ──────────────────────────────────────
        if ws.wallet_type.is_none() && ws.status == "active" {
            signals.push("active status but no wallet_type → likely smart contract".to_string());
            kind = ActorKind::SmartContract;
            confidence = 0.75;
        }
    } else if info.as_ref().map(|i| i.wallet_type.is_none()).unwrap_or(false)
        && info
            .as_ref()
            .map(|i| i.account_state == "active")
            .unwrap_or(false)
    {
        signals.push("v2 info shows active account with no wallet_type".to_string());
        kind = ActorKind::SmartContract;
        confidence = 0.65;
    }

    if kind == ActorKind::SmartContract {
        return Classification {
            kind,
            confidence,
            signals,
        };
    }

    // ── 3. Tx-based analysis ─────────────────────────────────────────────────
    if !txs.is_empty() {
        let tx_count = txs.len();

        let oldest = txs.iter().map(|t| t.timestamp).min().unwrap_or(0);
        let newest = txs.iter().map(|t| t.timestamp).max().unwrap_or(0);
        let span_seconds = (newest.saturating_sub(oldest)).max(1) as f64;
        let span_days = span_seconds / 86_400.0;
        let tx_per_day = tx_count as f64 / span_days.max(1.0);

        // ── 3a. High frequency → BotWallet ───────────────────────────────────
        if tx_per_day > 50.0 {
            signals.push(format!(
                "tx frequency {:.1} tx/day exceeds threshold of 50",
                tx_per_day
            ));
            kind = ActorKind::BotWallet;
            confidence = 0.80;
        }

        // ── 3b. Suspiciously regular intervals (std-dev < 30 s) ──────────────
        if tx_count >= 5 {
            let mut utimes: Vec<f64> = txs.iter().map(|t| t.timestamp as f64).collect();
            utimes.sort_by(|a, b| a.partial_cmp(b).unwrap());

            let intervals: Vec<f64> = utimes.windows(2).map(|w| w[1] - w[0]).collect();
            if !intervals.is_empty() {
                let mean = intervals.iter().sum::<f64>() / intervals.len() as f64;
                let variance = intervals.iter().map(|&i| (i - mean).powi(2)).sum::<f64>()
                    / intervals.len() as f64;
                let std_dev = variance.sqrt();

                if std_dev < 30.0 && mean < 300.0 {
                    signals.push(format!(
                        "tx interval std-dev {:.1}s < 30s threshold (mean {:.1}s) → bot-like regularity",
                        std_dev, mean
                    ));
                    if kind != ActorKind::BotWallet {
                        kind = ActorKind::BotWallet;
                        confidence = 0.75;
                    } else {
                        confidence = confidence.max(0.88);
                    }
                }
            }
        }

        // ── 3c. High seqno + many txs → BotWallet candidate ──────────────────
        let seqno = state
            .as_ref()
            .and_then(|s| s.seqno)
            .or_else(|| info.as_ref().and_then(|i| i.seqno))
            .unwrap_or(0);

        if seqno > 10_000 && tx_count >= 50 {
            signals.push(format!(
                "seqno {} > 10000 and {} fetched txs → high-activity account",
                seqno, tx_count
            ));
            if kind == ActorKind::HumanWallet {
                kind = ActorKind::BotWallet;
                confidence = 0.65;
            } else {
                confidence = confidence.max(0.80);
            }
        }

        // ── 3d. Only outbound transactions → likely exchange/distributor ──────
        let send_count = txs.iter().filter(|t| matches!(t.action, crate::transactions::Action::Send)).count();
        if tx_count >= 10 && send_count == tx_count {
            signals.push(format!(
                "all {} fetched txs are outbound sends → possible exchange/distributor",
                tx_count
            ));
            if kind == ActorKind::HumanWallet {
                kind = ActorKind::Exchange;
                confidence = 0.65;
            }
        }
    }

    // ── 4. Default: HumanWallet ───────────────────────────────────────────────
    if kind == ActorKind::HumanWallet {
        signals.push("no bot/contract signals detected → classified as human wallet".to_string());
        confidence = 0.70;
    }

    Classification {
        kind,
        confidence,
        signals,
    }
}
