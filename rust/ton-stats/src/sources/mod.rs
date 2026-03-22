pub mod tonapi_stats;
pub mod tonstat_scraper;
pub mod coingecko;
pub mod coinmarketcap;
pub mod stonfi;
pub mod dedust;

use crate::error::SourceError;
use crate::models::SnapshotContribution;

// ── Trait: defines the interface every stats source must implement ────────────

#[allow(async_fn_in_trait)]
pub trait StatsSource {
    fn source_name(&self) -> &'static str;
    async fn fetch(&self) -> Result<Vec<SnapshotContribution>, SourceError>;
}

// ── Enum dispatch: avoids dyn Trait + async ──────────────────────────────────

pub enum SourceKind {
    TonApi(tonapi_stats::TonApiStatsSource),
    TonStat(tonstat_scraper::TonStatScraper),
    CoinGecko(coingecko::CoinGeckoSource),
    CoinMarketCap(coinmarketcap::CoinMarketCapSource),
    StonFi(stonfi::StonFiSource),
    DeDust(dedust::DeDustSource),
    #[cfg(test)]
    Test(TestSource),
}

impl SourceKind {
    pub fn source_name(&self) -> &'static str {
        match self {
            Self::TonApi(s) => s.source_name(),
            Self::TonStat(s) => s.source_name(),
            Self::CoinGecko(s) => s.source_name(),
            Self::CoinMarketCap(s) => s.source_name(),
            Self::StonFi(s) => s.source_name(),
            Self::DeDust(s) => s.source_name(),
            #[cfg(test)]
            Self::Test(s) => s.source_name(),
        }
    }

    pub async fn fetch(&self) -> Result<Vec<SnapshotContribution>, SourceError> {
        match self {
            Self::TonApi(s) => s.fetch().await,
            Self::TonStat(s) => s.fetch().await,
            Self::CoinGecko(s) => s.fetch().await,
            Self::CoinMarketCap(s) => s.fetch().await,
            Self::StonFi(s) => s.fetch().await,
            Self::DeDust(s) => s.fetch().await,
            #[cfg(test)]
            Self::Test(s) => s.fetch().await,
        }
    }
}

// ── Test-only source ─────────────────────────────────────────────────────────

#[cfg(test)]
pub struct TestSource {
    pub name: &'static str,
    pub result: Result<Vec<SnapshotContribution>, SourceError>,
}

#[cfg(test)]
impl StatsSource for TestSource {
    fn source_name(&self) -> &'static str {
        self.name
    }

    async fn fetch(&self) -> Result<Vec<SnapshotContribution>, SourceError> {
        match &self.result {
            Ok(_) => Ok(vec![]), // TestSource returns empty contributions
            Err(e) => Err(SourceError::Parse(e.to_string())),
        }
    }
}
