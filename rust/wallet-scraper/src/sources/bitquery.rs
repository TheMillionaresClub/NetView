use reqwest_wasm::Client;
use serde::Deserialize;
use serde_json::json;

use crate::error::SourceError;
use crate::models::*;
use super::WalletSource;

// ══════════════════════════════════════════════════════════════════════════════
// BitQuerySource — GraphQL DeFi + trading analytics
//
// POST https://streaming.bitquery.io/graphql
// Queries: jetton transfer history, NFT trade history
// ══════════════════════════════════════════════════════════════════════════════

const GRAPHQL_URL: &str = "https://streaming.bitquery.io/graphql";

pub struct BitQuerySource {
    client: Client,
    api_key: String,
}

impl BitQuerySource {
    pub fn new(client: Client, api_key: String) -> Self {
        Self { client, api_key }
    }

    fn build_jetton_query(address: &str) -> serde_json::Value {
        json!({
            "query": r#"
                query ($address: String!) {
                    EVM(network: ton) {
                        TokenTransfers: Transfers(
                            where: {
                                any: [
                                    {Transfer: {Sender: {is: $address}}},
                                    {Transfer: {Receiver: {is: $address}}}
                                ]
                            }
                            limit: {count: 100}
                            orderBy: {descending: Block_Time}
                        ) {
                            Transfer {
                                Currency {
                                    Symbol
                                    Name
                                    SmartContract
                                }
                                Amount
                                AmountInUSD
                                Sender
                                Receiver
                            }
                            Block {
                                Time
                            }
                        }
                    }
                }
            "#,
            "variables": {
                "address": address
            }
        })
    }

    pub fn parse_jetton_transfers(json: &str) -> Result<Vec<WalletInsight>, SourceError> {
        let raw: RawBitQueryResponse = serde_json::from_str(json)?;

        let transfers = raw.data
            .and_then(|d| d.evm)
            .and_then(|e| e.token_transfers)
            .unwrap_or_default();

        if transfers.is_empty() {
            return Ok(vec![]);
        }

        // Aggregate balances by symbol from transfer history
        let mut token_map: std::collections::HashMap<String, AggregatedToken> =
            std::collections::HashMap::new();

        for transfer in &transfers {
            let t = &transfer.transfer;
            let symbol = t.currency.as_ref()
                .and_then(|c| c.symbol.clone())
                .unwrap_or_else(|| "???".into());
            let name = t.currency.as_ref().and_then(|c| c.name.clone());
            let amount = t.amount.unwrap_or(0.0);
            let usd = t.amount_in_usd;
            let address = t.currency.as_ref()
                .and_then(|c| c.smart_contract.clone());

            let entry = token_map.entry(symbol.clone()).or_insert(AggregatedToken {
                symbol: symbol.clone(),
                name: name.clone(),
                total_volume: 0.0,
                total_usd: 0.0,
                jetton_address: address,
            });
            entry.total_volume += amount.abs();
            if let Some(u) = usd {
                entry.total_usd += u.abs();
            }
        }

        let balances: Vec<JettonBalance> = token_map
            .into_values()
            .map(|t| JettonBalance {
                symbol: t.symbol,
                name: t.name,
                balance: format!("{:.6}", t.total_volume),
                usd_value: if t.total_usd > 0.0 { Some(t.total_usd) } else { None },
                jetton_address: t.jetton_address,
            })
            .collect();

        if balances.is_empty() {
            return Ok(vec![]);
        }

        Ok(vec![WalletInsight::JettonPortfolio(JettonPortfolioData { balances })])
    }
}

struct AggregatedToken {
    symbol: String,
    name: Option<String>,
    total_volume: f64,
    total_usd: f64,
    jetton_address: Option<String>,
}

impl WalletSource for BitQuerySource {
    fn source_name(&self) -> &'static str {
        "bitquery"
    }

    async fn fetch(&self, address: &str) -> Result<Vec<WalletInsight>, SourceError> {
        let body = Self::build_jetton_query(address);

        let resp = self.client
            .post(GRAPHQL_URL)
            .header("Content-Type", "application/json")
            .header("X-API-KEY", &self.api_key)
            .json(&body)
            .send()
            .await?;

        let status = resp.status();
        if status == reqwest_wasm::StatusCode::TOO_MANY_REQUESTS {
            return Err(SourceError::RateLimit(2000));
        }
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(SourceError::Http(status.as_u16(), body));
        }

        let json = resp.text().await.map_err(|e| SourceError::Http(0, e.to_string()))?;
        Self::parse_jetton_transfers(&json)
    }
}

// ── Raw GraphQL response types ───────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct RawBitQueryResponse {
    data: Option<RawData>,
}

#[derive(Debug, Deserialize)]
struct RawData {
    #[serde(rename = "EVM")]
    evm: Option<RawEvm>,
}

#[derive(Debug, Deserialize)]
struct RawEvm {
    #[serde(rename = "TokenTransfers")]
    token_transfers: Option<Vec<RawTransferEntry>>,
}

#[derive(Debug, Deserialize)]
struct RawTransferEntry {
    #[serde(rename = "Transfer")]
    transfer: RawTransfer,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct RawTransfer {
    #[serde(rename = "Currency")]
    currency: Option<RawCurrency>,
    #[serde(rename = "Amount")]
    amount: Option<f64>,
    #[serde(rename = "AmountInUSD")]
    amount_in_usd: Option<f64>,
    #[serde(rename = "Sender")]
    sender: Option<String>,
    #[serde(rename = "Receiver")]
    receiver: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RawCurrency {
    #[serde(rename = "Symbol")]
    symbol: Option<String>,
    #[serde(rename = "Name")]
    name: Option<String>,
    #[serde(rename = "SmartContract")]
    smart_contract: Option<String>,
}

// ══════════════════════════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_empty_response() {
        let json = r#"{"data": null}"#;
        let result = BitQuerySource::parse_jetton_transfers(json).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn parse_transfers_with_data() {
        let json = r#"{
            "data": {
                "EVM": {
                    "TokenTransfers": [
                        {
                            "Transfer": {
                                "Currency": {
                                    "Symbol": "USDT",
                                    "Name": "Tether USD",
                                    "SmartContract": "EQ_usdt"
                                },
                                "Amount": 100.5,
                                "AmountInUSD": 100.5,
                                "Sender": "EQA_sender",
                                "Receiver": "EQB_receiver"
                            },
                            "Block": {"Time": "2024-01-01T00:00:00Z"}
                        },
                        {
                            "Transfer": {
                                "Currency": {
                                    "Symbol": "USDT",
                                    "Name": "Tether USD",
                                    "SmartContract": "EQ_usdt"
                                },
                                "Amount": 50.0,
                                "AmountInUSD": 50.0,
                                "Sender": "EQB_receiver",
                                "Receiver": "EQA_sender"
                            },
                            "Block": {"Time": "2024-01-02T00:00:00Z"}
                        },
                        {
                            "Transfer": {
                                "Currency": {
                                    "Symbol": "SCALE",
                                    "Name": "Scaleton",
                                    "SmartContract": "EQ_scale"
                                },
                                "Amount": 1000.0,
                                "AmountInUSD": null,
                                "Sender": "EQA_sender",
                                "Receiver": "EQC_other"
                            },
                            "Block": {"Time": "2024-01-03T00:00:00Z"}
                        }
                    ]
                }
            }
        }"#;

        let insights = BitQuerySource::parse_jetton_transfers(json).unwrap();
        assert_eq!(insights.len(), 1);

        if let WalletInsight::JettonPortfolio(data) = &insights[0] {
            assert_eq!(data.balances.len(), 2);
            let usdt = data.balances.iter().find(|b| b.symbol == "USDT").unwrap();
            assert!((usdt.usd_value.unwrap() - 150.5).abs() < 0.01);
            let scale = data.balances.iter().find(|b| b.symbol == "SCALE").unwrap();
            assert!(scale.usd_value.is_none());
        } else {
            panic!("expected JettonPortfolio");
        }
    }

    #[test]
    fn parse_no_transfers() {
        let json = r#"{"data": {"EVM": {"TokenTransfers": []}}}"#;
        let result = BitQuerySource::parse_jetton_transfers(json).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn build_query_includes_address() {
        let query = BitQuerySource::build_jetton_query("EQAbc123");
        let vars = query.get("variables").unwrap();
        assert_eq!(vars.get("address").unwrap().as_str().unwrap(), "EQAbc123");
    }
}
