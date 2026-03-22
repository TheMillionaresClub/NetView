use std::cmp::Ordering;

use serde::{Deserialize, Serialize};

// ── tonapi.io response types ───────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct AccountEventsResponse {
    pub events: Vec<AccountEvent>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AccountEvent {
    pub event_id: String,
    pub timestamp: u64,
    pub actions: Vec<Action>,
    #[serde(default)]
    pub lt: u64,
    #[serde(default)]
    pub is_scam: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Action {
    #[serde(rename = "type")]
    pub action_type: String,
    #[serde(rename = "TonTransfer")]
    pub ton_transfer: Option<TonTransferAction>,
    #[serde(rename = "JettonTransfer")]
    pub jetton_transfer: Option<JettonTransferAction>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TonTransferAction {
    pub sender: AccountAddress,
    pub recipient: AccountAddress,
    #[serde(default)]
    pub amount: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct JettonTransferAction {
    pub sender: Option<AccountAddress>,
    pub recipient: Option<AccountAddress>,
    #[serde(default)]
    pub amount: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AccountAddress {
    pub address: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub is_wallet: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AccountInfoResponse {
    pub address: String,
    #[serde(default)]
    pub balance: i64,
    #[serde(default)]
    pub last_activity: u64,
    #[serde(default)]
    pub status: String,
    #[serde(default)]
    pub get_methods: Vec<String>,
    #[serde(default)]
    pub interfaces: Vec<String>,
    /// Number of transactions — used for degree check
    #[serde(default, rename = "transactions_count")]
    pub transactions_count: u64,
}

// ── Internal types ─────────────────────────────────────────────────

#[derive(Debug, Clone, Copy)]
pub struct TimeWindow {
    pub min_ts: u64,
    pub max_ts: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct PathStep {
    pub wallet: String,
    pub tx_hash: String,
    pub amount: i64,
    pub lt: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ConnectionPath {
    pub found: bool,
    pub path: Vec<PathStep>,
    pub depth: u8,
    pub nodes_explored: usize,
    pub elapsed_ms: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct FindConnectionRequest {
    pub wallet_a: String,
    pub wallet_b: String,
    pub api_key: Option<String>,
    pub network: Option<String>,
    pub max_depth: Option<u8>,
    pub max_degree: Option<usize>,
    pub batch_size: Option<usize>,
}

#[derive(Debug, Clone)]
pub struct TraversalConfig {
    pub max_depth: u8,
    pub max_degree: usize,
    pub batch_size: usize,
}

impl Default for TraversalConfig {
    fn default() -> Self {
        Self {
            max_depth: 2,
            max_degree: 5000,
            batch_size: 20,
        }
    }
}

impl TraversalConfig {
    pub fn from_request(req: &FindConnectionRequest) -> Self {
        let defaults = Self::default();
        Self {
            max_depth: req.max_depth.unwrap_or(defaults.max_depth),
            max_degree: req.max_degree.unwrap_or(defaults.max_degree),
            batch_size: req.batch_size.unwrap_or(defaults.batch_size),
        }
    }
}

// ── Priority queue item ────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct ScoredWallet {
    pub address: String,
    pub priority: f64,
    pub depth: u8,
}

impl PartialEq for ScoredWallet {
    fn eq(&self, other: &Self) -> bool {
        self.address == other.address
    }
}

impl Eq for ScoredWallet {}

impl PartialOrd for ScoredWallet {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

/// Higher priority = dequeued first (max-heap).
impl Ord for ScoredWallet {
    fn cmp(&self, other: &Self) -> Ordering {
        self.priority
            .partial_cmp(&other.priority)
            .unwrap_or(Ordering::Equal)
    }
}

// ── Edge stored in the graph ───────────────────────────────────────

#[derive(Debug, Clone)]
pub struct TransactionEdge {
    pub lt: u64,
    pub amount: i64,
    pub tx_hash: String,
}
