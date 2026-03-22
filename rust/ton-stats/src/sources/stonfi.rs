use reqwest_wasm::Client;
use serde::Deserialize;

use crate::error::SourceError;
use crate::models::*;
use crate::sources::StatsSource;

pub struct StonFiSource {
    client: Client,
    pool_limit: u32,
}

impl StonFiSource {
    pub fn new(client: Client, pool_limit: u32) -> Self {
        Self { client, pool_limit }
    }
}

impl StatsSource for StonFiSource {
    fn source_name(&self) -> &'static str {
        "stonfi"
    }

    async fn fetch(&self) -> Result<Vec<SnapshotContribution>, SourceError> {
        let (stats_res, pools_res, assets_res) = futures::join!(
            self.fetch_dex_stats(),
            self.fetch_pools(),
            self.fetch_assets(),
        );

        let stats = stats_res.unwrap_or_default();
        let pools = pools_res.unwrap_or_default();
        let tokens = assets_res.unwrap_or_default();

        let dex = DexOverview {
            total_tvl_usd: stats.tvl_usd,
            total_volume_24h_usd: stats.volume_usd,
            total_trades_24h: stats.total_trades,
            exchanges: vec![DexStats {
                name: "STON.fi".into(),
                tvl_usd: stats.tvl_usd,
                volume_24h_usd: stats.volume_usd,
                pool_count: pools.len() as u32,
                trade_count_24h: stats.total_trades,
            }],
            top_pools: pools,
            top_tokens: tokens,
        };

        Ok(vec![SnapshotContribution::Dex(dex)])
    }
}

impl StonFiSource {
    async fn fetch_dex_stats(&self) -> Result<ParsedDexStats, SourceError> {
        let resp = self.client
            .get("https://api.ston.fi/v1/stats/dex")
            .header("User-Agent", "TonStatsDashboard/1.0")
            .send()
            .await?;

        if !resp.status().is_success() {
            return Err(SourceError::Http(resp.status().as_u16(), "STON.fi stats failed".into()));
        }

        let data: StonFiStatsResponse = resp.json().await.map_err(|e| SourceError::Parse(e.to_string()))?;
        let s = &data.stats;
        Ok(ParsedDexStats {
            tvl_usd: s.tvl.as_deref().and_then(parse_big_float).unwrap_or(0.0),
            volume_usd: s.volume_usd.as_deref().and_then(parse_big_float).unwrap_or(0.0),
            total_trades: s.trades.unwrap_or(0),
        })
    }

    async fn fetch_pools(&self) -> Result<Vec<PoolSummary>, SourceError> {
        // STON.fi doesn't support limit in the URL for v1/pools, but pool_list is returned
        let resp = self.client
            .get("https://api.ston.fi/v1/pools")
            .header("User-Agent", "TonStatsDashboard/1.0")
            .send()
            .await?;

        if !resp.status().is_success() {
            return Err(SourceError::Http(resp.status().as_u16(), "STON.fi pools failed".into()));
        }

        let data: StonFiPoolsResponse = resp.json().await.map_err(|e| SourceError::Parse(e.to_string()))?;

        let mut pools: Vec<PoolSummary> = data.pool_list.into_iter().filter_map(|p| {
            let tvl = parse_big_float(p.lp_total_supply_usd.as_deref()?)?;
            if tvl <= 0.0 { return None; }
            Some(PoolSummary {
                address: p.address,
                dex: "STON.fi".into(),
                token0_symbol: p.token0_symbol.unwrap_or_else(|| "???".into()),
                token1_symbol: p.token1_symbol.unwrap_or_else(|| "???".into()),
                tvl_usd: tvl,
                volume_24h_usd: p.volume_24h_usd.as_deref().and_then(parse_big_float).unwrap_or(0.0),
                apy: p.apy_1d,
            })
        }).collect();

        pools.sort_by(|a, b| b.tvl_usd.partial_cmp(&a.tvl_usd).unwrap_or(std::cmp::Ordering::Equal));
        pools.truncate(self.pool_limit as usize);
        Ok(pools)
    }

    async fn fetch_assets(&self) -> Result<Vec<DexTokenStats>, SourceError> {
        let resp = self.client
            .get("https://api.ston.fi/v1/assets")
            .header("User-Agent", "TonStatsDashboard/1.0")
            .send()
            .await?;

        if !resp.status().is_success() {
            return Err(SourceError::Http(resp.status().as_u16(), "STON.fi assets failed".into()));
        }

        let data: StonFiAssetsResponse = resp.json().await.map_err(|e| SourceError::Parse(e.to_string()))?;
        let mut tokens: Vec<DexTokenStats> = data.asset_list.into_iter().filter_map(|a| {
            let price = a.dex_price_usd.as_deref()
                .or(a.third_party_price_usd.as_deref())
                .and_then(parse_big_float)
                .unwrap_or(0.0);
            Some(DexTokenStats {
                symbol: a.symbol?,
                address: a.contract_address,
                price_usd: price,
                price_change_24h_pct: 0.0,
                volume_24h_usd: 0.0, // STON.fi assets don't expose per-asset volume
                market_cap_usd: None,
            })
        }).collect();

        // Sort by price descending as a proxy for relevance (no volume available)
        tokens.sort_by(|a, b| b.price_usd.partial_cmp(&a.price_usd).unwrap_or(std::cmp::Ordering::Equal));
        tokens.truncate(50);
        Ok(tokens)
    }
}

fn parse_big_float(s: &str) -> Option<f64> {
    // STON.fi returns extremely long decimal strings — parse only first ~20 significant digits
    let trimmed = s.trim();
    if trimmed.is_empty() { return None; }

    // Find decimal point position
    if let Some(dot_pos) = trimmed.find('.') {
        // Take integer part + up to 6 decimal places
        let end = (dot_pos + 7).min(trimmed.len());
        trimmed[..end].parse::<f64>().ok()
    } else {
        // No decimal, just parse the integer
        trimmed.parse::<f64>().ok()
    }
}

// ── Response shapes ─────────────────────────────────────────────

#[derive(Debug, Default)]
struct ParsedDexStats {
    tvl_usd: f64,
    volume_usd: f64,
    total_trades: u64,
}

#[derive(Debug, Deserialize)]
struct StonFiStatsResponse {
    stats: StonFiStatsInner,
}

#[derive(Debug, Deserialize)]
struct StonFiStatsInner {
    tvl: Option<String>,
    volume_usd: Option<String>,
    unique_wallets: Option<u64>,
    trades: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct StonFiPoolsResponse {
    #[serde(default)]
    pool_list: Vec<StonFiPool>,
}

#[derive(Debug, Deserialize)]
struct StonFiPool {
    address: String,
    token0_symbol: Option<String>,
    token1_symbol: Option<String>,
    lp_total_supply_usd: Option<String>,
    volume_24h_usd: Option<String>,
    apy_1d: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct StonFiAssetsResponse {
    #[serde(default)]
    asset_list: Vec<StonFiAsset>,
}

#[derive(Debug, Deserialize)]
struct StonFiAsset {
    contract_address: String,
    symbol: Option<String>,
    dex_price_usd: Option<String>,
    third_party_price_usd: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_big_float_works() {
        assert_eq!(parse_big_float("24550953.43134882884"), Some(24550953.431348));
        assert_eq!(parse_big_float("3043249476.040506875"), Some(3043249476.040506));
        assert_eq!(parse_big_float("0"), Some(0.0));
        assert!(parse_big_float("").is_none());
    }

    #[test]
    fn deserialize_stats_response() {
        let json = r#"{
            "since": "2022-11-18",
            "until": "2026-03-22",
            "stats": {
                "tvl": "24550953.43",
                "volume_usd": "3043249476.04",
                "unique_wallets": 5676016,
                "trades": 32600972
            }
        }"#;
        let resp: StonFiStatsResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.stats.trades, Some(32600972));
    }
}
