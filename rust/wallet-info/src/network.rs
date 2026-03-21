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
            Network::Testnet => "https://testnet.toncenter.com/api/v3/addressInformation",
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
// Page result
// ═══════════════════════════════════════════════════════════════════

/// Result of a single page fetch.
pub struct PageResult {
    pub transactions: Vec<Transaction>,
    /// (lt, hash) cursor pointing at the last tx in this page.
    /// `None` means this was the last page (fewer results than requested).
    pub next_cursor: Option<(u64, String)>,
}

// ═══════════════════════════════════════════════════════════════════
// Single-page fetch  (pagination handled by the TypeScript layer)
// ═══════════════════════════════════════════════════════════════════

/// toncenter v2 hard cap per request.
const PAGE_SIZE: u32 = 100;

/// Fetch one page of up to `limit` (max 100) transactions.
///
/// Pass `cursor` as `Some((lt, hash))` to start from a previous page's
/// last transaction — the TypeScript SSE route chains these calls with a
/// delay to avoid rate-limiting.
pub async fn get_transactions_page(
    client:  &Client,
    network: &Network,
    address: &str,
    limit:   u32,
    cursor:  Option<(u64, &str)>,
    api_key: Option<&str>,
) -> Result<PageResult, RpcError> {
    let page_size = limit.min(PAGE_SIZE);

    let body = JsonRpcRequest {
        jsonrpc: "2.0",
        id:      1,
        method:  "getTransactions",
        params:  GetTransactionsParams {
            address,
            limit:    page_size,
            archival: true,
            lt:   cursor.map(|(lt, _)| lt),
            hash: cursor.map(|(_, h)| h),
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

    let ext_txs = response.result;
    if ext_txs.is_empty() {
        return Ok(PageResult { transactions: vec![], next_cursor: None });
    }

    // The cursor for the next page is the oldest tx in this page (last element).
    let last = ext_txs.last().unwrap();
    let next_cursor = if (ext_txs.len() as u32) < page_size {
        None // Fewer results than requested → this is the last page.
    } else {
        Some((last.transaction_id.lt, last.transaction_id.hash.clone()))
    };

    // Skip index 0 on pages 2+ — the API re-returns the cursor tx as the
    // first element of each subsequent page to allow deduplication.
    let new_txs = if cursor.is_some() && ext_txs.len() > 1 {
        &ext_txs[1..]
    } else if cursor.is_some() {
        &ext_txs[0..0] // cursor tx was the only result — nothing new
    } else {
        &ext_txs[..]
    };

    Ok(PageResult {
        transactions: extract_transactions_from_slice(new_txs),
        next_cursor,
    })
}
