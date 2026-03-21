pub mod types;
pub mod transactions;

use std::cell::LazyCell;

use reqwest_wasm::Client;
use wasm_bindgen::{JsValue, prelude::wasm_bindgen};

use crate::types::fetch_address_balance;

const CLIENT: LazyCell<Client> = LazyCell::new(|| {
    Client::new()
});

#[wasm_bindgen]
pub async fn get_address_information(address: String) -> Result<String, JsValue> {
    let info = fetch_address_balance(&CLIENT, &address)
        .await;
    match info {
        Ok(balance) => Ok(balance),
        Err(e) => {
            Err(serde_wasm_bindgen::to_value(&e)?)
        }
    }
}
