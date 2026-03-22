use reqwest_wasm::Client;
use serde::Deserialize;

use crate::error::SourceError;
use crate::models::*;
use crate::sources::StatsSource;

pub struct TonApiStatsSource {
    client: Client,
    api_key: Option<String>,
    base_url: String,
    tx_limit: u32,
    jetton_limit: u32,
}

impl TonApiStatsSource {
    pub fn new(
        client: Client,
        api_key: Option<String>,
        base_url: &str,
        tx_limit: u32,
        jetton_limit: u32,
    ) -> Self {
        Self {
            client,
            api_key,
            base_url: base_url.to_string(),
            tx_limit,
            jetton_limit,
        }
    }

    fn build_get(&self, url: &str) -> reqwest_wasm::RequestBuilder {
        let mut req = self.client.get(url);
        if let Some(key) = &self.api_key {
            req = req.header("Authorization", format!("Bearer {}", key));
        }
        req
    }

    async fn fetch_masterchain_head(&self) -> Result<MasterchainBlock, SourceError> {
        let url = format!("{}/v2/blockchain/masterchain-head", self.base_url);
        let resp = self.build_get(&url).send().await?;
        if !resp.status().is_success() {
            return Err(SourceError::Http(resp.status().as_u16(), "masterchain-head failed".into()));
        }
        resp.json().await.map_err(|e| SourceError::Parse(e.to_string()))
    }

    async fn fetch_validators(&self) -> Result<ValidatorsResponse, SourceError> {
        let url = format!("{}/v2/blockchain/validators", self.base_url);
        let resp = self.build_get(&url).send().await?;
        if !resp.status().is_success() {
            return Err(SourceError::Http(resp.status().as_u16(), "validators failed".into()));
        }
        resp.json().await.map_err(|e| SourceError::Parse(e.to_string()))
    }

    async fn fetch_transactions(&self, seqno: u64) -> Result<Vec<TransactionSummary>, SourceError> {
        let url = format!(
            "{}/v2/blockchain/masterchain/{}/transactions?limit={}",
            self.base_url, seqno, self.tx_limit
        );
        let resp = self.build_get(&url).send().await?;
        if !resp.status().is_success() {
            return Err(SourceError::Http(resp.status().as_u16(), "transactions failed".into()));
        }
        let data: TransactionsResponse = resp.json().await.map_err(|e| SourceError::Parse(e.to_string()))?;
        let txs = data.transactions.into_iter().map(|tx| {
            let amount_nano = tx.in_msg.as_ref().and_then(|m| m.value).unwrap_or(0);
            let fee_nano = tx.total_fees.unwrap_or(0);
            TransactionSummary {
                hash: tx.hash,
                lt: tx.lt,
                from: tx.in_msg.as_ref()
                    .and_then(|m| m.source.as_ref())
                    .and_then(|s| s.address.clone().or_else(|| Some(String::new())))
                    .unwrap_or_default(),
                to: tx.account.address.clone(),
                amount_ton: if amount_nano > 0 { Some(amount_nano as f64 / 1_000_000_000.0) } else { None },
                op_type: tx.transaction_type.clone().unwrap_or_else(|| "unknown".into()),
                timestamp: tx.utime,
                fee_ton: fee_nano as f64 / 1_000_000_000.0,
            }
        }).collect();
        Ok(txs)
    }

    async fn fetch_jettons(&self) -> Result<Vec<JettonListing>, SourceError> {
        let url = format!(
            "{}/v2/jettons?limit={}&offset=0",
            self.base_url, self.jetton_limit
        );
        let resp = self.build_get(&url).send().await?;
        if !resp.status().is_success() {
            return Err(SourceError::Http(resp.status().as_u16(), "jettons failed".into()));
        }
        let data: JettonsResponse = resp.json().await.map_err(|e| SourceError::Parse(e.to_string()))?;
        let jettons = data.jettons.into_iter().map(|j| {
            let addr = j.metadata.as_ref()
                .and_then(|m| m.address.clone())
                .unwrap_or_default();
            JettonListing {
                address: addr,
                name: j.metadata.as_ref().and_then(|m| m.name.clone()).unwrap_or_default(),
                symbol: j.metadata.as_ref().and_then(|m| m.symbol.clone()).unwrap_or_default(),
                total_supply: j.total_supply.unwrap_or_default(),
                decimals: j.metadata.as_ref()
                    .and_then(|m| m.decimals.as_deref())
                    .and_then(|d| d.parse().ok())
                    .unwrap_or(9),
                description: j.metadata.as_ref().and_then(|m| m.description.clone()),
                image_url: j.metadata.as_ref().and_then(|m| m.image.clone())
                    .or_else(|| j.preview.clone()),
                mintable: j.mintable.unwrap_or(false),
                coingecko_id: None,
                price_usd: None,
                volume_24h_usd: None,
                market_cap_usd: None,
            }
        }).collect();
        Ok(jettons)
    }
}

impl StatsSource for TonApiStatsSource {
    fn source_name(&self) -> &'static str {
        "tonapi"
    }

    async fn fetch(&self) -> Result<Vec<SnapshotContribution>, SourceError> {
        // Fetch masterchain head first (we need seqno for transactions)
        let head = self.fetch_masterchain_head().await?;
        let seqno = head.seqno;
        let block_timestamp = head.gen_utime;

        // Fetch remaining data concurrently
        let (validators, txs, jettons) = futures::join!(
            self.fetch_validators(),
            self.fetch_transactions(seqno),
            self.fetch_jettons(),
        );

        let mut contributions = Vec::new();

        // Build NetworkStats from head + validators
        let validator_data = validators.unwrap_or_default();

        // Estimate TPS from tx_quantity in the last block
        let tps = head.tx_quantity.unwrap_or(0) as f64 / 5.0; // ~5s block time

        let network = NetworkStats {
            latest_block_seqno: seqno,
            latest_block_timestamp: block_timestamp,
            tps_estimate: tps,
            validator_count: validator_data.validators.len() as u32,
            total_validator_stake_ton: validator_data.total_stake as f64 / 1_000_000_000.0,
            ..Default::default()
        };
        contributions.push(SnapshotContribution::Network(network));

        // Build a single block summary from the masterchain head
        contributions.push(SnapshotContribution::Blocks(vec![BlockSummary {
            seqno,
            timestamp: block_timestamp,
            tx_count: head.tx_quantity.unwrap_or(0),
            shard_count: 0,
            workchain: head.workchain_id,
        }]));

        if let Ok(txs) = txs {
            contributions.push(SnapshotContribution::Transactions(txs));
        }

        if let Ok(jettons) = jettons {
            contributions.push(SnapshotContribution::Jettons(jettons));
        }

        Ok(contributions)
    }
}

// ── TonAPI response types ────────────────────────────────────────────────────

// masterchain-head returns flat block data
#[derive(Debug, Deserialize)]
struct MasterchainBlock {
    seqno: u64,
    #[serde(default)]
    gen_utime: u64,
    #[serde(default)]
    tx_quantity: Option<u32>,
    #[serde(default)]
    workchain_id: i32,
}

#[derive(Debug, Deserialize, Default)]
struct ValidatorsResponse {
    #[serde(default)]
    total_stake: i64,
    #[serde(default)]
    validators: Vec<ValidatorEntry>,
}

#[derive(Debug, Deserialize)]
struct ValidatorEntry {
    #[serde(default)]
    stake: i64,
}

#[derive(Debug, Deserialize)]
struct TransactionsResponse {
    #[serde(default)]
    transactions: Vec<TxEntry>,
}

#[derive(Debug, Deserialize)]
struct TxEntry {
    hash: String,
    lt: u64,
    utime: u64,
    account: TxAccount,
    total_fees: Option<i64>,
    in_msg: Option<TxMessage>,
    transaction_type: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TxAccount {
    address: String,
}

#[derive(Debug, Deserialize)]
struct TxMessage {
    source: Option<TxMessageSource>,
    value: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct TxMessageSource {
    address: Option<String>,
}

#[derive(Debug, Deserialize)]
struct JettonsResponse {
    #[serde(default)]
    jettons: Vec<JettonEntry>,
}

#[derive(Debug, Deserialize)]
struct JettonEntry {
    total_supply: Option<String>,
    mintable: Option<bool>,
    metadata: Option<JettonMetadata>,
    preview: Option<String>,
}

#[derive(Debug, Deserialize)]
struct JettonMetadata {
    address: Option<String>,
    name: Option<String>,
    symbol: Option<String>,
    decimals: Option<String>,
    description: Option<String>,
    image: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deserialize_masterchain_head() {
        let json = r#"{"seqno":58575453,"gen_utime":1774164610,"tx_quantity":3,"workchain_id":-1}"#;
        let block: MasterchainBlock = serde_json::from_str(json).unwrap();
        assert_eq!(block.seqno, 58575453);
        assert_eq!(block.gen_utime, 1774164610);
    }

    #[test]
    fn deserialize_validators() {
        let json = r#"{"total_stake":465040170529839542,"validators":[{"stake":2039267198470000,"address":"-1:abc"}]}"#;
        let resp: ValidatorsResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.validators.len(), 1);
        assert_eq!(resp.total_stake, 465040170529839542);
    }
}
