use reqwest_wasm::Client;
use serde::Deserialize;

use crate::error::SourceError;
use crate::models::*;
use super::WalletSource;

// ══════════════════════════════════════════════════════════════════════════════
// FragmentScraper — Telegram username ownership via fragment.com
//
// Strategy A: Telegram Bot API (if bot_token provided)
//   POST https://api.telegram.org/bot{token}/getCollectibleInfo
//
// Strategy B: Scrape https://fragment.com/?query={address}
// ══════════════════════════════════════════════════════════════════════════════

const USER_AGENT: &str = "Mozilla/5.0 (compatible; TonWalletProfiler/1.0)";

pub struct FragmentScraper {
    client: Client,
    bot_token: Option<String>,
}

impl FragmentScraper {
    pub fn new(client: Client, bot_token: Option<String>) -> Self {
        Self { client, bot_token }
    }

    // ── Strategy A: Telegram Bot API ─────────────────────────────────────────

    async fn fetch_via_bot_api(&self, address: &str) -> Result<Vec<WalletInsight>, SourceError> {
        let token = match &self.bot_token {
            Some(t) => t,
            None => return Ok(vec![]),
        };

        let url = format!(
            "https://api.telegram.org/bot{}/getCollectibleInfo",
            token
        );

        let body = serde_json::json!({
            "wallet_address": address
        });

        let resp = self.client
            .post(&url)
            .json(&body)
            .send()
            .await?;

        let status = resp.status();
        if !status.is_success() {
            return Ok(vec![]); // Silently skip if API fails
        }

        let json = resp.text().await.map_err(|e| SourceError::Http(0, e.to_string()))?;
        Self::parse_bot_api_response(&json)
    }

    pub fn parse_bot_api_response(json: &str) -> Result<Vec<WalletInsight>, SourceError> {
        let raw: TelegramBotResponse = serde_json::from_str(json)?;
        if !raw.ok {
            return Ok(vec![]);
        }

        let result = match raw.result {
            Some(r) => r,
            None => return Ok(vec![]),
        };

        let mut insights = Vec::new();

        if let Some(username) = result.username {
            insights.push(WalletInsight::TelegramUsername(TelegramInsight {
                username: username.clone(),
                purchase_date: result.purchase_date,
                fragment_url: format!("https://fragment.com/username/{}", username),
            }));
        }

        Ok(insights)
    }

    // ── Strategy B: HTML scraping ────────────────────────────────────────────

    async fn fetch_via_scrape(&self, address: &str) -> Result<Vec<WalletInsight>, SourceError> {
        let url = format!("https://fragment.com/?query={}", address);
        let resp = self.client
            .get(&url)
            .header("User-Agent", USER_AGENT)
            .send()
            .await?;

        let status = resp.status();
        if status == reqwest_wasm::StatusCode::NOT_FOUND {
            return Ok(vec![]);
        }
        if !status.is_success() {
            return Ok(vec![]); // Silently skip
        }

        let html = resp.text().await.map_err(|e| SourceError::Http(0, e.to_string()))?;
        Ok(Self::parse_fragment_html(&html))
    }

    pub fn parse_fragment_html(html: &str) -> Vec<WalletInsight> {
        let dom = match tl::parse(html, tl::ParserOptions::default()) {
            Ok(d) => d,
            Err(_) => return vec![],
        };
        let parser = dom.parser();

        let mut insights = Vec::new();

        // Look for username listing cards on Fragment
        if let Some(iter) = dom.query_selector(".tm-section-header-title") {
            for handle in iter {
                if let Some(node) = handle.get(parser) {
                    let text = node.inner_text(parser).trim().to_string();
                    if text.starts_with('@') {
                        let username = text.trim_start_matches('@').to_string();
                        insights.push(WalletInsight::TelegramUsername(TelegramInsight {
                            username: username.clone(),
                            purchase_date: None,
                            fragment_url: format!("https://fragment.com/username/{}", username),
                        }));
                    }
                }
            }
        }

        // Look for listing price
        if let Some(mut iter) = dom.query_selector(".table-cell-value.tm-value") {
            if let Some(handle) = iter.next() {
                if let Some(node) = handle.get(parser) {
                    let price_text = node.inner_text(parser).trim().to_string();
                    if let Some(price) = parse_ton_price(&price_text) {
                        // Find the username this price belongs to
                        let owner = Self::extract_text(&dom, parser, ".tm-wallet-address")
                            .unwrap_or_default();
                        let username = Self::extract_text(&dom, parser, ".tm-section-header-title")
                            .unwrap_or_default()
                            .trim_start_matches('@')
                            .to_string();

                        if !username.is_empty() {
                            insights.push(WalletInsight::FragmentListing(FragmentInsight {
                                username,
                                price_ton: Some(price),
                                owner_wallet: owner,
                            }));
                        }
                    }
                }
            }
        }

        insights
    }

    fn extract_text(dom: &tl::VDom, parser: &tl::Parser, selector: &str) -> Option<String> {
        let mut iter = dom.query_selector(selector)?;
        let handle = iter.next()?;
        let node = handle.get(parser)?;
        let text = node.inner_text(parser).trim().to_string();
        if text.is_empty() { None } else { Some(text) }
    }
}

fn parse_ton_price(s: &str) -> Option<f64> {
    // Parse "150 TON" or "150.5 TON" format
    let cleaned = s.replace("TON", "").replace(',', "").trim().to_string();
    cleaned.parse().ok()
}

impl WalletSource for FragmentScraper {
    fn source_name(&self) -> &'static str {
        "fragment"
    }

    async fn fetch(&self, address: &str) -> Result<Vec<WalletInsight>, SourceError> {
        // Try Bot API first if token available
        if self.bot_token.is_some() {
            let result = self.fetch_via_bot_api(address).await?;
            if !result.is_empty() {
                return Ok(result);
            }
        }

        // Fallback to HTML scraping
        self.fetch_via_scrape(address).await
    }
}

// ── Raw Telegram Bot API response types ──────────────────────────────────────

#[derive(Debug, Deserialize)]
struct TelegramBotResponse {
    ok: bool,
    result: Option<CollectibleInfo>,
}

#[derive(Debug, Deserialize)]
struct CollectibleInfo {
    username: Option<String>,
    purchase_date: Option<u64>,
}

// ══════════════════════════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_bot_api_with_username() {
        let json = r#"{
            "ok": true,
            "result": {
                "username": "alice",
                "purchase_date": 1700000000
            }
        }"#;
        let insights = FragmentScraper::parse_bot_api_response(json).unwrap();
        assert_eq!(insights.len(), 1);
        if let WalletInsight::TelegramUsername(info) = &insights[0] {
            assert_eq!(info.username, "alice");
            assert_eq!(info.purchase_date, Some(1700000000));
            assert!(info.fragment_url.contains("alice"));
        } else {
            panic!("expected TelegramUsername");
        }
    }

    #[test]
    fn parse_bot_api_not_ok() {
        let json = r#"{"ok": false}"#;
        let insights = FragmentScraper::parse_bot_api_response(json).unwrap();
        assert!(insights.is_empty());
    }

    #[test]
    fn parse_bot_api_no_result() {
        let json = r#"{"ok": true, "result": null}"#;
        let insights = FragmentScraper::parse_bot_api_response(json).unwrap();
        assert!(insights.is_empty());
    }

    #[test]
    fn parse_fragment_html_with_username() {
        let html = r#"
            <html><body>
                <div class="tm-section-header-title">@cooluser</div>
            </body></html>
        "#;
        let insights = FragmentScraper::parse_fragment_html(html);
        assert_eq!(insights.len(), 1);
        if let WalletInsight::TelegramUsername(info) = &insights[0] {
            assert_eq!(info.username, "cooluser");
        } else {
            panic!("expected TelegramUsername");
        }
    }

    #[test]
    fn parse_fragment_html_no_match() {
        let html = r#"<html><body><div>Nothing here</div></body></html>"#;
        let insights = FragmentScraper::parse_fragment_html(html);
        assert!(insights.is_empty());
    }

    #[test]
    fn parse_ton_price_formats() {
        assert_eq!(parse_ton_price("150 TON"), Some(150.0));
        assert_eq!(parse_ton_price("150.5 TON"), Some(150.5));
        assert_eq!(parse_ton_price("1,500 TON"), Some(1500.0));
        assert!(parse_ton_price("free").is_none());
    }
}
