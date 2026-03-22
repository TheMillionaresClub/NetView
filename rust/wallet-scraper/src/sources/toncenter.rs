use reqwest_wasm::Client;
use serde::Deserialize;

use crate::error::SourceError;
use crate::models::*;
use super::WalletSource;

// ══════════════════════════════════════════════════════════════════════════════
// TonCenterSource — fallback for basic account info via toncenter.com
//
// GET /api/v3/walletStates?address={addr}
// ══════════════════════════════════════════════════════════════════════════════

pub struct TonCenterSource {
    client: Client,
    base_url: String,
    api_key: Option<String>,
}

impl TonCenterSource {
    pub fn new(client: Client, api_key: Option<String>, base_url: &str) -> Self {
        Self { client, api_key, base_url: base_url.to_string() }
    }

    async fn get_json(&self, url: &str) -> Result<String, SourceError> {
        let mut delay_ms = 1000u64;

        for attempt in 0..=2u32 {
            let mut req = self.client.get(url);
            if let Some(key) = &self.api_key {
                req = req.header("X-API-Key", key.as_str());
            }

            let resp = req.send().await?;
            let status = resp.status();

            if status == reqwest_wasm::StatusCode::TOO_MANY_REQUESTS {
                if attempt < 2 {
                    #[cfg(not(target_arch = "wasm32"))]
                    std::thread::sleep(std::time::Duration::from_millis(delay_ms));
                    delay_ms *= 2;
                    continue;
                }
                return Err(SourceError::RateLimit(delay_ms));
            }
            if status == reqwest_wasm::StatusCode::NOT_FOUND {
                return Err(SourceError::NotFound);
            }
            if !status.is_success() {
                let body = resp.text().await.unwrap_or_default();
                return Err(SourceError::Http(status.as_u16(), body));
            }

            return Ok(resp.text().await.map_err(|e| SourceError::Http(0, e.to_string()))?);
        }

        Err(SourceError::RateLimit(delay_ms))
    }

    pub fn parse_wallet_states_response(json: &str) -> Result<Option<WalletInsight>, SourceError> {
        let raw: RawWalletStatesResponse = serde_json::from_str(json)?;
        let wallets = raw.wallets.unwrap_or_default();

        let wallet = match wallets.into_iter().next() {
            Some(w) => w,
            None => return Ok(None),
        };

        let balance_nano: u64 = wallet.balance.parse().unwrap_or(0);
        let balance_ton = balance_nano as f64 / 1_000_000_000.0;
        let is_active = wallet.status.as_deref() == Some("active");
        let wallet_type = wallet.wallet_type.unwrap_or_else(|| "unknown".into());

        Ok(Some(WalletInsight::AccountMeta(AccountMeta {
            balance_ton,
            wallet_type,
            tx_count: 0,
            is_active,
            last_activity: None,
            linked_name: None,
            icon_url: None,
            source: "toncenter".into(),
        })))
    }

    pub fn parse_v2_wallet_info(json: &str) -> Result<Option<WalletInsight>, SourceError> {
        let raw: V2Response<RawV2WalletInfo> = serde_json::from_str(json)?;
        if !raw.ok {
            return Ok(None);
        }

        let info = match raw.result {
            Some(i) => i,
            None => return Ok(None),
        };

        let balance_nano: u64 = info.balance.parse().unwrap_or(0);
        let balance_ton = balance_nano as f64 / 1_000_000_000.0;
        let is_active = info.account_state.as_deref() == Some("active");
        let wallet_type = info.wallet_type.unwrap_or_else(|| "unknown".into());

        Ok(Some(WalletInsight::AccountMeta(AccountMeta {
            balance_ton,
            wallet_type,
            tx_count: 0,
            is_active,
            last_activity: None,
            linked_name: None,
            icon_url: None,
            source: "toncenter".into(),
        })))
    }
}

impl WalletSource for TonCenterSource {
    fn source_name(&self) -> &'static str {
        "toncenter"
    }

    async fn fetch(&self, address: &str) -> Result<Vec<WalletInsight>, SourceError> {
        let url = format!("{}/v3/walletStates?address={}", self.base_url, address);
        let json = self.get_json(&url).await?;
        match Self::parse_wallet_states_response(&json)? {
            Some(insight) => Ok(vec![insight]),
            None => Ok(vec![]),
        }
    }
}

// ── Raw API response types ───────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct RawWalletStatesResponse {
    wallets: Option<Vec<RawWalletState>>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct RawWalletState {
    balance: String,
    status: Option<String>,
    wallet_type: Option<String>,
    is_wallet: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct V2Response<T> {
    ok: bool,
    result: Option<T>,
}

#[derive(Debug, Deserialize)]
struct RawV2WalletInfo {
    balance: String,
    wallet_type: Option<String>,
    account_state: Option<String>,
}

// ══════════════════════════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_wallet_states_basic() {
        let json = r#"{
            "wallets": [{
                "balance": "3500000000",
                "status": "active",
                "wallet_type": "wallet_v4r2",
                "is_wallet": true
            }]
        }"#;
        let result = TonCenterSource::parse_wallet_states_response(json).unwrap().unwrap();
        if let WalletInsight::AccountMeta(meta) = result {
            assert!((meta.balance_ton - 3.5).abs() < 0.001);
            assert_eq!(meta.wallet_type, "wallet_v4r2");
            assert!(meta.is_active);
            assert_eq!(meta.source, "toncenter");
        } else {
            panic!("expected AccountMeta");
        }
    }

    #[test]
    fn parse_wallet_states_empty() {
        let json = r#"{"wallets": []}"#;
        assert!(TonCenterSource::parse_wallet_states_response(json).unwrap().is_none());
    }

    #[test]
    fn parse_wallet_states_missing() {
        let json = r#"{}"#;
        assert!(TonCenterSource::parse_wallet_states_response(json).unwrap().is_none());
    }

    #[test]
    fn parse_v2_wallet_info_ok() {
        let json = r#"{
            "ok": true,
            "result": {
                "balance": "10000000000",
                "wallet_type": "wallet_v3r2",
                "account_state": "active"
            }
        }"#;
        let result = TonCenterSource::parse_v2_wallet_info(json).unwrap().unwrap();
        if let WalletInsight::AccountMeta(meta) = result {
            assert!((meta.balance_ton - 10.0).abs() < 0.001);
            assert_eq!(meta.wallet_type, "wallet_v3r2");
        } else {
            panic!("expected AccountMeta");
        }
    }

    #[test]
    fn parse_v2_wallet_info_not_ok() {
        let json = r#"{"ok": false, "result": null}"#;
        assert!(TonCenterSource::parse_v2_wallet_info(json).unwrap().is_none());
    }
}
