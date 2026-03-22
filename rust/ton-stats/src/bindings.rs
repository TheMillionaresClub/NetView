use wasm_bindgen::prelude::*;

use crate::models::GetTonStatsRequest;
use crate::orchestrator::StatsBuilder;

/// Returns the crate version.
#[wasm_bindgen]
pub fn ton_stats_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Fetch global TON network stats from all configured sources.
/// Returns a JSON string with GetTonStatsResponse.
///
/// `request_json` — JSON string matching GetTonStatsRequest shape
#[wasm_bindgen]
pub async fn get_ton_stats(request_json: String) -> Result<String, JsValue> {
    console_error_panic_hook::set_once();

    let request: GetTonStatsRequest = serde_json::from_str(&request_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid request JSON: {}", e)))?;

    let builder = StatsBuilder::from_request(&request);
    let response = builder.build_snapshot().await;

    serde_json::to_string(&response)
        .map_err(|e| JsValue::from_str(&e.to_string()))
}
