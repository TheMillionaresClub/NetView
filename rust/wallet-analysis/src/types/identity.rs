use serde::{Deserialize, Serialize};

/// From GET v3/walletStates?address=...
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletState {
    pub address: String,
    /// nanoTON (parsed from string)
    pub balance: u64,
    /// "active", "uninitialized", "frozen"
    pub status: String,
    /// "wallet v4 r2", "wallet v5 r1", etc.
    pub wallet_type: Option<String>,
    pub seqno: Option<u32>,
    pub is_wallet: bool,
}

/// From GET v2/getWalletInformation?address=...
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletInfo {
    pub wallet_type: Option<String>,
    pub seqno: Option<u32>,
    pub wallet_id: Option<u64>,
    pub last_transaction_lt: Option<String>,
    pub last_transaction_hash: Option<String>,
    pub account_state: String,
}
