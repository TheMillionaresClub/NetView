pub mod types;
pub mod transactions;
pub mod decoder;
pub mod network;
pub mod analysis;

use std::cell::LazyCell;

use serde::Serialize;
use serde_json::json;
use reqwest_wasm::Client;
use wasm_bindgen::{JsValue, prelude::wasm_bindgen};

use crate::{
    network::{Network, get_transactions_page},
    transactions::Transaction,
    types::fetch_address_balance,
};

fn parse_network(s: Option<&str>) -> Network {
    match s {
        Some(n) if n.eq_ignore_ascii_case("mainnet") => Network::Mainnet,
        _ => Network::Testnet,
    }
}

const CLIENT: LazyCell<Client> = LazyCell::new(|| Client::new());
const NETWORK: Network = Network::Testnet;

// ── Wasm return type: transactions + optional cursor for next page ─
#[derive(Serialize)]
struct PageResult {
    transactions: Vec<Transaction>,
    /// Logical time of the oldest tx — pass back as `lt` to get the next page.
    /// String to avoid JS 64-bit integer precision loss.
    next_lt:   Option<String>,
    next_hash: Option<String>,
}

#[wasm_bindgen]
pub async fn get_address_information(address: String) -> Result<String, JsValue> {
    match fetch_address_balance(&CLIENT, &address, &NETWORK).await {
        Ok(balance) => Ok(balance),
        Err(e) => Err(serde_wasm_bindgen::to_value(&e)?),
    }
}

/// Fetch one page of transactions (max 100).
///
/// Pass `lt` + `hash` from the previous call's `next_lt` / `next_hash` to
/// continue from where you left off.  When `next_lt` is `null` in the
/// response there are no more pages.
#[wasm_bindgen]
pub async fn get_transactions(
    address: String,
    limit:   u32,
    lt:      Option<String>,
    hash:    Option<String>,
    api_key: Option<String>,
) -> Result<JsValue, JsValue> {
    // Parse the optional lt string → u64 cursor
    let cursor: Option<(u64, String)> = match (lt, hash) {
        (Some(lt_str), Some(hash_str)) => {
            let lt_val = lt_str.parse::<u64>().map_err(|e| {
                serde_wasm_bindgen::to_value(&json!({ "error": e.to_string() })).unwrap()
            })?;
            Some((lt_val, hash_str))
        }
        _ => None,
    };

    let cursor_ref = cursor.as_ref().map(|(lt, h)| (*lt, h.as_str()));

    match get_transactions_page(&CLIENT, &NETWORK, &address, limit, cursor_ref, api_key.as_deref()).await {
        Ok(result) => {
            let page = PageResult {
                transactions: result.transactions,
                next_lt:   result.next_cursor.as_ref().map(|(lt, _)| lt.to_string()),
                next_hash: result.next_cursor.map(|(_, h)| h),
            };
            Ok(serde_wasm_bindgen::to_value(&page)?)
        }
        Err(e) => Err(serde_wasm_bindgen::to_value(&json!({ "error": e.to_string() }))?),
    }
}

/// Fetch a full wallet profile: identity, balance, tokens, NFTs, DNS,
/// recent transactions (100), and a heuristic classification.
///
/// `network` — `"mainnet"` or `"testnet"` (default: testnet)
#[wasm_bindgen]
pub async fn analyze_wallet(
    address: String,
    network: Option<String>,
    api_key: Option<String>,
) -> Result<JsValue, JsValue> {
    let net = parse_network(network.as_deref());
    let client = analysis::make_client(&net, api_key);

    match analysis::analyze_wallet(&client, &address).await {
        Ok(profile) => serde_wasm_bindgen::to_value(&profile)
            .map_err(|e| serde_wasm_bindgen::to_value(&json!({ "error": e.to_string() })).unwrap()),
        Err(e) => Err(serde_wasm_bindgen::to_value(&json!({ "error": e.to_string() })).unwrap()),
    }
}
