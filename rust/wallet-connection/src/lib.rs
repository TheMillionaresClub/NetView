pub mod error;
pub mod graph;
pub mod optimizer;
pub mod ton_client;
pub mod traversal;
pub mod types;

use std::rc::Rc;

use wasm_bindgen::prelude::*;

use crate::ton_client::TonApiClient;
use crate::traversal::BidirectionalBFS;
use crate::types::{FindConnectionRequest, TraversalConfig};

/// Find connection (no progress callback — simple version).
#[wasm_bindgen]
pub async fn find_wallet_connection(request: JsValue) -> Result<JsValue, JsValue> {
    find_wallet_connection_impl(request, None).await
}

/// Find connection with a progress callback for live updates.
/// `on_progress(info)` is called after each node expansion.
/// If `on_progress` returns `false`, the search is cancelled.
#[wasm_bindgen]
pub async fn find_wallet_connection_streaming(
    request: JsValue,
    on_progress: js_sys::Function,
) -> Result<JsValue, JsValue> {
    find_wallet_connection_impl(request, Some(on_progress)).await
}

async fn find_wallet_connection_impl(
    request: JsValue,
    on_progress: Option<js_sys::Function>,
) -> Result<JsValue, JsValue> {
    console_error_panic_hook::set_once();

    let req: FindConnectionRequest = serde_wasm_bindgen::from_value(request)
        .map_err(|e| JsValue::from_str(&format!("Invalid request: {}", e)))?;

    let api_key = req.api_key.as_deref().unwrap_or_default();
    let network = req.network.as_deref().unwrap_or("testnet");

    let client = Rc::new(TonApiClient::new(api_key, network));

    let raw_a = client
        .resolve_raw_address(&req.wallet_a)
        .await
        .map_err(|e| JsValue::from_str(&format!("Failed to resolve wallet_a: {}", e)))?;
    let raw_b = client
        .resolve_raw_address(&req.wallet_b)
        .await
        .map_err(|e| JsValue::from_str(&format!("Failed to resolve wallet_b: {}", e)))?;

    let config = TraversalConfig::from_request(&req);
    let bfs = BidirectionalBFS::new(client, config);

    let result = bfs
        .find_connection(&raw_a, &raw_b, on_progress.as_ref())
        .await
        .map_err(|e| JsValue::from(e))?;

    match result {
        Some(path) => {
            let json = serde_json::to_string(&path)
                .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))?;
            Ok(JsValue::from_str(&json))
        }
        None => Ok(JsValue::from_str(
            r#"{"found":false,"path":[],"depth":0,"nodes_explored":0,"elapsed_ms":0}"#,
        )),
    }
}
