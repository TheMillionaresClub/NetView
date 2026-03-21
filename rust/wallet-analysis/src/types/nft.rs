use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NftItem {
    pub address: String,
    pub index: serde_json::Value,
    pub collection_address: Option<String>,
    pub collection_name: Option<String>,
    /// From metadata
    pub name: Option<String>,
    pub image: Option<String>,
    pub on_sale: bool,
    pub verified: bool,
}
