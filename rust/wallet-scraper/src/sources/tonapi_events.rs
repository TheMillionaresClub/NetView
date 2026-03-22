use reqwest_wasm::Client;
use serde::Deserialize;
use std::collections::HashMap;

use crate::error::SourceError;
use crate::models::*;
use super::WalletSource;

// ══════════════════════════════════════════════════════════════════════════════
// TonApiEventsSource — discovers counterparty Telegram identities by scanning
// transaction events. tonapi includes `name` and `icon` on sender/recipient
// objects when the counterparty has a linked Telegram identity.
// ══════════════════════════════════════════════════════════════════════════════

pub struct TonApiEventsSource {
    client: Client,
    base_url: String,
    api_key: Option<String>,
}

impl TonApiEventsSource {
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

    pub fn parse_events_response(json: &str) -> Result<Vec<WalletInsight>, SourceError> {
        let raw: RawEventsResponse = serde_json::from_str(json)?;
        let events = raw.events.unwrap_or_default();
        if events.is_empty() {
            return Ok(vec![]);
        }

        // Collect unique counterparties that have a name
        let mut seen: HashMap<String, CounterpartyIdentity> = HashMap::new();

        for event in &events {
            for action in &event.actions {
                // Check TonTransfer
                if let Some(tt) = &action.ton_transfer {
                    Self::collect_identity(&mut seen, &tt.sender, "sender");
                    Self::collect_identity(&mut seen, &tt.recipient, "recipient");
                }
                // Check JettonTransfer
                if let Some(jt) = &action.jetton_transfer {
                    if let Some(s) = &jt.sender {
                        Self::collect_identity(&mut seen, s, "sender");
                    }
                    if let Some(r) = &jt.recipient {
                        Self::collect_identity(&mut seen, r, "recipient");
                    }
                }
                // Check NftItemTransfer
                if let Some(nt) = &action.nft_item_transfer {
                    if let Some(s) = &nt.sender {
                        Self::collect_identity(&mut seen, s, "sender");
                    }
                    if let Some(r) = &nt.recipient {
                        Self::collect_identity(&mut seen, r, "recipient");
                    }
                }
            }
        }

        if seen.is_empty() {
            return Ok(vec![]);
        }

        let identities: Vec<CounterpartyIdentity> = seen.into_values().collect();

        Ok(vec![WalletInsight::CounterpartyIdentities(CounterpartyIdentitiesData {
            events_scanned: events.len(),
            identities,
        })])
    }

    fn collect_identity(
        seen: &mut HashMap<String, CounterpartyIdentity>,
        account: &RawAccountRef,
        role: &str,
    ) {
        if let Some(name) = &account.name {
            if !name.is_empty() && !seen.contains_key(&account.address) {
                seen.insert(account.address.clone(), CounterpartyIdentity {
                    address: account.address.clone(),
                    name: name.clone(),
                    icon_url: account.icon.clone(),
                    is_wallet: account.is_wallet.unwrap_or(false),
                    role: role.to_string(),
                });
            }
        }
    }
}

impl WalletSource for TonApiEventsSource {
    fn source_name(&self) -> &'static str {
        "tonapi_events"
    }

    async fn fetch(&self, address: &str) -> Result<Vec<WalletInsight>, SourceError> {
        let url = format!("{}/v2/accounts/{}/events?limit=50", self.base_url, address);
        match self.get_json(&url).await {
            Ok(json) => Self::parse_events_response(&json),
            Err(SourceError::NotFound) => Ok(vec![]),
            Err(e) => Err(e),
        }
    }
}

// ── Raw event response types ─────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct RawEventsResponse {
    events: Option<Vec<RawEvent>>,
}

#[derive(Debug, Deserialize)]
struct RawEvent {
    actions: Vec<RawAction>,
}

#[derive(Debug, Deserialize)]
struct RawAction {
    #[serde(rename = "TonTransfer")]
    ton_transfer: Option<RawTonTransfer>,
    #[serde(rename = "JettonTransfer")]
    jetton_transfer: Option<RawJettonTransfer>,
    #[serde(rename = "NftItemTransfer")]
    nft_item_transfer: Option<RawNftItemTransfer>,
}

#[derive(Debug, Deserialize)]
struct RawTonTransfer {
    sender: RawAccountRef,
    recipient: RawAccountRef,
}

#[derive(Debug, Deserialize)]
struct RawJettonTransfer {
    sender: Option<RawAccountRef>,
    recipient: Option<RawAccountRef>,
}

#[derive(Debug, Deserialize)]
struct RawNftItemTransfer {
    sender: Option<RawAccountRef>,
    recipient: Option<RawAccountRef>,
}

#[derive(Debug, Deserialize)]
struct RawAccountRef {
    address: String,
    name: Option<String>,
    icon: Option<String>,
    is_wallet: Option<bool>,
}

// ══════════════════════════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_events_with_named_counterparties() {
        let json = r#"{
            "events": [
                {
                    "actions": [
                        {
                            "TonTransfer": {
                                "sender": {
                                    "address": "0:abc123",
                                    "name": "alice.t.me",
                                    "icon": "https://example.com/alice.webp",
                                    "is_wallet": true
                                },
                                "recipient": {
                                    "address": "0:def456",
                                    "name": null,
                                    "is_wallet": true
                                }
                            }
                        }
                    ]
                },
                {
                    "actions": [
                        {
                            "TonTransfer": {
                                "sender": {
                                    "address": "0:fragment",
                                    "name": "Fragment",
                                    "icon": "https://example.com/fragment.webp",
                                    "is_wallet": true
                                },
                                "recipient": {
                                    "address": "0:def456",
                                    "name": null,
                                    "is_wallet": true
                                }
                            }
                        }
                    ]
                }
            ]
        }"#;

        let insights = TonApiEventsSource::parse_events_response(json).unwrap();
        assert_eq!(insights.len(), 1);

        if let WalletInsight::CounterpartyIdentities(data) = &insights[0] {
            assert_eq!(data.events_scanned, 2);
            assert_eq!(data.identities.len(), 2);

            let alice = data.identities.iter().find(|i| i.name == "alice.t.me").unwrap();
            assert_eq!(alice.address, "0:abc123");
            assert_eq!(alice.icon_url.as_deref(), Some("https://example.com/alice.webp"));
            assert_eq!(alice.role, "sender");

            let fragment = data.identities.iter().find(|i| i.name == "Fragment").unwrap();
            assert_eq!(fragment.address, "0:fragment");
        } else {
            panic!("expected CounterpartyIdentities");
        }
    }

    #[test]
    fn parse_events_no_names() {
        let json = r#"{
            "events": [{
                "actions": [{
                    "TonTransfer": {
                        "sender": {"address": "0:aaa", "is_wallet": true},
                        "recipient": {"address": "0:bbb", "is_wallet": true}
                    }
                }]
            }]
        }"#;
        let insights = TonApiEventsSource::parse_events_response(json).unwrap();
        assert!(insights.is_empty());
    }

    #[test]
    fn parse_events_empty() {
        let json = r#"{"events": []}"#;
        assert!(TonApiEventsSource::parse_events_response(json).unwrap().is_empty());
    }

    #[test]
    fn parse_events_deduplicates() {
        let json = r#"{
            "events": [
                {"actions": [{"TonTransfer": {"sender": {"address": "0:x", "name": "bob.t.me"}, "recipient": {"address": "0:y"}}}]},
                {"actions": [{"TonTransfer": {"sender": {"address": "0:x", "name": "bob.t.me"}, "recipient": {"address": "0:y"}}}]}
            ]
        }"#;
        let insights = TonApiEventsSource::parse_events_response(json).unwrap();
        if let WalletInsight::CounterpartyIdentities(data) = &insights[0] {
            assert_eq!(data.identities.len(), 1); // deduplicated
        }
    }

    #[test]
    fn parse_events_jetton_and_nft_transfers() {
        let json = r#"{
            "events": [{
                "actions": [
                    {
                        "JettonTransfer": {
                            "sender": {"address": "0:jetton_sender", "name": "dex.t.me", "is_wallet": false},
                            "recipient": {"address": "0:me"}
                        }
                    },
                    {
                        "NftItemTransfer": {
                            "sender": {"address": "0:nft_sender"},
                            "recipient": {"address": "0:nft_buyer", "name": "collector.t.me", "is_wallet": true}
                        }
                    }
                ]
            }]
        }"#;
        let insights = TonApiEventsSource::parse_events_response(json).unwrap();
        if let WalletInsight::CounterpartyIdentities(data) = &insights[0] {
            assert_eq!(data.identities.len(), 2);
            assert!(data.identities.iter().any(|i| i.name == "dex.t.me"));
            assert!(data.identities.iter().any(|i| i.name == "collector.t.me"));
        }
    }
}
