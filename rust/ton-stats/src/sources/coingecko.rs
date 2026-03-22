use reqwest_wasm::Client;
use serde::Deserialize;

use crate::error::SourceError;
use crate::models::*;
use crate::sources::StatsSource;

pub struct CoinGeckoSource {
    client: Client,
}

impl CoinGeckoSource {
    pub fn new(client: Client) -> Self {
        Self { client }
    }
}

impl StatsSource for CoinGeckoSource {
    fn source_name(&self) -> &'static str {
        "coingecko"
    }

    async fn fetch(&self) -> Result<Vec<SnapshotContribution>, SourceError> {
        let url = "https://api.coingecko.com/api/v3/coins/the-open-network";
        let resp = self.client
            .get(url)
            .header("User-Agent", "TonStatsDashboard/1.0")
            .send()
            .await?;

        if resp.status().as_u16() == 429 {
            return Err(SourceError::RateLimit(60_000));
        }
        if !resp.status().is_success() {
            return Err(SourceError::Http(resp.status().as_u16(), "CoinGecko API failed".into()));
        }

        let data: CoinGeckoResponse = resp.json().await.map_err(|e| SourceError::Parse(e.to_string()))?;

        let md = &data.market_data;
        let market = MarketData {
            source: "coingecko".into(),
            price_usd: md.current_price.usd.unwrap_or(0.0),
            price_btc: md.current_price.btc,
            price_eth: md.current_price.eth,
            market_cap_usd: md.market_cap.usd.unwrap_or(0.0),
            fully_diluted_valuation_usd: md.fully_diluted_valuation.as_ref().and_then(|f| f.usd).unwrap_or(0.0),
            volume_24h_usd: md.total_volume.usd.unwrap_or(0.0),
            price_change_24h_pct: md.price_change_percentage_24h.unwrap_or(0.0),
            high_24h_usd: md.high_24h.as_ref().and_then(|h| h.usd).unwrap_or(0.0),
            low_24h_usd: md.low_24h.as_ref().and_then(|l| l.usd).unwrap_or(0.0),
            circulating_supply: md.circulating_supply.unwrap_or(0.0),
            total_supply: md.total_supply.unwrap_or(0.0),
        };

        Ok(vec![SnapshotContribution::Market(market)])
    }
}

// ── CoinGecko response shapes ────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct CoinGeckoResponse {
    market_data: CgMarketData,
}

#[derive(Debug, Deserialize)]
struct CgMarketData {
    current_price: CurrencyMap,
    market_cap: CurrencyMap,
    total_volume: CurrencyMap,
    fully_diluted_valuation: Option<CurrencyMap>,
    high_24h: Option<CurrencyMap>,
    low_24h: Option<CurrencyMap>,
    price_change_percentage_24h: Option<f64>,
    circulating_supply: Option<f64>,
    total_supply: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct CurrencyMap {
    usd: Option<f64>,
    btc: Option<f64>,
    eth: Option<f64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deserialize_coingecko_response() {
        let json = r#"{
            "market_data": {
                "current_price": {"usd": 3.45, "btc": 0.00005, "eth": null},
                "market_cap": {"usd": 8000000000},
                "total_volume": {"usd": 120000000},
                "fully_diluted_valuation": {"usd": 17000000000},
                "high_24h": {"usd": 3.55},
                "low_24h": {"usd": 3.30},
                "price_change_percentage_24h": -2.3,
                "circulating_supply": 2500000000,
                "total_supply": 5000000000
            }
        }"#;
        let resp: CoinGeckoResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.market_data.current_price.usd, Some(3.45));
    }
}
