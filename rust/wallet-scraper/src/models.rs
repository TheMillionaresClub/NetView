use serde::{Deserialize, Serialize};

use crate::error::SourceErrorReport;

// ══════════════════════════════════════════════════════════════════════════════
// Top-level profile — aggregates all insights for a single wallet address
// ══════════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletProfile {
    pub address: String,
    pub insights: Vec<WalletInsight>,
    pub errors: Vec<SourceErrorReport>,
    pub elapsed_ms: u64,
}

// ══════════════════════════════════════════════════════════════════════════════
// Insight enum — each variant wraps a specific data type from a source
// ══════════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WalletInsight {
    TonDomain(DomainInsight),
    TelegramUsername(TelegramInsight),
    NftProfile(NftProfileData),
    JettonPortfolio(JettonPortfolioData),
    WalletLabel(LabelInsight),
    RiskScore(RiskInsight),
    AccountMeta(AccountMeta),
    FragmentListing(FragmentInsight),
    /// Telegram identity extracted from Fragment username/phone NFTs
    TelegramIdentity(TelegramIdentityData),
    /// Counterparty identities discovered through transaction events
    CounterpartyIdentities(CounterpartyIdentitiesData),
}

// ══════════════════════════════════════════════════════════════════════════════
// Individual insight structs
// ══════════════════════════════════════════════════════════════════════════════

// ── .ton DNS domain linked to wallet ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomainInsight {
    pub domain: String,
    pub expiry_lt: Option<u64>,
}

// ── Telegram username NFT owned ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelegramInsight {
    pub username: String,
    pub purchase_date: Option<u64>,
    pub fragment_url: String,
}

// ── NFTs owned + marketplace profile ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NftProfileData {
    pub getgems_username: Option<String>,
    pub nft_count: usize,
    pub collections: Vec<String>,
}

// ── Jetton (fungible token) holdings ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JettonPortfolioData {
    pub balances: Vec<JettonBalance>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JettonBalance {
    pub symbol: String,
    pub name: Option<String>,
    pub balance: String,
    pub usd_value: Option<f64>,
    pub jetton_address: Option<String>,
}

// ── Explorer label (e.g. "Binance Hot Wallet") ───────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LabelInsight {
    pub source: String,
    pub label: String,
    pub category: Option<String>,
}

// ── AML / compliance risk score ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskInsight {
    pub source: String,
    pub score: f64,
    pub flags: Vec<String>,
}

// ── Basic account metadata ───────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountMeta {
    pub balance_ton: f64,
    pub wallet_type: String,
    pub tx_count: u64,
    pub is_active: bool,
    pub last_activity: Option<u64>,
    /// Telegram username linked to this wallet (e.g. "alice.t.me")
    pub linked_name: Option<String>,
    /// Telegram profile picture URL (via tonkeeper/tonapi resolution)
    pub icon_url: Option<String>,
    pub source: String,
}

// ── Fragment.com marketplace listing ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FragmentInsight {
    pub username: String,
    pub price_ton: Option<f64>,
    pub owner_wallet: String,
}

// ── Telegram identity from on-chain data ─────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelegramIdentityData {
    /// Telegram usernames owned as NFTs (from Fragment)
    pub owned_usernames: Vec<String>,
    /// Anonymous phone numbers owned as NFTs (from Fragment)
    pub owned_phone_numbers: Vec<String>,
    /// DNS records associated with owned NFTs (e.g. "alice.t.me")
    pub dns_records: Vec<String>,
    /// Telegram username linked to the wallet itself (from tonapi name resolution)
    pub linked_telegram: Option<String>,
    /// Profile picture URL (from tonapi)
    pub avatar_url: Option<String>,
}

// ── Counterparty identities from transaction events ──────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CounterpartyIdentity {
    pub address: String,
    pub name: String,
    pub icon_url: Option<String>,
    pub is_wallet: bool,
    /// "sender" or "recipient" relative to the queried wallet
    pub role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CounterpartyIdentitiesData {
    pub identities: Vec<CounterpartyIdentity>,
    pub events_scanned: usize,
}

// ══════════════════════════════════════════════════════════════════════════════
// Response wrapper for multi-address queries
// ══════════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetWalletProfileResponse {
    pub profiles: Vec<WalletProfile>,
    pub total_elapsed_ms: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wallet_insight_serializes_with_tag() {
        let insight = WalletInsight::TonDomain(DomainInsight {
            domain: "alice.ton".into(),
            expiry_lt: Some(12345678),
        });
        let json = serde_json::to_string(&insight).unwrap();
        assert!(json.contains(r#""type":"TonDomain"#));
        assert!(json.contains("alice.ton"));
    }

    #[test]
    fn wallet_profile_round_trip() {
        let profile = WalletProfile {
            address: "EQA123".into(),
            insights: vec![
                WalletInsight::AccountMeta(AccountMeta {
                    balance_ton: 100.5,
                    wallet_type: "wallet_v4r2".into(),
                    tx_count: 42,
                    is_active: true,
                    last_activity: None,
                    linked_name: None,
                    icon_url: None,
                    source: "tonapi".into(),
                }),
                WalletInsight::JettonPortfolio(JettonPortfolioData {
                    balances: vec![JettonBalance {
                        symbol: "USDT".into(),
                        name: Some("Tether USD".into()),
                        balance: "1000000000".into(),
                        usd_value: Some(1000.0),
                        jetton_address: None,
                    }],
                }),
            ],
            errors: vec![],
            elapsed_ms: 150,
        };

        let json = serde_json::to_string(&profile).unwrap();
        let deserialized: WalletProfile = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.address, "EQA123");
        assert_eq!(deserialized.insights.len(), 2);
    }

    #[test]
    fn all_insight_variants_serialize() {
        let insights = vec![
            WalletInsight::TonDomain(DomainInsight { domain: "test.ton".into(), expiry_lt: None }),
            WalletInsight::TelegramUsername(TelegramInsight {
                username: "@alice".into(),
                purchase_date: Some(1700000000),
                fragment_url: "https://fragment.com/username/alice".into(),
            }),
            WalletInsight::NftProfile(NftProfileData {
                getgems_username: Some("alice_nft".into()),
                nft_count: 5,
                collections: vec!["TON Diamonds".into()],
            }),
            WalletInsight::WalletLabel(LabelInsight {
                source: "tonscan".into(),
                label: "Binance Hot Wallet".into(),
                category: Some("Exchange".into()),
            }),
            WalletInsight::RiskScore(RiskInsight {
                source: "scorechain".into(),
                score: 0.15,
                flags: vec!["mixer_interaction".into()],
            }),
            WalletInsight::FragmentListing(FragmentInsight {
                username: "alice".into(),
                price_ton: Some(50.0),
                owner_wallet: "EQA...".into(),
            }),
        ];

        for insight in &insights {
            let json = serde_json::to_string(insight).unwrap();
            let _: WalletInsight = serde_json::from_str(&json).unwrap();
        }
    }
}
