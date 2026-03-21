use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum ActorKind {
    HumanWallet,
    /// Wallet with bot-like transaction patterns
    BotWallet,
    /// Non-wallet contract
    SmartContract,
    /// Known exchange-like pattern
    Exchange,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Classification {
    pub kind: ActorKind,
    /// Confidence score from 0.0 to 1.0
    pub confidence: f32,
    /// Human-readable reasoning signals
    pub signals: Vec<String>,
}
