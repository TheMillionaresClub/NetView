use wasm_bindgen::prelude::*;

use crate::config::{Network, ScraperConfig};
use crate::orchestrator::ProfileBuilder;

/// Returns the crate version.
#[wasm_bindgen]
pub fn wallet_scraper_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Scrape a single wallet address for off-chain intelligence.
/// Returns a JSON string with the full WalletProfile.
///
/// `address`  — TON wallet address (any format)
/// `network`  — "mainnet" or "testnet" (default: mainnet)
/// `tonapi_key` — optional tonapi.io API key for higher rate limits
#[wasm_bindgen]
pub async fn scrape_wallet(
    address: String,
    network: Option<String>,
    tonapi_key: Option<String>,
) -> Result<String, JsValue> {
    console_error_panic_hook::set_once();

    let net = match network.as_deref() {
        Some(n) if n.eq_ignore_ascii_case("testnet") => Network::Testnet,
        _ => Network::Mainnet,
    };

    let mut config = ScraperConfig::new().with_network(net);
    if let Some(key) = tonapi_key {
        config = config.with_tonapi_key(key);
    }

    let builder = ProfileBuilder::new(&config);
    let profile = builder.build_profile(&address).await;

    serde_json::to_string(&profile)
        .map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Scrape multiple wallet addresses in parallel.
/// Returns a JSON string with GetWalletProfileResponse.
///
/// `addresses_json` — JSON array of address strings
/// `network`        — "mainnet" or "testnet" (default: mainnet)
/// `tonapi_key`     — optional tonapi.io API key
#[wasm_bindgen]
pub async fn scrape_wallets(
    addresses_json: String,
    network: Option<String>,
    tonapi_key: Option<String>,
) -> Result<String, JsValue> {
    console_error_panic_hook::set_once();

    let addresses: Vec<String> = serde_json::from_str(&addresses_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid addresses JSON: {}", e)))?;

    let net = match network.as_deref() {
        Some(n) if n.eq_ignore_ascii_case("testnet") => Network::Testnet,
        _ => Network::Mainnet,
    };

    let mut config = ScraperConfig::new().with_network(net);
    if let Some(key) = tonapi_key {
        config = config.with_tonapi_key(key);
    }

    let builder = ProfileBuilder::new(&config);
    let response = builder.build_profiles(&addresses).await;

    serde_json::to_string(&response)
        .map_err(|e| JsValue::from_str(&e.to_string()))
}
