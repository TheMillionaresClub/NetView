use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TxSummary {
    pub hash: String,
    pub lt: String,
    pub utime: u64,
    pub total_fees: String,
    pub in_msg_value: Option<String>,
    pub out_msg_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionPage {
    pub transactions: Vec<TxSummary>,
    /// Offset for the next page
    pub next_offset: Option<usize>,
}
