use reqwest_wasm::Client;
use serde::Deserialize;

use crate::error::SourceError;
use crate::models::*;
use crate::sources::StatsSource;

pub struct DeDustSource {
    client: Client,
    pool_limit: u32,
}

impl DeDustSource {
    pub fn new(client: Client, pool_limit: u32) -> Self {
        Self { client, pool_limit }
    }
}

impl StatsSource for DeDustSource {
    fn source_name(&self) -> &'static str {
        "dedust"
    }

    async fn fetch(&self) -> Result<Vec<SnapshotContribution>, SourceError> {
        let pools = self.fetch_pools().await?;

        // Calculate aggregate stats from pools
        let tvl: f64 = pools.iter().map(|p| p.tvl_usd).sum();
        let volume: f64 = pools.iter().map(|p| p.volume_24h_usd).sum();

        // Extract token stats from pool data
        let mut token_map: std::collections::HashMap<String, DexTokenStats> = std::collections::HashMap::new();
        for pool in &pools {
            for sym in [&pool.token0_symbol, &pool.token1_symbol] {
                if sym != "???" {
                    token_map.entry(sym.clone()).or_insert_with(|| DexTokenStats {
                        symbol: sym.clone(),
                        address: String::new(),
                        price_usd: 0.0,
                        price_change_24h_pct: 0.0,
                        volume_24h_usd: 0.0,
                        market_cap_usd: None,
                    }).volume_24h_usd += pool.volume_24h_usd / 2.0; // split volume between pair tokens
                }
            }
        }
        let mut tokens: Vec<DexTokenStats> = token_map.into_values().collect();
        tokens.sort_by(|a, b| b.volume_24h_usd.partial_cmp(&a.volume_24h_usd).unwrap_or(std::cmp::Ordering::Equal));
        tokens.truncate(50);

        let dex = DexOverview {
            total_tvl_usd: tvl,
            total_volume_24h_usd: volume,
            total_trades_24h: 0,
            exchanges: vec![DexStats {
                name: "DeDust".into(),
                tvl_usd: tvl,
                volume_24h_usd: volume,
                pool_count: pools.len() as u32,
                trade_count_24h: 0,
            }],
            top_pools: pools,
            top_tokens: tokens,
        };

        Ok(vec![SnapshotContribution::Dex(dex)])
    }
}

impl DeDustSource {
    async fn fetch_pools(&self) -> Result<Vec<PoolSummary>, SourceError> {
        let resp = self.client
            .get("https://api.dedust.io/v2/pools")
            .header("User-Agent", "TonStatsDashboard/1.0")
            .send()
            .await?;

        if !resp.status().is_success() {
            return Err(SourceError::Http(resp.status().as_u16(), "DeDust pools failed".into()));
        }

        let data: Vec<DeDustPool> = resp.json().await.map_err(|e| SourceError::Parse(e.to_string()))?;

        let mut pools: Vec<PoolSummary> = data.into_iter().filter_map(|p| {
            let assets = p.assets.as_ref()?;
            if assets.len() < 2 { return None; }

            let a0_type = assets[0].asset_type.as_deref().unwrap_or("");
            let a1_type = assets[1].asset_type.as_deref().unwrap_or("");

            let t0 = assets[0].metadata.as_ref()
                .and_then(|m| m.symbol.clone())
                .unwrap_or_else(|| "???".into());
            let t1 = assets[1].metadata.as_ref()
                .and_then(|m| m.symbol.clone())
                .unwrap_or_else(|| "???".into());

            // Skip pools where both symbols are unknown
            if t0 == "???" && t1 == "???" { return None; }

            let reserves = p.reserves.as_ref()?;
            if reserves.len() < 2 { return None; }

            // Only estimate TVL if one side is native TON (we know its decimals = 9)
            let ton_reserve_nano = if a0_type == "native" {
                reserves[0].parse::<f64>().ok()
            } else if a1_type == "native" {
                reserves[1].parse::<f64>().ok()
            } else {
                None
            };

            let tvl_ton = ton_reserve_nano
                .map(|n| n / 1_000_000_000.0 * 2.0) // 2x for both sides
                .unwrap_or(0.0);

            // Volume from stats (native TON side)
            let vol_idx = if a0_type == "native" { 0 } else if a1_type == "native" { 1 } else { 0 };
            let volume_ton = p.stats.as_ref()
                .and_then(|s| s.volume.as_ref())
                .and_then(|v| v.get(vol_idx))
                .and_then(|s| s.parse::<f64>().ok())
                .map(|v| v / 1_000_000_000.0)
                .unwrap_or(0.0);

            // Skip empty pools
            if tvl_ton <= 0.001 && volume_ton <= 0.001 { return None; }

            Some(PoolSummary {
                address: p.address.unwrap_or_default(),
                dex: "DeDust".into(),
                token0_symbol: t0,
                token1_symbol: t1,
                tvl_usd: tvl_ton, // In TON, not USD (will be labeled as such)
                volume_24h_usd: volume_ton,
                apy: None,
            })
        }).collect();

        pools.sort_by(|a, b| b.tvl_usd.partial_cmp(&a.tvl_usd).unwrap_or(std::cmp::Ordering::Equal));
        pools.truncate(self.pool_limit as usize);
        Ok(pools)
    }
}

// ── DeDust response shapes ──────────────────────────────────────

#[derive(Debug, Deserialize)]
struct DeDustPool {
    address: Option<String>,
    assets: Option<Vec<DeDustAssetRef>>,
    reserves: Option<Vec<String>>,
    stats: Option<DeDustPoolStats>,
}

#[derive(Debug, Deserialize)]
struct DeDustAssetRef {
    #[serde(rename = "type")]
    asset_type: Option<String>,
    metadata: Option<DeDustAssetMeta>,
}

#[derive(Debug, Deserialize)]
struct DeDustAssetMeta {
    symbol: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DeDustPoolStats {
    volume: Option<Vec<String>>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deserialize_dedust_pool() {
        let json = r#"{
            "address": "EQTest",
            "assets": [
                {"metadata": {"symbol": "TON"}},
                {"metadata": {"symbol": "WALL"}}
            ],
            "reserves": ["56045095", "82155766840929579571808"],
            "stats": {"volume": ["1000000000", "2000000000"]}
        }"#;
        let pool: DeDustPool = serde_json::from_str(json).unwrap();
        assert_eq!(pool.assets.as_ref().unwrap().len(), 2);
        assert_eq!(pool.reserves.as_ref().unwrap().len(), 2);
    }
}
