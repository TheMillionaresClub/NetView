pub mod types;
pub mod transactions;
pub mod decoder;
pub mod network;

use std::cell::LazyCell;

use serde_json::json;
use reqwest_wasm::Client;
use wasm_bindgen::{JsValue, prelude::wasm_bindgen};

use crate::{network::{Network, get_transactions as transactions}, types::fetch_address_balance};

const CLIENT: LazyCell<Client> = LazyCell::new(|| {
    Client::new()
});

const NETWORK: Network = Network::Testnet;

#[wasm_bindgen]
pub async fn get_address_information(address: String) -> Result<String, JsValue> {
    let info = fetch_address_balance(&CLIENT, &address, &NETWORK)
        .await;
    match info {
        Ok(balance) => Ok(balance),
        Err(e) => {
            Err(serde_wasm_bindgen::to_value(&e)?)
        }
    }
}

#[wasm_bindgen]
pub async fn get_transactions(address: String, limit: u32, api_key: Option<String>) -> Result<JsValue, JsValue> {
    match transactions(&CLIENT, &NETWORK, &address, limit, api_key.as_deref()).await {
        Ok(transactions) => Ok(serde_wasm_bindgen::to_value(&transactions)?),
        Err(e) => Err(serde_wasm_bindgen::to_value(&json!{{"error": e.to_string()}})?)
    }
}