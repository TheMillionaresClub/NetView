pub mod tonapi;
pub mod tonapi_events;
pub mod toncenter;
pub mod bitquery;
pub mod tonscan_scraper;
pub mod getgems_scraper;
pub mod fragment_scraper;

use crate::error::SourceError;
use crate::models::WalletInsight;

// ── Trait: defines the interface every data source must implement ─────────────

#[allow(async_fn_in_trait)]
pub trait WalletSource {
    fn source_name(&self) -> &'static str;
    async fn fetch(&self, address: &str) -> Result<Vec<WalletInsight>, SourceError>;
}

// ── Enum dispatch: avoids dyn Trait + async (not supported in Rust 2024) ─────

pub enum SourceKind {
    TonApi(tonapi::TonApiSource),
    TonApiEvents(tonapi_events::TonApiEventsSource),
    TonCenter(toncenter::TonCenterSource),
    BitQuery(bitquery::BitQuerySource),
    Tonscan(tonscan_scraper::TonscanScraper),
    GetGems(getgems_scraper::GetGemsScraper),
    Fragment(fragment_scraper::FragmentScraper),
    #[cfg(test)]
    Test(TestSource),
}

impl SourceKind {
    pub fn source_name(&self) -> &'static str {
        match self {
            Self::TonApi(s) => s.source_name(),
            Self::TonApiEvents(s) => s.source_name(),
            Self::TonCenter(s) => s.source_name(),
            Self::BitQuery(s) => s.source_name(),
            Self::Tonscan(s) => s.source_name(),
            Self::GetGems(s) => s.source_name(),
            Self::Fragment(s) => s.source_name(),
            #[cfg(test)]
            Self::Test(s) => s.source_name(),
        }
    }

    pub async fn fetch(&self, address: &str) -> Result<Vec<WalletInsight>, SourceError> {
        match self {
            Self::TonApi(s) => s.fetch(address).await,
            Self::TonApiEvents(s) => s.fetch(address).await,
            Self::TonCenter(s) => s.fetch(address).await,
            Self::BitQuery(s) => s.fetch(address).await,
            Self::Tonscan(s) => s.fetch(address).await,
            Self::GetGems(s) => s.fetch(address).await,
            Self::Fragment(s) => s.fetch(address).await,
            #[cfg(test)]
            Self::Test(s) => s.fetch(address).await,
        }
    }
}

// ── Test-only source for unit testing the orchestrator ───────────────────────

#[cfg(test)]
pub struct TestSource {
    pub name: &'static str,
    pub result: Result<Vec<WalletInsight>, SourceError>,
}

#[cfg(test)]
impl WalletSource for TestSource {
    fn source_name(&self) -> &'static str {
        self.name
    }

    async fn fetch(&self, _address: &str) -> Result<Vec<WalletInsight>, SourceError> {
        match &self.result {
            Ok(insights) => Ok(insights.clone()),
            Err(e) => Err(SourceError::Parse(e.to_string())),
        }
    }
}
