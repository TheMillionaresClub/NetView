use serde::Deserialize;

use crate::client::TonClient;
use crate::error::{AnalysisError, Result};
use crate::types::identity::WalletInfo;

// ── Raw response shapes ──────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct V2Response<T> {
    ok: bool,
    result: Option<T>,
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TxId {
    lt:   String,
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

// ── Public API ───────────────────────────────────────────────────────────────

/// GET /v2/getWalletInformation?address=…
pub async fn get_wallet_information(
    client: &TonClient,
    address: &str,
) -> Result<WalletInfo> {
    let url = format!("{}/getWalletInformation", client.base_url_v2);
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
        last_transaction_lt:   raw.last_transaction_id.as_ref().map(|t| t.lt.clone()),
        last_transaction_hash: raw.last_transaction_id.map(|t| t.hash),
        account_state: raw.account_state,
    })
}
