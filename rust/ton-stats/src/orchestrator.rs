use std::collections::HashMap;

use futures::future::join_all;
use reqwest_wasm::Client;

use crate::error::SourceErrorReport;
use crate::models::*;
use crate::sources::SourceKind;
use crate::sources::tonapi_stats::TonApiStatsSource;
use crate::sources::tonstat_scraper::TonStatScraper;
use crate::sources::coingecko::CoinGeckoSource;
use crate::sources::coinmarketcap::CoinMarketCapSource;
use crate::sources::stonfi::StonFiSource;
use crate::sources::dedust::DeDustSource;

// ══════════════════════════════════════════════════════════════════════════════
// StatsBuilder — orchestrates parallel source fetching and aggregation
// ══════════════════════════════════════════════════════════════════════════════

pub struct StatsBuilder {
    sources: Vec<SourceKind>,
    preferred_market: String,
    pool_limit: u32,
}

impl StatsBuilder {
    pub fn from_request(req: &GetTonStatsRequest) -> Self {
        let client = Client::new();
        let mut sources: Vec<SourceKind> = Vec::new();

        let tx_limit = req.tx_limit.unwrap_or(50);
        let jetton_limit = req.jetton_limit.unwrap_or(100);
        let pool_limit = req.pool_limit.unwrap_or(20);
        let preferred_market = req.preferred_market_source.clone().unwrap_or_else(|| "coingecko".into());

        let enabled = |name: &str| -> bool {
            match &req.enabled_sources {
                None => true,
                Some(list) => list.iter().any(|s| s == name),
            }
        };

        // TonAPI — always enabled if key provided or no filter
        if enabled("tonapi") {
            sources.push(SourceKind::TonApi(TonApiStatsSource::new(
                client.clone(),
                req.tonapi_key.clone(),
                "https://tonapi.io",
                tx_limit,
                jetton_limit,
            )));
        }

        // TonStat scraper
        if enabled("tonstat") {
            sources.push(SourceKind::TonStat(TonStatScraper::new(client.clone())));
        }

        // CoinGecko
        if enabled("coingecko") {
            sources.push(SourceKind::CoinGecko(CoinGeckoSource::new(client.clone())));
        }

        // CoinMarketCap — requires API key
        if let Some(key) = &req.coinmarketcap_key {
            if enabled("coinmarketcap") {
                sources.push(SourceKind::CoinMarketCap(CoinMarketCapSource::new(
                    client.clone(),
                    key.clone(),
                )));
            }
        }

        // STON.fi
        if enabled("stonfi") {
            sources.push(SourceKind::StonFi(StonFiSource::new(client.clone(), pool_limit)));
        }

        // DeDust
        if enabled("dedust") {
            sources.push(SourceKind::DeDust(DeDustSource::new(client.clone(), pool_limit)));
        }

        Self {
            sources,
            preferred_market,
            pool_limit,
        }
    }

    #[cfg(test)]
    pub fn from_sources(sources: Vec<SourceKind>) -> Self {
        Self {
            sources,
            preferred_market: "coingecko".into(),
            pool_limit: 20,
        }
    }

    pub fn source_count(&self) -> usize {
        self.sources.len()
    }

    pub async fn build_snapshot(&self) -> GetTonStatsResponse {
        let futures: Vec<_> = self.sources
            .iter()
            .map(|source| {
                let name = source.source_name();
                async move {
                    let result = source.fetch().await;
                    (name, result)
                }
            })
            .collect();

        let results = join_all(futures).await;

        let mut sources_used: Vec<String> = Vec::new();
        let mut sources_failed: Vec<SourceErrorReport> = Vec::new();
        let mut all_contributions: Vec<SnapshotContribution> = Vec::new();

        for (name, result) in results {
            match result {
                Ok(contribs) => {
                    sources_used.push(name.to_string());
                    all_contributions.extend(contribs);
                }
                Err(err) => {
                    sources_failed.push(SourceErrorReport::new(name, &err));
                }
            }
        }

        let snapshot = self.merge_contributions(all_contributions, &sources_failed);
        let fetched_at_ms = now_ms();

        GetTonStatsResponse {
            snapshot: TonNetworkSnapshot {
                fetched_at_ms,
                ..snapshot
            },
            sources_used,
            sources_failed,
            fetched_at_ms,
        }
    }

    fn merge_contributions(
        &self,
        contributions: Vec<SnapshotContribution>,
        errors: &[SourceErrorReport],
    ) -> TonNetworkSnapshot {
        let mut network_stats: Vec<NetworkStats> = Vec::new();
        let mut market_datas: Vec<MarketData> = Vec::new();
        let mut all_blocks: Vec<BlockSummary> = Vec::new();
        let mut all_txs: Vec<TransactionSummary> = Vec::new();
        let mut all_jettons: Vec<JettonListing> = Vec::new();
        let mut dex_overviews: Vec<DexOverview> = Vec::new();

        for contrib in contributions {
            match contrib {
                SnapshotContribution::Network(n) => network_stats.push(n),
                SnapshotContribution::Market(m) => market_datas.push(m),
                SnapshotContribution::Blocks(b) => all_blocks.extend(b),
                SnapshotContribution::Transactions(t) => all_txs.extend(t),
                SnapshotContribution::Jettons(j) => all_jettons.extend(j),
                SnapshotContribution::Dex(d) => dex_overviews.push(d),
            }
        }

        // Merge NetworkStats: tonapi fields take priority, tonstat fills gaps
        let network = Self::merge_network_stats(network_stats);

        // Market: prefer the preferred_market_source
        let market = Self::select_market(&self.preferred_market, market_datas);

        // Blocks: dedup by seqno, sort descending
        all_blocks.sort_by(|a, b| b.seqno.cmp(&a.seqno));
        all_blocks.dedup_by_key(|b| b.seqno);

        // Transactions: dedup by hash, sort by lt descending
        let mut seen_hashes: HashMap<String, bool> = HashMap::new();
        all_txs.retain(|tx| seen_hashes.insert(tx.hash.clone(), true).is_none());
        all_txs.sort_by(|a, b| b.lt.cmp(&a.lt));

        // Jettons: dedup by address
        let mut seen_addrs: HashMap<String, bool> = HashMap::new();
        all_jettons.retain(|j| seen_addrs.insert(j.address.clone(), true).is_none());

        // DEX: merge all dex overviews
        let dex = Self::merge_dex(dex_overviews, self.pool_limit);

        TonNetworkSnapshot {
            fetched_at_ms: 0,
            network,
            market,
            latest_blocks: all_blocks,
            latest_transactions: all_txs,
            new_jettons: all_jettons,
            dex,
            errors: errors.to_vec(),
        }
    }

    fn merge_network_stats(stats: Vec<NetworkStats>) -> Option<NetworkStats> {
        if stats.is_empty() {
            return None;
        }

        // Start with the first (typically tonapi), then fill from others
        let mut merged = stats[0].clone();

        for other in &stats[1..] {
            if merged.total_accounts.is_none() { merged.total_accounts = other.total_accounts; }
            if merged.total_transactions_all_time.is_none() { merged.total_transactions_all_time = other.total_transactions_all_time; }
            if merged.transactions_per_day.is_none() { merged.transactions_per_day = other.transactions_per_day; }
            if merged.active_wallets_daily.is_none() { merged.active_wallets_daily = other.active_wallets_daily; }
            if merged.active_wallets_monthly.is_none() { merged.active_wallets_monthly = other.active_wallets_monthly; }
            if merged.annual_inflation_rate_pct.is_none() { merged.annual_inflation_rate_pct = other.annual_inflation_rate_pct; }
            if merged.burned_per_day_ton.is_none() { merged.burned_per_day_ton = other.burned_per_day_ton; }
            if merged.minted_per_day_ton.is_none() { merged.minted_per_day_ton = other.minted_per_day_ton; }
            if merged.total_supply_ton.is_none() { merged.total_supply_ton = other.total_supply_ton; }
        }

        Some(merged)
    }

    fn select_market(preferred: &str, mut markets: Vec<MarketData>) -> Option<MarketData> {
        if markets.is_empty() {
            return None;
        }

        // Try to find the preferred source
        if let Some(idx) = markets.iter().position(|m| m.source == preferred) {
            return Some(markets.swap_remove(idx));
        }

        // Fallback to first available
        Some(markets.swap_remove(0))
    }

    fn merge_dex(overviews: Vec<DexOverview>, pool_limit: u32) -> Option<DexOverview> {
        if overviews.is_empty() {
            return None;
        }

        let mut merged = DexOverview::default();

        for dex in overviews {
            merged.total_tvl_usd += dex.total_tvl_usd;
            merged.total_volume_24h_usd += dex.total_volume_24h_usd;
            merged.total_trades_24h += dex.total_trades_24h;
            merged.exchanges.extend(dex.exchanges);
            merged.top_pools.extend(dex.top_pools);
            merged.top_tokens.extend(dex.top_tokens);
        }

        // Sort pools by TVL desc, cap at limit
        merged.top_pools.sort_by(|a, b| b.tvl_usd.partial_cmp(&a.tvl_usd).unwrap_or(std::cmp::Ordering::Equal));
        merged.top_pools.truncate(pool_limit as usize);

        // Sort tokens by volume desc, dedup by symbol
        merged.top_tokens.sort_by(|a, b| b.volume_24h_usd.partial_cmp(&a.volume_24h_usd).unwrap_or(std::cmp::Ordering::Equal));
        let mut seen: HashMap<String, bool> = HashMap::new();
        merged.top_tokens.retain(|t| seen.insert(t.symbol.clone(), true).is_none());
        merged.top_tokens.truncate(50);

        Some(merged)
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

    #[test]
    fn merge_network_stats_fills_gaps() {
        let stats = vec![
            NetworkStats {
                latest_block_seqno: 100,
                latest_block_timestamp: 1700000000,
                tps_estimate: 5.0,
                validator_count: 300,
                total_validator_stake_ton: 500_000.0,
                ..Default::default()
            },
            NetworkStats {
                total_accounts: Some(150_000_000),
                transactions_per_day: Some(4_500_000),
                total_supply_ton: Some(5_110_000_000.0),
                ..Default::default()
            },
        ];

        let merged = StatsBuilder::merge_network_stats(stats).unwrap();
        assert_eq!(merged.latest_block_seqno, 100);
        assert_eq!(merged.total_accounts, Some(150_000_000));
        assert_eq!(merged.transactions_per_day, Some(4_500_000));
    }

    #[test]
    fn select_market_prefers_source() {
        let markets = vec![
            MarketData {
                source: "coinmarketcap".into(),
                price_usd: 3.0,
                price_btc: None, price_eth: None,
                market_cap_usd: 0.0, fully_diluted_valuation_usd: 0.0,
                volume_24h_usd: 0.0, price_change_24h_pct: 0.0,
                high_24h_usd: 0.0, low_24h_usd: 0.0,
                circulating_supply: 0.0, total_supply: 0.0,
            },
            MarketData {
                source: "coingecko".into(),
                price_usd: 3.45,
                price_btc: None, price_eth: None,
                market_cap_usd: 0.0, fully_diluted_valuation_usd: 0.0,
                volume_24h_usd: 0.0, price_change_24h_pct: 0.0,
                high_24h_usd: 0.0, low_24h_usd: 0.0,
                circulating_supply: 0.0, total_supply: 0.0,
            },
        ];

        let selected = StatsBuilder::select_market("coingecko", markets).unwrap();
        assert_eq!(selected.source, "coingecko");
        assert_eq!(selected.price_usd, 3.45);
    }

    #[test]
    fn merge_dex_combines_exchanges() {
        let overviews = vec![
            DexOverview {
                total_tvl_usd: 100_000.0,
                total_volume_24h_usd: 50_000.0,
                total_trades_24h: 1000,
                exchanges: vec![DexStats {
                    name: "STON.fi".into(),
                    tvl_usd: 100_000.0,
                    volume_24h_usd: 50_000.0,
                    pool_count: 10,
                    trade_count_24h: 1000,
                }],
                top_pools: vec![],
                top_tokens: vec![],
            },
            DexOverview {
                total_tvl_usd: 80_000.0,
                total_volume_24h_usd: 40_000.0,
                total_trades_24h: 0,
                exchanges: vec![DexStats {
                    name: "DeDust".into(),
                    tvl_usd: 80_000.0,
                    volume_24h_usd: 40_000.0,
                    pool_count: 8,
                    trade_count_24h: 0,
                }],
                top_pools: vec![],
                top_tokens: vec![],
            },
        ];

        let merged = StatsBuilder::merge_dex(overviews, 20).unwrap();
        assert_eq!(merged.exchanges.len(), 2);
        assert!((merged.total_tvl_usd - 180_000.0).abs() < 0.01);
        assert!((merged.total_volume_24h_usd - 90_000.0).abs() < 0.01);
    }

    #[test]
    fn request_defaults() {
        let req = GetTonStatsRequest::default();
        let builder = StatsBuilder::from_request(&req);
        // tonapi + tonstat + coingecko + stonfi + dedust = 5 (no CMC key)
        assert_eq!(builder.source_count(), 5);
    }
}
