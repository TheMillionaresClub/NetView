use reqwest::header::{HeaderMap, HeaderValue, CONTENT_TYPE};
use serde::de::DeserializeOwned;

use crate::error::{AnalysisError, Result};

#[derive(Debug, Clone)]
pub enum Network {
    Mainnet,
    Testnet,
}

#[derive(Debug, Clone)]
pub struct TonClient {
    pub(crate) http: reqwest::Client,
    pub(crate) base_url_v2: String,
    pub(crate) base_url_v3: String,
    pub(crate) api_key: Option<String>,
}

impl TonClient {
    pub fn new(network: Network, api_key: Option<String>) -> Self {
        let (base_url_v2, base_url_v3) = match network {
            Network::Mainnet => (
                "https://toncenter.com/api/v2".to_string(),
                "https://toncenter.com/api/v3".to_string(),
            ),
            Network::Testnet => (
                "https://testnet.toncenter.com/api/v2".to_string(),
                "https://testnet.toncenter.com/api/v3".to_string(),
            ),
        };

        let mut default_headers = HeaderMap::new();
        default_headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

        let http = reqwest::Client::builder()
            .default_headers(default_headers)
            .build()
            .expect("Failed to build HTTP client");

        Self {
            http,
            base_url_v2,
            base_url_v3,
            api_key,
        }
    }

    pub(crate) async fn get<T: DeserializeOwned>(
        &self,
        url: &str,
        params: &[(&str, &str)],
    ) -> Result<T> {
        let mut req = self.http.get(url).query(params);

        if let Some(key) = &self.api_key {
            req = req.header("X-API-Key", key.as_str());
        }

        let response = req.send().await.map_err(AnalysisError::Http)?;

        if response.status() == reqwest::StatusCode::NOT_FOUND {
            return Err(AnalysisError::Api("404 Not Found".to_string()));
        }

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(AnalysisError::Api(format!(
                "HTTP {}: {}",
                status, body
            )));
        }

        let bytes = response.bytes().await.map_err(AnalysisError::Http)?;
        let parsed: T = serde_json::from_slice(&bytes).map_err(AnalysisError::Json)?;
        Ok(parsed)
    }
}
