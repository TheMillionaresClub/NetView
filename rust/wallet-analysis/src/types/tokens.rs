use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JettonBalance {
    pub jetton_address: String,
    pub wallet_address: String,
    /// Raw balance string; use `decimals` to convert to human-readable.
    pub balance: String,
    pub name: Option<String>,
    pub symbol: Option<String>,
    pub decimals: Option<u8>,
    pub image: Option<String>,
}
