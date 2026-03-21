use serde::Deserialize;
use serde_json::Value;

use super::client::{AnalysisError, Result, TonAnalysisClient};
use super::types::{
    DnsRecord, JettonBalance, NftItem, TransactionPage, TxSummary, WalletInfo, WalletState,
};

// ── Helper: treat 404 as empty ───────────────────────────────────────────────

fn is_not_found(e: &AnalysisError) -> bool {
    matches!(e, AnalysisError::Api(msg) if msg.contains("404"))
}

// ══════════════════════════════════════════════════════════════════════════════
// Wallet States  —  GET /v3/walletStates?address=…
// ══════════════════════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
struct WalletStatesResp {
    wallets: Vec<RawWalletState>,
}

#[derive(Debug, Deserialize)]
struct RawWalletState {
    address: String,
    balance: String,
    status: String,
    wallet_type: Option<String>,
    seqno: Option<u32>,
    is_wallet: bool,
}

pub async fn get_wallet_states(
    client: &TonAnalysisClient,
    address: &str,
) -> Result<Vec<WalletState>> {
    let url = format!("{}/walletStates", client.base_v3);
    let resp: WalletStatesResp = match client.get(&url, &[("address", address)]).await {
        Ok(v) => v,
        Err(e) if is_not_found(&e) => return Ok(vec![]),
        Err(e) => return Err(e),
    };

    let states = resp
        .wallets
        .into_iter()
        .map(|r| {
            let balance = r.balance.parse::<u64>().unwrap_or(0);
            WalletState {
                address: r.address,
                balance,
                status: r.status,
                wallet_type: r.wallet_type,
                seqno: r.seqno,
                is_wallet: r.is_wallet,
            }
        })
        .collect();

    Ok(states)
}

// ══════════════════════════════════════════════════════════════════════════════
// Wallet Information  —  GET /v2/getWalletInformation?address=…
// ══════════════════════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
struct V2Response<T> {
    ok: bool,
    result: Option<T>,
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TxId {
    lt: String,
    hash: String,
}

#[derive(Debug, Deserialize)]
struct RawWalletInfo {
    wallet: bool,
    wallet_type: Option<String>,
    seqno: Option<u32>,
    wallet_id: Option<u64>,
    last_transaction_id: Option<TxId>,
    account_state: String,
}

pub async fn get_wallet_information(
    client: &TonAnalysisClient,
    address: &str,
) -> Result<WalletInfo> {
    let url = format!("{}/getWalletInformation", client.base_v2);
    let resp: V2Response<RawWalletInfo> = client.get(&url, &[("address", address)]).await?;

    if !resp.ok {
        return Err(AnalysisError::Api(
            resp.error.unwrap_or_else(|| "unknown v2 error".to_string()),
        ));
    }

    let raw = resp
        .result
        .ok_or_else(|| AnalysisError::Api("v2 result is null".to_string()))?;

    Ok(WalletInfo {
        wallet_type: raw.wallet_type,
        seqno: if raw.wallet { raw.seqno } else { None },
        wallet_id: raw.wallet_id,
        last_transaction_lt: raw.last_transaction_id.as_ref().map(|t| t.lt.clone()),
        last_transaction_hash: raw.last_transaction_id.map(|t| t.hash),
        account_state: raw.account_state,
    })
}

// ══════════════════════════════════════════════════════════════════════════════
// Jetton Wallets  —  GET /v3/jetton/wallets?owner_address=…&limit=100
// ══════════════════════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
struct JettonWalletsResp {
    jetton_wallets: Vec<RawJettonWallet>,
}

#[derive(Debug, Deserialize)]
struct RawJettonWallet {
    address: String,
    balance: String,
    jetton: String,
    jetton_content: Option<JettonContent>,
}

#[derive(Debug, Deserialize)]
struct JettonContent {
    name: Option<String>,
    symbol: Option<String>,
    decimals: Option<Value>,
    image: Option<String>,
}

pub async fn get_jetton_wallets(
    client: &TonAnalysisClient,
    address: &str,
) -> Result<Vec<JettonBalance>> {
    let url = format!("{}/jetton/wallets", client.base_v3);
    let resp: JettonWalletsResp = match client
        .get(&url, &[("owner_address", address), ("limit", "100")])
        .await
    {
        Ok(v) => v,
        Err(e) if is_not_found(&e) => return Ok(vec![]),
        Err(e) => return Err(e),
    };

    let jettons = resp
        .jetton_wallets
        .into_iter()
        .map(|r| {
            let (name, symbol, decimals, image) = r
                .jetton_content
                .map(|c| {
                    let dec = c.decimals.and_then(|v| match v {
                        Value::Number(n) => n.as_u64().map(|n| n as u8),
                        Value::String(s) => s.parse::<u8>().ok(),
                        _ => None,
                    });
                    (c.name, c.symbol, dec, c.image)
                })
                .unwrap_or((None, None, None, None));

            JettonBalance {
                jetton_address: r.jetton,
                wallet_address: r.address,
                balance: r.balance,
                name,
                symbol,
                decimals,
                image,
            }
        })
        .collect();

    Ok(jettons)
}

// ══════════════════════════════════════════════════════════════════════════════
// NFT Items  —  GET /v3/nft/items?owner_address=…&limit=100
// ══════════════════════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
struct NftItemsResp {
    nft_items: Vec<RawNftItem>,
}

#[derive(Debug, Deserialize)]
struct RawNftItem {
    address: String,
    index: Value,
    collection: Option<RawCollection>,
    metadata: Option<NftMetadata>,
    sale: Option<Value>,
    verified_collection: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct RawCollection {
    address: Option<String>,
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct NftMetadata {
    name: Option<String>,
    image: Option<String>,
}

pub async fn get_nft_items(client: &TonAnalysisClient, address: &str) -> Result<Vec<NftItem>> {
    let url = format!("{}/nft/items", client.base_v3);
    let resp: NftItemsResp = match client
        .get(&url, &[("owner_address", address), ("limit", "100")])
        .await
    {
        Ok(v) => v,
        Err(e) if is_not_found(&e) => return Ok(vec![]),
        Err(e) => return Err(e),
    };

    let items = resp
        .nft_items
        .into_iter()
        .map(|r| {
            let on_sale = r.sale.is_some();
            let verified = r.verified_collection.unwrap_or(false);
            let (collection_address, collection_name) = r
                .collection
                .map(|c| (c.address, c.name))
                .unwrap_or((None, None));
            let (name, image) = r
                .metadata
                .map(|m| (m.name, m.image))
                .unwrap_or((None, None));

            NftItem {
                address: r.address,
                index: r.index,
                collection_address,
                collection_name,
                name,
                image,
                on_sale,
                verified,
            }
        })
        .collect();

    Ok(items)
}

// ══════════════════════════════════════════════════════════════════════════════
// Transactions  —  GET /v3/transactions?account=…&limit=…&offset=…&sort=desc
// ══════════════════════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
struct TransactionsResp {
    transactions: Vec<RawTransaction>,
}

#[derive(Debug, Deserialize)]
struct RawTransaction {
    hash: String,
    lt: String,
    utime: u64,
    total_fees: String,
    in_msg: Option<RawMsg>,
    out_msgs: Option<Vec<Value>>,
}

#[derive(Debug, Deserialize)]
struct RawMsg {
    value: Option<String>,
}

pub async fn get_transactions_page(
    client: &TonAnalysisClient,
    address: &str,
    limit: usize,
    offset: usize,
) -> Result<TransactionPage> {
    let url = format!("{}/transactions", client.base_v3);
    let limit_s = limit.to_string();
    let offset_s = offset.to_string();

    let resp: TransactionsResp = match client
        .get(
            &url,
            &[
                ("account", address),
                ("limit", &limit_s),
                ("offset", &offset_s),
                ("sort", "desc"),
            ],
        )
        .await
    {
        Ok(v) => v,
        Err(e) if is_not_found(&e) => {
            return Ok(TransactionPage {
                transactions: vec![],
                next_offset: None,
            })
        }
        Err(e) => return Err(e),
    };

    let count = resp.transactions.len();

    let transactions = resp
        .transactions
        .into_iter()
        .map(|r| {
            let in_msg_value = r.in_msg.and_then(|m| m.value);
            let out_msg_count = r.out_msgs.map(|v| v.len()).unwrap_or(0);
            TxSummary {
                hash: r.hash,
                lt: r.lt,
                utime: r.utime,
                total_fees: r.total_fees,
                in_msg_value,
                out_msg_count,
            }
        })
        .collect();

    let next_offset = if count == limit {
        Some(offset + limit)
    } else {
        None
    };

    Ok(TransactionPage {
        transactions,
        next_offset,
    })
}

// ══════════════════════════════════════════════════════════════════════════════
// DNS Records  —  GET /v3/dns/resolve?address=…
// ══════════════════════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
struct DnsResolveResp {
    entries: Option<Vec<RawDnsEntry>>,
}

#[derive(Debug, Deserialize)]
struct RawDnsEntry {
    name: Option<String>,
    category: Option<String>,
    value: Option<Value>,
}

pub async fn get_dns_records(
    client: &TonAnalysisClient,
    address: &str,
) -> Result<Vec<DnsRecord>> {
    let url = format!("{}/dns/resolve", client.base_v3);
    let resp: DnsResolveResp = match client.get(&url, &[("address", address)]).await {
        Ok(v) => v,
        Err(e) if is_not_found(&e) => return Ok(vec![]),
        Err(e) => {
            let _ = e;
            return Ok(vec![]);
        }
    };

    let records = resp
        .entries
        .unwrap_or_default()
        .into_iter()
        .filter_map(|e| {
            let name = e.name?;
            let category = e.category.unwrap_or_default();
            let value = e
                .value
                .map(|v| match v {
                    Value::String(s) => s,
                    other => other.to_string(),
                })
                .unwrap_or_default();
            Some(DnsRecord {
                name,
                category,
                value,
            })
        })
        .collect();

    Ok(records)
}
