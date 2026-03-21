use serde::{Deserialize, Serialize};

use crate::api;
use crate::client::TonClient;
use crate::error::Result;
use crate::types::{
    classification::{ActorKind, Classification},
    domain::DnsRecord,
    identity::{WalletInfo, WalletState},
    nft::NftItem,
    tokens::JettonBalance,
    transactions::TxSummary,
};

// ── Profile ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletProfile {
    pub address: String,
    pub state: Option<WalletState>,
    pub info: Option<WalletInfo>,
    pub jettons: Vec<JettonBalance>,
    pub nfts: Vec<NftItem>,
    pub dns_names: Vec<DnsRecord>,
    pub recent_transactions: Vec<TxSummary>,
    pub classification: Classification,
}

// ── Public entry point ────────────────────────────────────────────────────────

/// Fetch all data for `address` concurrently and return a complete
/// [`WalletProfile`] including a heuristic [`Classification`].
pub async fn analyze_wallet(client: &TonClient, address: &str) -> Result<WalletProfile> {
    // Fire all requests concurrently.
    let (states_res, info_res, jettons_res, nfts_res, dns_res, txs_res) = tokio::join!(
        api::get_wallet_states(client, address),
        api::get_wallet_information(client, address),
        api::get_jetton_wallets(client, address),
        api::get_nft_items(client, address),
        api::get_dns_records(client, address),
        api::get_transactions_page(client, address, 100, 0),
    );

    let state = states_res.ok().and_then(|mut v| {
        if v.is_empty() {
            None
        } else {
            Some(v.remove(0))
        }
    });

    let info = info_res.ok();
    let jettons = jettons_res.unwrap_or_default();
    let nfts = nfts_res.unwrap_or_default();
    let dns_names = dns_res.unwrap_or_default();
    let recent_transactions = txs_res
        .map(|p| p.transactions)
        .unwrap_or_default();

    let classification = classify(&state, &info, &recent_transactions);

    Ok(WalletProfile {
        address: address.to_string(),
        state,
        info,
        jettons,
        nfts,
        dns_names,
        recent_transactions,
        classification,
    })
}

// ── Classification heuristics ─────────────────────────────────────────────────

fn classify(
    state: &Option<WalletState>,
    info: &Option<WalletInfo>,
    txs: &[TxSummary],
) -> Classification {
    let mut signals: Vec<String> = Vec::new();
    let mut kind = ActorKind::HumanWallet;
    let mut confidence: f32 = 0.5;

    // ── 1. Non-wallet contract ────────────────────────────────────────────────
    if let Some(ws) = state {
        if !ws.is_wallet {
            signals.push("is_wallet=false in wallet state".to_string());
            return Classification {
                kind: ActorKind::SmartContract,
                confidence: 0.95,
                signals,
            };
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

    // If already classified as SmartContract, return early.
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

        // Determine time span covered by the fetched transactions.
        let oldest = txs.iter().map(|t| t.utime).min().unwrap_or(0);
        let newest = txs.iter().map(|t| t.utime).max().unwrap_or(0);
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
            let mut utimes: Vec<f64> = txs.iter().map(|t| t.utime as f64).collect();
            utimes.sort_by(|a, b| a.partial_cmp(b).unwrap());

            let intervals: Vec<f64> = utimes.windows(2).map(|w| w[1] - w[0]).collect();
            if !intervals.is_empty() {
                let mean = intervals.iter().sum::<f64>() / intervals.len() as f64;
                let variance =
                    intervals.iter().map(|&i| (i - mean).powi(2)).sum::<f64>() / intervals.len() as f64;
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

        // ── 3d. Exchange-like: very high out_msg_count per tx ─────────────────
        let avg_out_msgs = txs.iter().map(|t| t.out_msg_count).sum::<usize>() as f64
            / tx_count as f64;

        if avg_out_msgs > 5.0 {
            signals.push(format!(
                "average {:.1} out-messages per tx → possible exchange/distributor",
                avg_out_msgs
            ));
            kind = ActorKind::Exchange;
            confidence = 0.70;
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
