use serde::{Deserialize, Serialize};

// ── Network selector ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Network {
    Mainnet,
    Testnet,
}

impl Default for Network {
    fn default() -> Self {
        Self::Mainnet
    }
}

impl Network {
    pub fn tonapi_base(&self) -> &'static str {
        match self {
            Self::Mainnet => "https://tonapi.io",
            Self::Testnet => "https://testnet.tonapi.io",
        }
    }

    pub fn toncenter_base(&self) -> &'static str {
        match self {
            Self::Mainnet => "https://toncenter.com/api",
            Self::Testnet => "https://testnet.toncenter.com/api",
        }
    }
}

/// Configuration for the wallet scraper — determines which sources are enabled
/// based on the API keys provided.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ScraperConfig {
    pub network: Network,
    pub tonapi_key: Option<String>,
    pub toncenter_api_key: Option<String>,
    pub bitquery_key: Option<String>,
    pub telegram_bot_token: Option<String>,
    pub risk_api_key: Option<String>,
    /// If set, only run these sources (by name). If None, run all available.
    pub enabled_sources: Option<Vec<String>>,
}

impl ScraperConfig {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_network(mut self, network: Network) -> Self {
        self.network = network;
        self
    }

    pub fn with_tonapi_key(mut self, key: impl Into<String>) -> Self {
        self.tonapi_key = Some(key.into());
        self
    }

    pub fn with_toncenter_api_key(mut self, key: impl Into<String>) -> Self {
        self.toncenter_api_key = Some(key.into());
        self
    }

    pub fn with_bitquery_key(mut self, key: impl Into<String>) -> Self {
        self.bitquery_key = Some(key.into());
        self
    }

    pub fn with_telegram_bot_token(mut self, token: impl Into<String>) -> Self {
        self.telegram_bot_token = Some(token.into());
        self
    }

    pub fn with_risk_api_key(mut self, key: impl Into<String>) -> Self {
        self.risk_api_key = Some(key.into());
        self
    }

    pub fn with_enabled_sources(mut self, sources: Vec<String>) -> Self {
        self.enabled_sources = Some(sources);
        self
    }

    /// Check if a source name is allowed by the config filter.
    pub fn is_source_enabled(&self, name: &str) -> bool {
        match &self.enabled_sources {
            None => true,
            Some(list) => list.iter().any(|s| s == name),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builder_chain() {
        let config = ScraperConfig::new()
            .with_tonapi_key("key123")
            .with_bitquery_key("bq456")
            .with_enabled_sources(vec!["tonapi".into(), "tonscan".into()]);

        assert_eq!(config.tonapi_key.as_deref(), Some("key123"));
        assert_eq!(config.bitquery_key.as_deref(), Some("bq456"));
        assert!(config.is_source_enabled("tonapi"));
        assert!(config.is_source_enabled("tonscan"));
        assert!(!config.is_source_enabled("bitquery"));
    }

    #[test]
    fn no_filter_enables_all() {
        let config = ScraperConfig::new();
        assert!(config.is_source_enabled("tonapi"));
        assert!(config.is_source_enabled("anything"));
    }

    #[test]
    fn config_serializes() {
        let config = ScraperConfig::new().with_tonapi_key("secret");
        let json = serde_json::to_string(&config).unwrap();
        let back: ScraperConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(back.tonapi_key.as_deref(), Some("secret"));
    }
}
