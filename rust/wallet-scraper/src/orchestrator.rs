use futures::future::join_all;
use reqwest_wasm::Client;

use crate::config::ScraperConfig;
use crate::error::SourceErrorReport;
use crate::models::*;
use crate::sources::SourceKind;
use crate::sources::tonapi::TonApiSource;
use crate::sources::tonapi_events::TonApiEventsSource;
use crate::sources::toncenter::TonCenterSource;
use crate::sources::bitquery::BitQuerySource;
use crate::sources::tonscan_scraper::TonscanScraper;
use crate::sources::getgems_scraper::GetGemsScraper;
use crate::sources::fragment_scraper::FragmentScraper;

// ══════════════════════════════════════════════════════════════════════════════
// ProfileBuilder — orchestrates parallel source fetching and aggregation
// ══════════════════════════════════════════════════════════════════════════════

pub struct ProfileBuilder {
    sources: Vec<SourceKind>,
}

impl ProfileBuilder {
    /// Construct a ProfileBuilder from config. Sources are instantiated based
    /// on which API keys are present and the `enabled_sources` filter.
    pub fn new(config: &ScraperConfig) -> Self {
        let client = Client::new();
        let network = &config.network;
        let mut sources: Vec<SourceKind> = Vec::new();

        // TonApi — works without key (lower rate limits), better with key
        if config.is_source_enabled("tonapi") {
            sources.push(SourceKind::TonApi(
                TonApiSource::new(client.clone(), config.tonapi_key.clone(), network.tonapi_base()),
            ));
        }

        // TonApi Events — scans transaction events for counterparty Telegram identities
        if config.is_source_enabled("tonapi_events") {
            sources.push(SourceKind::TonApiEvents(
                TonApiEventsSource::new(client.clone(), config.tonapi_key.clone(), network.tonapi_base()),
            ));
        }

        // TonCenter — optional API key
        if config.is_source_enabled("toncenter") {
            sources.push(SourceKind::TonCenter(
                TonCenterSource::new(client.clone(), config.toncenter_api_key.clone(), network.toncenter_base()),
            ));
        }

        // BitQuery — requires API key
        if let Some(key) = &config.bitquery_key {
            if config.is_source_enabled("bitquery") {
                sources.push(SourceKind::BitQuery(
                    BitQuerySource::new(client.clone(), key.clone()),
                ));
            }
        }

        // Scrapers — no API key needed (only useful on mainnet)
        if config.is_source_enabled("tonscan") {
            sources.push(SourceKind::Tonscan(
                TonscanScraper::new(client.clone()),
            ));
        }

        if config.is_source_enabled("getgems") {
            sources.push(SourceKind::GetGems(
                GetGemsScraper::new(client.clone()),
            ));
        }

        if config.is_source_enabled("fragment") {
            sources.push(SourceKind::Fragment(
                FragmentScraper::new(client.clone(), config.telegram_bot_token.clone()),
            ));
        }

        Self { sources }
    }

    /// Build from an explicit list of sources (useful for testing).
    pub fn from_sources(sources: Vec<SourceKind>) -> Self {
        Self { sources }
    }

    /// Returns the number of enabled sources.
    pub fn source_count(&self) -> usize {
        self.sources.len()
    }

    /// Fetch all sources in parallel for a single address and aggregate.
    pub async fn build_profile(&self, address: &str) -> WalletProfile {
        let start = now_ms();

        let futures: Vec<_> = self.sources
            .iter()
            .map(|source| {
                let name = source.source_name();
                async move {
                    let result = source.fetch(address).await;
                    (name, result)
                }
            })
            .collect();

        let results = join_all(futures).await;

        let mut insights: Vec<WalletInsight> = Vec::new();
        let mut errors: Vec<SourceErrorReport> = Vec::new();

        for (name, result) in results {
            match result {
                Ok(source_insights) => insights.extend(source_insights),
                Err(err) => errors.push(SourceErrorReport::new(name, &err)),
            }
        }

        // Dedup: prefer tonapi AccountMeta over toncenter
        Self::dedup_account_meta(&mut insights);

        let elapsed_ms = now_ms() - start;

        WalletProfile {
            address: address.to_string(),
            insights,
            errors,
            elapsed_ms,
        }
    }

    /// Fetch profiles for multiple addresses in parallel.
    pub async fn build_profiles(&self, addresses: &[String]) -> GetWalletProfileResponse {
        let start = now_ms();

        let futures: Vec<_> = addresses
            .iter()
            .map(|addr| self.build_profile(addr))
            .collect();

        let profiles = join_all(futures).await;
        let total_elapsed_ms = now_ms() - start;

        GetWalletProfileResponse {
            profiles,
            total_elapsed_ms,
        }
    }

    /// If we have multiple AccountMeta insights, prefer tonapi over toncenter.
    fn dedup_account_meta(insights: &mut Vec<WalletInsight>) {
        let account_meta_count = insights
            .iter()
            .filter(|i| matches!(i, WalletInsight::AccountMeta(_)))
            .count();

        if account_meta_count <= 1 {
            return;
        }

        // Keep the tonapi one, remove toncenter duplicates
        let has_tonapi = insights.iter().any(|i| {
            matches!(i, WalletInsight::AccountMeta(m) if m.source == "tonapi")
        });

        if has_tonapi {
            insights.retain(|i| {
                !matches!(i, WalletInsight::AccountMeta(m) if m.source == "toncenter")
            });
        }
    }
}

// ── Platform-aware timing ────────────────────────────────────────────────────

#[cfg(target_arch = "wasm32")]
fn now_ms() -> u64 {
    js_sys::Date::now() as u64
}

#[cfg(not(target_arch = "wasm32"))]
fn now_ms() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

// ══════════════════════════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::SourceError;
    use crate::sources::TestSource;

    fn make_test_source(name: &'static str, insights: Vec<WalletInsight>) -> SourceKind {
        SourceKind::Test(TestSource {
            name,
            result: Ok(insights),
        })
    }

    fn make_failing_source(name: &'static str) -> SourceKind {
        SourceKind::Test(TestSource {
            name,
            result: Err(SourceError::Timeout),
        })
    }

    #[tokio::test]
    async fn build_profile_aggregates_insights() {
        let sources = vec![
            make_test_source("source_a", vec![
                WalletInsight::TonDomain(DomainInsight {
                    domain: "test.ton".into(),
                    expiry_lt: None,
                }),
            ]),
            make_test_source("source_b", vec![
                WalletInsight::AccountMeta(AccountMeta {
                    balance_ton: 10.0,
                    wallet_type: "v4r2".into(),
                    tx_count: 5,
                    is_active: true,
                    last_activity: None, linked_name: None, icon_url: None,
                    source: "tonapi".into(),
                }),
            ]),
        ];

        let builder = ProfileBuilder::from_sources(sources);
        let profile = builder.build_profile("EQA_test").await;

        assert_eq!(profile.address, "EQA_test");
        assert_eq!(profile.insights.len(), 2);
        assert!(profile.errors.is_empty());
        assert!(profile.elapsed_ms < 1000); // Should be nearly instant
    }

    #[tokio::test]
    async fn build_profile_collects_errors() {
        let sources = vec![
            make_test_source("good_source", vec![
                WalletInsight::TonDomain(DomainInsight {
                    domain: "test.ton".into(),
                    expiry_lt: None,
                }),
            ]),
            make_failing_source("bad_source"),
        ];

        let builder = ProfileBuilder::from_sources(sources);
        let profile = builder.build_profile("EQA_test").await;

        assert_eq!(profile.insights.len(), 1);
        assert_eq!(profile.errors.len(), 1);
        assert_eq!(profile.errors[0].source_name, "bad_source");
    }

    #[tokio::test]
    async fn build_profile_all_fail() {
        let sources = vec![
            make_failing_source("source_a"),
            make_failing_source("source_b"),
        ];

        let builder = ProfileBuilder::from_sources(sources);
        let profile = builder.build_profile("EQA_test").await;

        assert!(profile.insights.is_empty());
        assert_eq!(profile.errors.len(), 2);
    }

    #[tokio::test]
    async fn dedup_prefers_tonapi() {
        let sources = vec![
            make_test_source("source_tonapi", vec![
                WalletInsight::AccountMeta(AccountMeta {
                    balance_ton: 10.0,
                    wallet_type: "v4r2".into(),
                    tx_count: 42,
                    is_active: true,
                    last_activity: None, linked_name: None, icon_url: None,
                    source: "tonapi".into(),
                }),
            ]),
            make_test_source("source_toncenter", vec![
                WalletInsight::AccountMeta(AccountMeta {
                    balance_ton: 10.0,
                    wallet_type: "v4r2".into(),
                    tx_count: 0,
                    is_active: true,
                    last_activity: None, linked_name: None, icon_url: None,
                    source: "toncenter".into(),
                }),
            ]),
        ];

        let builder = ProfileBuilder::from_sources(sources);
        let profile = builder.build_profile("EQA_test").await;

        // Should only have 1 AccountMeta (tonapi)
        let account_metas: Vec<_> = profile.insights.iter()
            .filter(|i| matches!(i, WalletInsight::AccountMeta(_)))
            .collect();
        assert_eq!(account_metas.len(), 1);

        if let WalletInsight::AccountMeta(meta) = &account_metas[0] {
            assert_eq!(meta.source, "tonapi");
            assert_eq!(meta.tx_count, 42);
        }
    }

    #[tokio::test]
    async fn build_profiles_multiple_addresses() {
        let sources = vec![
            make_test_source("test", vec![
                WalletInsight::TonDomain(DomainInsight {
                    domain: "x.ton".into(),
                    expiry_lt: None,
                }),
            ]),
        ];

        let builder = ProfileBuilder::from_sources(sources);
        let addrs = vec!["EQA".to_string(), "EQB".to_string()];
        let response = builder.build_profiles(&addrs).await;

        assert_eq!(response.profiles.len(), 2);
        assert_eq!(response.profiles[0].address, "EQA");
        assert_eq!(response.profiles[1].address, "EQB");
    }

    #[test]
    fn config_driven_source_construction() {
        let config = ScraperConfig::new()
            .with_tonapi_key("key1")
            .with_bitquery_key("key2");

        let builder = ProfileBuilder::new(&config);
        // tonapi + tonapi_events + toncenter + bitquery + 3 scrapers = 7
        assert_eq!(builder.source_count(), 7);
    }

    #[test]
    fn config_filter_sources() {
        let config = ScraperConfig::new()
            .with_tonapi_key("key1")
            .with_enabled_sources(vec!["tonapi".into()]);

        let builder = ProfileBuilder::new(&config);
        assert_eq!(builder.source_count(), 1);
    }

    #[test]
    fn empty_config_default_sources() {
        let config = ScraperConfig::new();
        let builder = ProfileBuilder::new(&config);
        // tonapi + tonapi_events + toncenter + 3 scrapers = 6 (no bitquery without key)
        assert_eq!(builder.source_count(), 6);
    }
}
