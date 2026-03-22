use std::cell::RefCell;
use std::collections::HashMap;

use reqwest_wasm::Client;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::JsFuture;

use crate::error::TonError;
use crate::types::{AccountEvent, AccountEventsResponse, AccountInfoResponse};

const MAX_RETRIES: u32 = 3;

pub struct TonApiClient {
    base_url: String,
    api_key: String,
    http: Client,
    cache: RefCell<HashMap<String, Vec<AccountEvent>>>,
}

impl TonApiClient {
    pub fn new(api_key: &str, network: &str) -> Self {
        let base_url = match network {
            "mainnet" => "https://tonapi.io/v2".to_string(),
            _ => "https://testnet.tonapi.io/v2".to_string(),
        };
        Self {
            base_url,
            api_key: api_key.to_string(),
            http: Client::new(),
            cache: RefCell::new(HashMap::new()),
        }
    }

    /// Sleep using a JS Promise (works in WASM, unlike tokio::time::sleep).
    async fn js_sleep(ms: u32) -> Result<(), TonError> {
        let promise = js_sys::Promise::new(&mut |resolve, _reject| {
            let global = js_sys::global();
            let set_timeout = js_sys::Reflect::get(&global, &JsValue::from_str("setTimeout"))
                .unwrap_or(JsValue::UNDEFINED);
            if set_timeout.is_function() {
                let func: js_sys::Function = set_timeout.unchecked_into();
                let _ = func.call2(&JsValue::NULL, &resolve, &JsValue::from(ms));
            } else {
                let _ = resolve.call0(&JsValue::NULL);
            }
        });
        JsFuture::from(promise)
            .await
            .map_err(|e| TonError::JsError(format!("sleep failed: {:?}", e)))?;
        Ok(())
    }

    /// Make a GET request with retry + exponential backoff for 429 responses.
    async fn get_with_retry<T: serde::de::DeserializeOwned>(
        &self,
        url: &str,
    ) -> Result<T, TonError> {
        let mut delay_ms = 1000u32;

        for attempt in 0..=MAX_RETRIES {
            let mut req = self.http.get(url);
            if !self.api_key.is_empty() {
                req = req.header("Authorization", format!("Bearer {}", self.api_key));
            }
            let resp = req.send().await?;

            let status = resp.status().as_u16();

            if status == 429 {
                if attempt < MAX_RETRIES {
                    Self::js_sleep(delay_ms).await?;
                    delay_ms *= 2;
                    continue;
                }
                return Err(TonError::RateLimit(delay_ms as u64));
            }

            if !resp.status().is_success() {
                let body = resp.text().await.unwrap_or_default();
                return Err(TonError::ApiError(status, body));
            }

            let text = resp.text().await?;
            let parsed: T = serde_json::from_str(&text)?;
            return Ok(parsed);
        }

        Err(TonError::RateLimit(delay_ms as u64))
    }

    /// Resolve any address format to the raw `0:hex` format that tonapi uses internally.
    /// Queries the tonapi `/v2/accounts/{id}` endpoint which accepts any format
    /// and returns the raw address.
    pub async fn resolve_raw_address(&self, address: &str) -> Result<String, TonError> {
        // Already raw format
        if address.contains(':') {
            return Ok(address.to_string());
        }
        let url = format!("{}/accounts/{}", self.base_url, address);
        let info: AccountInfoResponse = self.get_with_retry(&url).await?;
        Ok(info.address)
    }

    /// Fetch account events from tonapi.io.
    /// Results are cached in-memory keyed by `"{address}:{before_lt}"`.
    pub async fn get_account_events(
        &self,
        address: &str,
        before_lt: Option<u64>,
        limit: u32,
    ) -> Result<Vec<AccountEvent>, TonError> {
        let cache_key = format!("{}:{}", address, before_lt.unwrap_or(0));

        // Check cache
        if let Some(cached) = self.cache.borrow().get(&cache_key) {
            return Ok(cached.clone());
        }

        let mut url = format!(
            "{}/accounts/{}/events?limit={}",
            self.base_url, address, limit
        );
        if let Some(lt) = before_lt {
            url.push_str(&format!("&before_lt={}", lt));
        }

        let resp: AccountEventsResponse = self.get_with_retry(&url).await?;
        let events = resp.events;

        // Store in cache
        self.cache.borrow_mut().insert(cache_key, events.clone());

        Ok(events)
    }

    /// Fetch timestamp range of recent events for an address.
    /// Returns (min_timestamp, max_timestamp).
    pub async fn get_account_timestamps(
        &self,
        address: &str,
    ) -> Result<(u64, u64), TonError> {
        let events = self.get_account_events(address, None, 100).await?;
        if events.is_empty() {
            return Ok((0, 0));
        }
        let min_ts = events.iter().map(|e| e.timestamp).min().unwrap_or(0);
        let max_ts = events.iter().map(|e| e.timestamp).max().unwrap_or(0);
        Ok((min_ts, max_ts))
    }

    /// Fetch the transaction count for an address (degree check).
    pub async fn get_account_degree(&self, address: &str) -> Result<u64, TonError> {
        let url = format!("{}/accounts/{}", self.base_url, address);
        let info: AccountInfoResponse = self.get_with_retry(&url).await?;
        Ok(info.transactions_count)
    }

    /// Extract counterpart addresses from a list of events.
    /// Returns (counterpart_address, tx_hash, amount, lt) tuples.
    /// All returned addresses are in raw `0:hex` format (as tonapi returns them).
    pub fn extract_counterparts(
        events: &[AccountEvent],
        owner_address: &str,
    ) -> Vec<(String, String, i64, u64)> {
        let mut results = Vec::new();

        for event in events {
            for action in &event.actions {
                match action.action_type.as_str() {
                    "TonTransfer" => {
                        if let Some(ref transfer) = action.ton_transfer {
                            // tonapi returns raw addresses, so comparison works directly
                            let counterpart = if transfer.sender.address == owner_address {
                                &transfer.recipient.address
                            } else {
                                &transfer.sender.address
                            };
                            results.push((
                                counterpart.clone(),
                                event.event_id.clone(),
                                transfer.amount,
                                event.lt,
                            ));
                        }
                    }
                    "JettonTransfer" => {
                        if let Some(ref transfer) = action.jetton_transfer {
                            let counterpart = if transfer
                                .sender
                                .as_ref()
                                .is_some_and(|s| s.address == owner_address)
                            {
                                transfer.recipient.as_ref().map(|r| &r.address)
                            } else {
                                transfer.sender.as_ref().map(|s| &s.address)
                            };
                            if let Some(addr) = counterpart {
                                let amount = transfer
                                    .amount
                                    .parse::<i64>()
                                    .unwrap_or(0);
                                results.push((
                                    addr.clone(),
                                    event.event_id.clone(),
                                    amount,
                                    event.lt,
                                ));
                            }
                        }
                    }
                    _ => {} // skip other action types
                }
            }
        }

        results
    }
}
