use reqwest_wasm::Client;
use serde::{Deserialize, Serialize};

use crate::transactions::types::RpcResponse;
use crate::transactions::Transaction;
use crate::transactions::extract_transactions;

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

/// Fetch up to `limit` transactions for `address` and return them as
/// a `Vec<Transaction>` with `action`, `amount`, `timestamp`, `fee`.
pub async fn get_transactions(
    client:  &Client,
    network: &Network,
    address: &str,
    limit:   u32,
) -> Result<Vec<Transaction>, RpcError> {
    let body = JsonRpcRequest {
        jsonrpc: "2.0",
        id:      1,
        method:  "getTransactions",
        params:  GetTransactionsParams {
            address,
            limit,
            archival: true,
        },
    };

    let response: RpcResponse = client
        .post(network.url())
        .json(&body)
        .send()
        .await?
        .error_for_status()?   // surfaces 4xx / 5xx as RpcError::Http
        .json()
        .await?;

    if !response.ok {
        return Err(RpcError::ApiError);
    }

    Ok(extract_transactions(&response))
}
