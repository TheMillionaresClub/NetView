use futures::join;
use reqwest_wasm::Client;
use serde::Deserialize;

use crate::error::SourceError;
use crate::models::*;
use super::WalletSource;

// ══════════════════════════════════════════════════════════════════════════════
// TonApiSource — primary structured API (tonapi.io)
//
// Makes 4 parallel calls per address:
//   1. GET /v2/accounts/{id}           → AccountMeta
//   2. GET /v2/accounts/{id}/nfts      → NftProfile
//   3. GET /v2/accounts/{id}/jettons   → JettonPortfolio
//   4. GET /v2/accounts/{id}/dns/backresolve → DomainInsight
// ══════════════════════════════════════════════════════════════════════════════

pub struct TonApiSource {
    client: Client,
    base_url: String,
    api_key: Option<String>,
}

impl TonApiSource {
    pub fn new(client: Client, api_key: Option<String>, base_url: &str) -> Self {
        Self { client, api_key, base_url: base_url.to_string() }
    }

    async fn get_json(&self, url: &str) -> Result<String, SourceError> {
        let mut delay_ms = 1000u64;

        for attempt in 0..=2u32 {
            let mut req = self.client.get(url);
            if let Some(key) = &self.api_key {
                req = req.header("Authorization", format!("Bearer {}", key));
            }

            let resp = req.send().await?;
            let status = resp.status();

            if status == reqwest_wasm::StatusCode::TOO_MANY_REQUESTS {
                if attempt < 2 {
                    #[cfg(not(target_arch = "wasm32"))]
                    std::thread::sleep(std::time::Duration::from_millis(delay_ms));
                    delay_ms *= 2;
                    continue;
                }
                return Err(SourceError::RateLimit(delay_ms));
            }
            if status == reqwest_wasm::StatusCode::NOT_FOUND {
                return Err(SourceError::NotFound);
            }
            if !status.is_success() {
                let body = resp.text().await.unwrap_or_default();
                return Err(SourceError::Http(status.as_u16(), body));
            }

            return Ok(resp.text().await.map_err(|e| SourceError::Http(0, e.to_string()))?);
        }

        Err(SourceError::RateLimit(delay_ms))
    }

    // ── Individual fetch + parse methods (public for testing) ────────────────

    async fn fetch_account(&self, address: &str) -> Result<Option<WalletInsight>, SourceError> {
        let url = format!("{}/v2/accounts/{}", self.base_url, address);
        match self.get_json(&url).await {
            Ok(json) => Ok(Self::parse_account_response(&json)?),
            Err(SourceError::NotFound) => Ok(None),
            Err(e) => Err(e),
        }
    }

    async fn fetch_nfts(&self, address: &str) -> Result<Vec<WalletInsight>, SourceError> {
        let url = format!("{}/v2/accounts/{}/nfts?limit=50", self.base_url, address);
        match self.get_json(&url).await {
            Ok(json) => Self::parse_nfts_response(&json),
            Err(SourceError::NotFound) => Ok(vec![]),
            Err(e) => Err(e),
        }
    }

    async fn fetch_jettons(&self, address: &str) -> Result<Option<WalletInsight>, SourceError> {
        let url = format!("{}/v2/accounts/{}/jettons", self.base_url, address);
        match self.get_json(&url).await {
            Ok(json) => Ok(Self::parse_jettons_response(&json)?),
            Err(SourceError::NotFound) => Ok(None),
            Err(e) => Err(e),
        }
    }

    async fn fetch_dns(&self, address: &str) -> Result<Vec<WalletInsight>, SourceError> {
        let url = format!("{}/v2/accounts/{}/dns/backresolve", self.base_url, address);
        match self.get_json(&url).await {
            Ok(json) => Self::parse_dns_response(&json),
            Err(SourceError::NotFound) => Ok(vec![]),
            Err(e) => Err(e),
        }
    }

    // ── Parse methods — pure functions, no HTTP, fully testable ──────────────

    pub fn parse_account_response(json: &str) -> Result<Option<WalletInsight>, SourceError> {
        let raw: RawAccount = serde_json::from_str(json)?;

        let balance_nano = raw.balance.unwrap_or(0);
        let balance_ton = balance_nano as f64 / 1_000_000_000.0;
        let wallet_type = raw.interfaces
            .as_ref()
            .and_then(|ifaces| ifaces.first().cloned())
            .unwrap_or_else(|| "unknown".to_string());
        let is_active = raw.status.as_deref() == Some("active");

        Ok(Some(WalletInsight::AccountMeta(AccountMeta {
            balance_ton,
            wallet_type,
            tx_count: 0,
            is_active,
            last_activity: raw.last_activity,
            linked_name: raw.name.clone(),
            icon_url: raw.icon.clone(),
            source: "tonapi".into(),
        })))
    }

    /// Known Fragment collection addresses on mainnet
    pub fn parse_nfts_response(json: &str) -> Result<Vec<WalletInsight>, SourceError> {
        let raw: RawNftsResponse = serde_json::from_str(json)?;
        let items = raw.nft_items.unwrap_or_default();
        if items.is_empty() {
            return Ok(vec![]);
        }

        let mut collections = Vec::new();
        let mut owned_usernames = Vec::new();
        let mut owned_phone_numbers = Vec::new();
        let mut dns_records = Vec::new();
        let mut linked_telegram: Option<String> = None;
        let mut avatar_url: Option<String> = None;

        for item in &items {
            // Collect unique collection names for NftProfile
            let col_name = item.collection.as_ref().and_then(|c| c.name.as_deref());

            if let Some(name) = col_name {
                if !name.is_empty() && !collections.contains(&name.to_string()) {
                    collections.push(name.to_string());
                }
            }

            // Detect Fragment NFTs by collection name (more reliable than address)
            let is_username_nft = col_name.is_some_and(|n|
                n.contains("Telegram Usernames") || n.contains("telegram_usernames")
            );
            let is_phone_nft = col_name.is_some_and(|n|
                n.contains("Anonymous Telegram Numbers") || n.contains("anonymous_telegram_numbers")
            );

            if is_username_nft {
                if let Some(meta) = &item.metadata {
                    if let Some(name) = &meta.name {
                        owned_usernames.push(name.trim_start_matches('@').to_string());
                    }
                }
                if let Some(dns) = &item.dns {
                    dns_records.push(dns.clone());
                }
            }

            if is_phone_nft {
                if let Some(meta) = &item.metadata {
                    if let Some(name) = &meta.name {
                        owned_phone_numbers.push(name.clone());
                    }
                }
            }

            // The owner field on any NFT may reveal the wallet owner's Telegram identity
            if let Some(owner) = &item.owner {
                if linked_telegram.is_none() {
                    if let Some(name) = &owner.name {
                        if name.ends_with(".t.me") {
                            linked_telegram = Some(name.clone());
                        }
                    }
                }
                if avatar_url.is_none() {
                    if let Some(icon) = &owner.icon {
                        avatar_url = Some(icon.clone());
                    }
                }
            }
        }

        let mut insights = Vec::new();

        // Always add NftProfile
        insights.push(WalletInsight::NftProfile(NftProfileData {
            getgems_username: None,
            nft_count: items.len(),
            collections,
        }));

        // Add TelegramIdentity if we found any identity signals
        let has_identity = !owned_usernames.is_empty()
            || !owned_phone_numbers.is_empty()
            || !dns_records.is_empty()
            || linked_telegram.is_some()
            || avatar_url.is_some();

        if has_identity {
            insights.push(WalletInsight::TelegramIdentity(TelegramIdentityData {
                owned_usernames,
                owned_phone_numbers,
                dns_records,
                linked_telegram,
                avatar_url,
            }));
        }

        Ok(insights)
    }

    pub fn parse_jettons_response(json: &str) -> Result<Option<WalletInsight>, SourceError> {
        let raw: RawJettonsResponse = serde_json::from_str(json)?;
        let balances_raw = raw.balances.unwrap_or_default();
        if balances_raw.is_empty() {
            return Ok(None);
        }

        let balances: Vec<JettonBalance> = balances_raw
            .into_iter()
            .map(|b| {
                let symbol = b.jetton.as_ref()
                    .and_then(|j| j.symbol.clone())
                    .unwrap_or_else(|| "???".into());
                let name = b.jetton.as_ref().and_then(|j| j.name.clone());
                let jetton_address = b.jetton.as_ref().map(|j| j.address.clone());
                JettonBalance {
                    symbol,
                    name,
                    balance: b.balance,
                    usd_value: None,
                    jetton_address,
                }
            })
            .collect();

        Ok(Some(WalletInsight::JettonPortfolio(JettonPortfolioData { balances })))
    }

    pub fn parse_dns_response(json: &str) -> Result<Vec<WalletInsight>, SourceError> {
        let raw: RawDnsBackresolve = serde_json::from_str(json)?;
        let domains = raw.domains.unwrap_or_default();

        Ok(domains
            .into_iter()
            .map(|domain| {
                WalletInsight::TonDomain(DomainInsight {
                    domain,
                    expiry_lt: None,
                })
            })
            .collect())
    }
}

impl WalletSource for TonApiSource {
    fn source_name(&self) -> &'static str {
        "tonapi"
    }

    async fn fetch(&self, address: &str) -> Result<Vec<WalletInsight>, SourceError> {
        let (account_res, nfts_res, jettons_res, dns_res) = join!(
            self.fetch_account(address),
            self.fetch_nfts(address),
            self.fetch_jettons(address),
            self.fetch_dns(address),
        );

        let mut insights = Vec::new();
        let mut first_error: Option<SourceError> = None;

        match account_res {
            Ok(Some(insight)) => insights.push(insight),
            Ok(None) => {}
            Err(e) => { first_error.get_or_insert(e); }
        }
        match nfts_res {
            Ok(nft_insights) => insights.extend(nft_insights),
            Err(e) => { first_error.get_or_insert(e); }
        }
        match jettons_res {
            Ok(Some(insight)) => insights.push(insight),
            Ok(None) => {}
            Err(e) => { first_error.get_or_insert(e); }
        }
        match dns_res {
            Ok(dns_insights) => insights.extend(dns_insights),
            Err(e) => { first_error.get_or_insert(e); }
        }

        // If we got no insights at all and there was an error, propagate it
        if insights.is_empty() {
            if let Some(err) = first_error {
                return Err(err);
            }
        }

        Ok(insights)
    }
}

// ── Raw API response types (private, for deserialization only) ───────────────

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct RawAccount {
    balance: Option<i64>,
    status: Option<String>,
    interfaces: Option<Vec<String>>,
    name: Option<String>,
    icon: Option<String>,
    get_methods: Option<Vec<String>>,
    last_activity: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct RawNftsResponse {
    nft_items: Option<Vec<RawNftItem>>,
}

#[derive(Debug, Deserialize)]
struct RawNftItem {
    collection: Option<RawNftCollection>,
    metadata: Option<RawNftMetadata>,
    dns: Option<String>,
    owner: Option<RawNftOwner>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct RawNftCollection {
    address: Option<String>,
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RawNftMetadata {
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RawNftOwner {
    name: Option<String>,
    icon: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RawJettonsResponse {
    balances: Option<Vec<RawJettonBalance>>,
}

#[derive(Debug, Deserialize)]
struct RawJettonBalance {
    balance: String,
    jetton: Option<RawJettonMeta>,
}

#[derive(Debug, Deserialize)]
struct RawJettonMeta {
    address: String,
    name: Option<String>,
    symbol: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RawDnsBackresolve {
    domains: Option<Vec<String>>,
}

// ══════════════════════════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_account_basic() {
        let json = r#"{
            "balance": 5000000000,
            "status": "active",
            "interfaces": ["wallet_v4r2"],
            "name": null,
            "get_methods": []
        }"#;
        let result = TonApiSource::parse_account_response(json).unwrap();
        let Some(WalletInsight::AccountMeta(meta)) = result else {
            panic!("expected AccountMeta");
        };
        assert!((meta.balance_ton - 5.0).abs() < 0.001);
        assert_eq!(meta.wallet_type, "wallet_v4r2");
        assert!(meta.is_active);
        assert_eq!(meta.source, "tonapi");
    }

    #[test]
    fn parse_account_inactive() {
        let json = r#"{"balance": 0, "status": "uninit"}"#;
        let result = TonApiSource::parse_account_response(json).unwrap().unwrap();
        if let WalletInsight::AccountMeta(meta) = result {
            assert!(!meta.is_active);
        }
    }

    #[test]
    fn parse_nfts_empty() {
        let json = r#"{"nft_items": []}"#;
        let result = TonApiSource::parse_nfts_response(json).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn parse_nfts_with_items() {
        let json = r#"{
            "nft_items": [
                {"collection": {"name": "TON Diamonds"}},
                {"collection": {"name": "TON Diamonds"}},
                {"collection": {"name": "Whales Club"}}
            ]
        }"#;
        let results = TonApiSource::parse_nfts_response(json).unwrap();
        let nft_profile = results.iter().find(|i| matches!(i, WalletInsight::NftProfile(_))).unwrap();
        if let WalletInsight::NftProfile(data) = nft_profile {
            assert_eq!(data.nft_count, 3);
            assert_eq!(data.collections.len(), 2);
            assert!(data.collections.contains(&"TON Diamonds".to_string()));
            assert!(data.collections.contains(&"Whales Club".to_string()));
        } else {
            panic!("expected NftProfile");
        }
    }

    #[test]
    fn parse_nfts_with_fragment_username() {
        let json = r#"{
            "nft_items": [
                {
                    "collection": {
                        "address": "0:80d78a35f955a14b7efa086f5af0d6b4d3af069a73e9430ca1f74907a4507e5f",
                        "name": "Telegram Usernames"
                    },
                    "metadata": {"name": "@alice_cool"},
                    "dns": "alice_cool.t.me",
                    "owner": {
                        "name": "alice_wallet.t.me",
                        "icon": "https://cache.tonapi.io/avatar.webp"
                    }
                },
                {
                    "collection": {"name": "TON Diamonds"},
                    "owner": {"name": "alice_wallet.t.me"}
                }
            ]
        }"#;
        let results = TonApiSource::parse_nfts_response(json).unwrap();
        assert_eq!(results.len(), 2); // NftProfile + TelegramIdentity

        let identity = results.iter()
            .find(|i| matches!(i, WalletInsight::TelegramIdentity(_)))
            .expect("should have TelegramIdentity");

        if let WalletInsight::TelegramIdentity(data) = identity {
            assert_eq!(data.owned_usernames, vec!["alice_cool"]);
            assert_eq!(data.dns_records, vec!["alice_cool.t.me"]);
            assert_eq!(data.linked_telegram.as_deref(), Some("alice_wallet.t.me"));
            assert_eq!(data.avatar_url.as_deref(), Some("https://cache.tonapi.io/avatar.webp"));
        }
    }

    #[test]
    fn parse_nfts_with_fragment_phone() {
        let json = r#"{
            "nft_items": [{
                "collection": {
                    "address": "0:0e41dc1dc3c9066fd2524858008e12b33598063dde0303eabcf808456afafd72",
                    "name": "Anonymous Telegram Numbers"
                },
                "metadata": {"name": "+888 1234 5678"}
            }]
        }"#;
        let results = TonApiSource::parse_nfts_response(json).unwrap();
        let identity = results.iter()
            .find(|i| matches!(i, WalletInsight::TelegramIdentity(_)))
            .expect("should have TelegramIdentity");

        if let WalletInsight::TelegramIdentity(data) = identity {
            assert_eq!(data.owned_phone_numbers, vec!["+888 1234 5678"]);
            assert!(data.owned_usernames.is_empty());
        }
    }

    #[test]
    fn parse_jettons_with_balances() {
        let json = r#"{
            "balances": [
                {
                    "balance": "1000000000",
                    "jetton": {
                        "address": "EQ_jetton1",
                        "name": "Tether USD",
                        "symbol": "USDT"
                    }
                },
                {
                    "balance": "500",
                    "jetton": {
                        "address": "EQ_jetton2",
                        "name": null,
                        "symbol": "SCALE"
                    }
                }
            ]
        }"#;
        let result = TonApiSource::parse_jettons_response(json).unwrap().unwrap();
        if let WalletInsight::JettonPortfolio(data) = result {
            assert_eq!(data.balances.len(), 2);
            assert_eq!(data.balances[0].symbol, "USDT");
            assert_eq!(data.balances[0].name.as_deref(), Some("Tether USD"));
            assert_eq!(data.balances[1].symbol, "SCALE");
        } else {
            panic!("expected JettonPortfolio");
        }
    }

    #[test]
    fn parse_jettons_empty() {
        let json = r#"{"balances": []}"#;
        assert!(TonApiSource::parse_jettons_response(json).unwrap().is_none());
    }

    #[test]
    fn parse_dns_with_domains() {
        let json = r#"{"domains": ["alice.ton", "bob.ton"]}"#;
        let insights = TonApiSource::parse_dns_response(json).unwrap();
        assert_eq!(insights.len(), 2);
        if let WalletInsight::TonDomain(d) = &insights[0] {
            assert_eq!(d.domain, "alice.ton");
        }
    }

    #[test]
    fn parse_dns_empty() {
        let json = r#"{"domains": []}"#;
        let insights = TonApiSource::parse_dns_response(json).unwrap();
        assert!(insights.is_empty());
    }

    #[test]
    fn parse_dns_missing_field() {
        let json = r#"{}"#;
        let insights = TonApiSource::parse_dns_response(json).unwrap();
        assert!(insights.is_empty());
    }
}
