use reqwest_wasm::Client;
use serde::de::DeserializeOwned;

use crate::network::Network;

// ── Error ─────────────────────────────────────────────────────────────────────

#[derive(Debug, thiserror::Error)]
pub enum AnalysisError {
    #[error("HTTP: {0}")]
    Http(#[from] reqwest_wasm::Error),
    #[error("JSON: {0}")]
    Json(#[from] serde_json::Error),
    #[error("API: {0}")]
    Api(String),
}

pub type Result<T> = std::result::Result<T, AnalysisError>;

// ── Client ────────────────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct TonAnalysisClient {
    pub http:    Client,
    pub network: Network,
    pub base_v2: String,
    pub base_v3: String,
    api_key:     Option<String>,
}

impl TonAnalysisClient {
    pub fn new(network: &Network, api_key: Option<String>) -> Self {
        let (base_v2, base_v3) = match network {
            Network::Mainnet => (
                "https://toncenter.com/api/v2".to_string(),
                "https://toncenter.com/api/v3".to_string(),
            ),
            Network::Testnet => (
                "https://testnet.toncenter.com/api/v2".to_string(),
                "https://testnet.toncenter.com/api/v3".to_string(),
            ),
        };
        Self { http: Client::new(), network: *network, base_v2, base_v3, api_key }
    }

    pub fn api_key(&self) -> Option<&str> {
        self.api_key.as_deref()
    }

    pub async fn get<T: DeserializeOwned>(
        &self,
        url:    &str,
        params: &[(&str, &str)],
    ) -> Result<T> {
        let mut req = self.http.get(url).query(params);
        if let Some(key) = &self.api_key {
            req = req.header("X-API-Key", key.as_str());
        }

        let resp = req.send().await.map_err(AnalysisError::Http)?;

        if resp.status() == reqwest_wasm::StatusCode::NOT_FOUND {
            return Err(AnalysisError::Api("404 Not Found".to_string()));
        }
        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AnalysisError::Api(format!("HTTP {status}: {body}")));
        }

        let bytes = resp.bytes().await.map_err(AnalysisError::Http)?;
        serde_json::from_slice(&bytes).map_err(AnalysisError::Json)
    }
}
