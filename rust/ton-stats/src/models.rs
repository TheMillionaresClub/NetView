use serde::{Deserialize, Serialize};

use crate::error::SourceErrorReport;

// ══════════════════════════════════════════════════════════════════════════════
// Top-level snapshot — aggregates all global TON network data
// ══════════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TonNetworkSnapshot {
    pub fetched_at_ms: u64,
    pub network: Option<NetworkStats>,
    pub market: Option<MarketData>,
    pub latest_blocks: Vec<BlockSummary>,
    pub latest_transactions: Vec<TransactionSummary>,
    pub new_jettons: Vec<JettonListing>,
    pub dex: Option<DexOverview>,
    pub errors: Vec<SourceErrorReport>,
}

// ══════════════════════════════════════════════════════════════════════════════
// Network stats
// ══════════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NetworkStats {
    pub latest_block_seqno: u64,
    pub latest_block_timestamp: u64,
    pub tps_estimate: f64,
    pub total_accounts: Option<u64>,
    pub total_transactions_all_time: Option<u64>,
    pub transactions_per_day: Option<u64>,
    pub active_wallets_daily: Option<u64>,
    pub active_wallets_monthly: Option<u64>,
    pub validator_count: u32,
    pub total_validator_stake_ton: f64,
    pub annual_inflation_rate_pct: Option<f64>,
    pub burned_per_day_ton: Option<f64>,
    pub minted_per_day_ton: Option<f64>,
    pub total_supply_ton: Option<f64>,
}

// ══════════════════════════════════════════════════════════════════════════════
// Market data
// ══════════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketData {
    pub source: String,
    pub price_usd: f64,
    pub price_btc: Option<f64>,
    pub price_eth: Option<f64>,
    pub market_cap_usd: f64,
    pub fully_diluted_valuation_usd: f64,
    pub volume_24h_usd: f64,
    pub price_change_24h_pct: f64,
    pub high_24h_usd: f64,
    pub low_24h_usd: f64,
    pub circulating_supply: f64,
    pub total_supply: f64,
}

// ══════════════════════════════════════════════════════════════════════════════
// Block summary
// ══════════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockSummary {
    pub seqno: u64,
    pub timestamp: u64,
    pub tx_count: u32,
    pub shard_count: u32,
    pub workchain: i32,
}

// ══════════════════════════════════════════════════════════════════════════════
// Transaction summary
// ══════════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionSummary {
    pub hash: String,
    pub lt: u64,
    pub from: String,
    pub to: String,
    pub amount_ton: Option<f64>,
    pub op_type: String,
    pub timestamp: u64,
    pub fee_ton: f64,
}

// ══════════════════════════════════════════════════════════════════════════════
// Jetton listing
// ══════════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JettonListing {
    pub address: String,
    pub name: String,
    pub symbol: String,
    pub total_supply: String,
    pub decimals: u8,
    pub description: Option<String>,
    pub image_url: Option<String>,
    pub mintable: bool,
    pub coingecko_id: Option<String>,
    pub price_usd: Option<f64>,
    pub volume_24h_usd: Option<f64>,
    pub market_cap_usd: Option<f64>,
}

// ══════════════════════════════════════════════════════════════════════════════
// DEX overview
// ══════════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DexOverview {
    pub total_tvl_usd: f64,
    pub total_volume_24h_usd: f64,
    pub total_trades_24h: u64,
    pub exchanges: Vec<DexStats>,
    pub top_pools: Vec<PoolSummary>,
    pub top_tokens: Vec<DexTokenStats>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DexStats {
    pub name: String,
    pub tvl_usd: f64,
    pub volume_24h_usd: f64,
    pub pool_count: u32,
    pub trade_count_24h: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolSummary {
    pub address: String,
    pub dex: String,
    pub token0_symbol: String,
    pub token1_symbol: String,
    pub tvl_usd: f64,
    pub volume_24h_usd: f64,
    pub apy: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DexTokenStats {
    pub symbol: String,
    pub address: String,
    pub price_usd: f64,
    pub price_change_24h_pct: f64,
    pub volume_24h_usd: f64,
    pub market_cap_usd: Option<f64>,
}

// ══════════════════════════════════════════════════════════════════════════════
// Snapshot contribution — each source returns one of these
// ══════════════════════════════════════════════════════════════════════════════

pub enum SnapshotContribution {
    Network(NetworkStats),
    Market(MarketData),
    Blocks(Vec<BlockSummary>),
    Transactions(Vec<TransactionSummary>),
    Jettons(Vec<JettonListing>),
    Dex(DexOverview),
}

// ══════════════════════════════════════════════════════════════════════════════
// Request / Response for the WASM binding
// ══════════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GetTonStatsRequest {
    pub tonapi_key: Option<String>,
    pub coinmarketcap_key: Option<String>,
    pub bitquery_key: Option<String>,
    pub enabled_sources: Option<Vec<String>>,
    pub preferred_market_source: Option<String>,
    pub tx_limit: Option<u32>,
    pub jetton_limit: Option<u32>,
    pub pool_limit: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetTonStatsResponse {
    pub snapshot: TonNetworkSnapshot,
    pub sources_used: Vec<String>,
    pub sources_failed: Vec<SourceErrorReport>,
    pub fetched_at_ms: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn snapshot_default_is_empty() {
        let snap = TonNetworkSnapshot::default();
        assert!(snap.network.is_none());
        assert!(snap.market.is_none());
        assert!(snap.latest_blocks.is_empty());
    }

    #[test]
    fn market_data_round_trip() {
        let market = MarketData {
            source: "coingecko".into(),
            price_usd: 3.45,
            price_btc: Some(0.00005),
            price_eth: None,
            market_cap_usd: 8_000_000_000.0,
            fully_diluted_valuation_usd: 17_000_000_000.0,
            volume_24h_usd: 120_000_000.0,
            price_change_24h_pct: -2.3,
            high_24h_usd: 3.55,
            low_24h_usd: 3.30,
            circulating_supply: 2_500_000_000.0,
            total_supply: 5_000_000_000.0,
        };
        let json = serde_json::to_string(&market).unwrap();
        let back: MarketData = serde_json::from_str(&json).unwrap();
        assert_eq!(back.price_usd, 3.45);
    }

    #[test]
    fn request_deserializes_with_defaults() {
        let json = r#"{"tonapi_key": "abc123"}"#;
        let req: GetTonStatsRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.tonapi_key.as_deref(), Some("abc123"));
        assert!(req.tx_limit.is_none());
    }
}
