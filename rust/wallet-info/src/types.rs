use reqwest_wasm::{Client, Error};
use serde::{Deserialize, Serialize};

use crate::network::Network;

#[derive(Debug, Deserialize, Serialize)]
pub struct RequestError {
    pub code: u16,
    pub error: String,
}


#[derive(Deserialize)]
pub struct AddressInformation {
    pub balance: String,
    pub code: Option<String>,
    pub data: Option<String>,
    pub frozen_hash: Option<String>,
    pub last_transaction_hash: Option<String>,
    pub last_transaction_lt: Option<String>,
    pub status: Option<String>,
}

impl RequestError {
    pub fn new(error: String, code: u16) -> Self {
        Self { code, error }
    }
}

impl From<Error> for RequestError {
    fn from(value: Error) -> Self {
        Self::new(value.to_string(), value.status().map(|s| s.as_u16()).unwrap_or(500))
    }
}

pub async fn fetch_address_balance(client: &Client, address: &str, network: &Network) -> Result<String, RequestError> {
    let resp = client.get(network.balance_url())
        .query(&[("address", address)])
        .send()
        .await?
        .error_for_status()?;
    let info: AddressInformation = resp.json().await?;
    Ok(info.balance)
}