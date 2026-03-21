use serde::{Deserialize, Serialize};

// ── Identity ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletState {
    pub address: String,
    /// nanoTON (parsed from string)
    pub balance: u64,
    /// "active", "uninitialized", "frozen"
    pub status: String,
    pub wallet_type: Option<String>,
    pub seqno: Option<u32>,
    pub is_wallet: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletInfo {
    pub wallet_type: Option<String>,
    pub seqno: Option<u32>,
    pub wallet_id: Option<u64>,
    pub last_transaction_lt: Option<String>,
    pub last_transaction_hash: Option<String>,
    pub account_state: String,
}

// ── Tokens ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JettonBalance {
    pub jetton_address: String,
    pub wallet_address: String,
    pub balance: String,
    pub name: Option<String>,
    pub symbol: Option<String>,
    pub decimals: Option<u8>,
    pub image: Option<String>,
}

// ── NFTs ──────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NftItem {
    pub address: String,
    pub index: serde_json::Value,
    pub collection_address: Option<String>,
    pub collection_name: Option<String>,
    pub name: Option<String>,
    pub image: Option<String>,
    pub on_sale: bool,
    pub verified: bool,
}

// ── Domain ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DnsRecord {
    pub name: String,
    pub category: String,
    pub value: String,
}

// ── Transactions ──────────────────────────────────────────────────────────────

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
    pub next_offset: Option<usize>,
}

// ── Classification ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum ActorKind {
    HumanWallet,
    BotWallet,
    SmartContract,
    Exchange,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Classification {
    pub kind: ActorKind,
    pub confidence: f32,
    pub signals: Vec<String>,
}
