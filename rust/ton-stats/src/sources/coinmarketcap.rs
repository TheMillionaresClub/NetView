use reqwest_wasm::Client;
use serde::Deserialize;

use crate::error::SourceError;
use crate::models::*;
use crate::sources::StatsSource;

pub struct CoinMarketCapSource {
    client: Client,
    api_key: String,
}

impl CoinMarketCapSource {
    pub fn new(client: Client, api_key: String) -> Self {
        Self { client, api_key }
    }
}

impl StatsSource for CoinMarketCapSource {
    fn source_name(&self) -> &'static str {
        "coinmarketcap"
    }

    async fn fetch(&self) -> Result<Vec<SnapshotContribution>, SourceError> {
        let url = "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=TON";
        let resp = self.client
            .get(url)
            .header("X-CMC_PRO_API_KEY", &self.api_key)
            .header("Accept", "application/json")
            .send()
            .await?;

        if resp.status().as_u16() == 429 {
            return Err(SourceError::RateLimit(60_000));
        }
        if !resp.status().is_success() {
            return Err(SourceError::Http(resp.status().as_u16(), "CoinMarketCap API failed".into()));
        }

        let data: CmcResponse = resp.json().await.map_err(|e| SourceError::Parse(e.to_string()))?;

        let ton = data.data.get("TON")
            .or_else(|| data.data.values().next())
            .ok_or_else(|| SourceError::NotFound)?;

        let quote = ton.quote.get("USD")
            .ok_or_else(|| SourceError::Parse("No USD quote".into()))?;

        let market = MarketData {
            source: "coinmarketcap".into(),
            price_usd: quote.price.unwrap_or(0.0),
            price_btc: None,
            price_eth: None,
            market_cap_usd: quote.market_cap.unwrap_or(0.0),
            fully_diluted_valuation_usd: quote.fully_diluted_market_cap.unwrap_or(0.0),
            volume_24h_usd: quote.volume_24h.unwrap_or(0.0),
            price_change_24h_pct: quote.percent_change_24h.unwrap_or(0.0),
            high_24h_usd: 0.0, // CMC doesn't provide high/low in basic quotes
            low_24h_usd: 0.0,
            circulating_supply: ton.circulating_supply.unwrap_or(0.0),
            total_supply: ton.total_supply.unwrap_or(0.0),
        };

        Ok(vec![SnapshotContribution::Market(market)])
    }
}

// ── CoinMarketCap response shapes ───────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct CmcResponse {
    data: std::collections::HashMap<String, CmcCoin>,
}

#[derive(Debug, Deserialize)]
struct CmcCoin {
    circulating_supply: Option<f64>,
    total_supply: Option<f64>,
    quote: std::collections::HashMap<String, CmcQuote>,
}

#[derive(Debug, Deserialize)]
struct CmcQuote {
    price: Option<f64>,
    volume_24h: Option<f64>,
    percent_change_24h: Option<f64>,
    market_cap: Option<f64>,
    fully_diluted_market_cap: Option<f64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deserialize_cmc_response() {
        let json = r#"{
            "data": {
                "TON": {
                    "circulating_supply": 2500000000,
                    "total_supply": 5000000000,
                    "quote": {
                        "USD": {
                            "price": 3.45,
                            "volume_24h": 120000000,
                            "percent_change_24h": -2.3,
                            "market_cap": 8000000000,
                            "fully_diluted_market_cap": 17000000000
                        }
                    }
                }
            }
        }"#;
        let resp: CmcResponse = serde_json::from_str(json).unwrap();
        assert!(resp.data.contains_key("TON"));
    }
}
