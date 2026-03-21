use reqwest_wasm::Client;
use serde::{Deserialize, Serialize};

use crate::transactions::types::RpcResponse;
use crate::transactions::Transaction;
use crate::transactions::extract_transactions_from_slice;

const MAINNET: &str = "https://toncenter.com/api/v2/jsonRPC";
const TESTNET: &str = "https://testnet.toncenter.com/api/v2/jsonRPC";

// ═══════════════════════════════════════════════════════════════════
// JSON-RPC wire types
// ═══════════════════════════════════════════════════════════════════

#[derive(Debug, Serialize)]
struct JsonRpcRequest<'a> {
    jsonrpc: &'a str,
    id:      u32,
    method:  &'a str,
    params:  GetTransactionsParams<'a>,
}

#[derive(Debug, Serialize)]
struct GetTransactionsParams<'a> {
    address:  &'a str,
    limit:    u32,
    archival: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    lt:       Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    hash:     Option<&'a str>,
}

/// The full JSON-RPC envelope around the RPC response.
/// We only need `result` — errors surface as a `reqwest`/`serde` error.
#[derive(Debug, Deserialize)]
struct JsonRpcEnvelope {
    #[serde(flatten)]
    inner: RpcResponse,
}

// ═══════════════════════════════════════════════════════════════════
// Network selector
// ═══════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Copy)]
pub enum Network {
    Mainnet,
    Testnet,
}

impl Network {
    pub fn url(&self) -> &'static str {
        match self {
            Network::Mainnet => MAINNET,
            Network::Testnet => TESTNET,
        }
    }
    
    pub fn balance_url(&self) -> &str {
        match self {
            Network::Mainnet => "https://www.toncenter.com/api/v3/addressInformation",
            Network::Testnet => "https://testnet.toncenter.com/api/v3/addressInformation"
        }
    }
}

// ═══════════════════════════════════════════════════════════════════
// Error
// ═══════════════════════════════════════════════════════════════════

#[derive(Debug, thiserror::Error)]
pub enum RpcError {
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest_wasm::Error),

    #[error("JSON-RPC returned ok=false")]
    ApiError,
}

// ═══════════════════════════════════════════════════════════════════
// Main function
// ═══════════════════════════════════════════════════════════════════

const PAGE_SIZE: u32 = 100;

/// Fetch up to `limit` transactions for `address` and return them as
/// a `Vec<Transaction>` with `action`, `amount`, `timestamp`, `fee`.
///
/// Automatically paginates using the `(lt, hash)` cursor when `limit > 100`,
/// since the toncenter v2 API caps each page at 100 transactions.
/// Pass `api_key` to authenticate and get a higher rate limit.
pub async fn get_transactions(
    client:  &Client,
    network: &Network,
    address: &str,
    limit:   u32,
    api_key: Option<&str>,
) -> Result<Vec<Transaction>, RpcError> {
    let mut all_txs: Vec<Transaction> = Vec::new();
    // (lt, hash) cursor — None means "start from the most recent transaction"
    let mut cursor: Option<(u64, String)> = None;

    loop {
        let remaining = limit.saturating_sub(all_txs.len() as u32);
        if remaining == 0 {
            break;
        }
        let page_limit = remaining.min(PAGE_SIZE);

        let body = JsonRpcRequest {
            jsonrpc: "2.0",
            id:      1,
            method:  "getTransactions",
            params:  GetTransactionsParams {
                address,
                limit:    page_limit,
                archival: true,
                lt:       cursor.as_ref().map(|(lt, _)| *lt),
                hash:     cursor.as_ref().map(|(_, h)| h.as_str()),
            },
        };

        let mut req = client.post(network.url()).json(&body);
        if let Some(key) = api_key {
            req = req.header("X-API-Key", key);
        }
        let response: RpcResponse = req
            .send()
            .await?
            .error_for_status()?
            .json()
            .await?;

        if !response.ok {
            return Err(RpcError::ApiError);
        }

        let ext_txs = &response.result;

        // The API re-returns the cursor transaction as the first result of
        // subsequent pages — skip it to avoid duplicates.
        let page = if cursor.is_some() && !ext_txs.is_empty() {
            &ext_txs[1..]
        } else {
            ext_txs.as_slice()
        };

        if page.is_empty() {
            break;
        }

        // Update cursor to the last (oldest) transaction on this page.
        let last = ext_txs.last().unwrap();
        cursor = Some((last.transaction_id.lt, last.transaction_id.hash.clone()));

        all_txs.extend(extract_transactions_from_slice(page));

        // If we got fewer results than requested this was the last page.
        if (ext_txs.len() as u32) < page_limit {
            break;
        }
    }

    Ok(all_txs)
}
