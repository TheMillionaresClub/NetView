use reqwest_wasm::Client;

use crate::error::SourceError;
use crate::models::*;
use super::WalletSource;

// ══════════════════════════════════════════════════════════════════════════════
// GetGemsScraper — NFT marketplace profile scraper
//
// Scrapes https://getgems.io/user/{address}
// Extracts: profile username, NFT count, collection names
// ══════════════════════════════════════════════════════════════════════════════

const USER_AGENT: &str = "Mozilla/5.0 (compatible; TonWalletProfiler/1.0)";

pub struct GetGemsScraper {
    client: Client,
}

impl GetGemsScraper {
    pub fn new(client: Client) -> Self {
        Self { client }
    }

    async fn fetch_html(&self, url: &str) -> Result<String, SourceError> {
        let resp = self.client
            .get(url)
            .header("User-Agent", USER_AGENT)
            .send()
            .await?;

        let status = resp.status();
        if status == reqwest_wasm::StatusCode::NOT_FOUND {
            return Err(SourceError::NotFound);
        }
        if !status.is_success() {
            return Err(SourceError::Http(status.as_u16(), String::new()));
        }

        Ok(resp.text().await.map_err(|e| SourceError::Http(0, e.to_string()))?)
    }

    /// Parse GetGems user profile page HTML.
    pub fn parse_html(html: &str) -> Option<NftProfileData> {
        let dom = tl::parse(html, tl::ParserOptions::default()).ok()?;
        let parser = dom.parser();

        // Extract username from profile header
        let username = Self::extract_text(&dom, parser, ".profile-name")
            .or_else(|| Self::extract_text(&dom, parser, ".user-name"))
            .or_else(|| Self::extract_text(&dom, parser, "[data-testid=\"profile-name\"]"))
            .filter(|u| !u.is_empty());

        // Extract NFT count from profile stats
        let nft_count = Self::extract_text(&dom, parser, ".nft-count")
            .or_else(|| Self::extract_text(&dom, parser, ".items-count"))
            .or_else(|| Self::extract_text(&dom, parser, "[data-testid=\"nft-count\"]"))
            .and_then(|s| Self::parse_number(&s))
            .unwrap_or(0);

        // Extract collection names from listed collections
        let collections = Self::extract_all_texts(&dom, parser, ".collection-name")
            .or_else(|| Self::extract_all_texts(&dom, parser, ".collection-title"));
        let collections = collections.unwrap_or_default();

        // Only return if we found meaningful data
        if username.is_none() && nft_count == 0 && collections.is_empty() {
            return None;
        }

        Some(NftProfileData {
            getgems_username: username,
            nft_count,
            collections,
        })
    }

    fn extract_text(dom: &tl::VDom, parser: &tl::Parser, selector: &str) -> Option<String> {
        let mut iter = dom.query_selector(selector)?;
        let handle = iter.next()?;
        let node = handle.get(parser)?;
        let text = node.inner_text(parser).trim().to_string();
        if text.is_empty() { None } else { Some(text) }
    }

    fn extract_all_texts(
        dom: &tl::VDom,
        parser: &tl::Parser,
        selector: &str,
    ) -> Option<Vec<String>> {
        let iter = dom.query_selector(selector)?;
        let texts: Vec<String> = iter
            .filter_map(|handle| {
                let node = handle.get(parser)?;
                let text = node.inner_text(parser).trim().to_string();
                if text.is_empty() { None } else { Some(text) }
            })
            .collect();

        if texts.is_empty() { None } else { Some(texts) }
    }

    fn parse_number(s: &str) -> Option<usize> {
        // Handle "1,234" or "1 234" formatted numbers
        let cleaned: String = s.chars().filter(|c| c.is_ascii_digit()).collect();
        cleaned.parse().ok()
    }
}

impl WalletSource for GetGemsScraper {
    fn source_name(&self) -> &'static str {
        "getgems"
    }

    async fn fetch(&self, address: &str) -> Result<Vec<WalletInsight>, SourceError> {
        let url = format!("https://getgems.io/user/{}", address);
        let html = self.fetch_html(&url).await?;

        match Self::parse_html(&html) {
            Some(profile) => Ok(vec![WalletInsight::NftProfile(profile)]),
            None => Ok(vec![]),
        }
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_full_profile() {
        let html = r#"
            <html><body>
                <div class="profile-name">alice_collector</div>
                <span class="nft-count">42</span>
                <div class="collection-name">TON Diamonds</div>
                <div class="collection-name">Whales Club</div>
            </body></html>
        "#;
        let profile = GetGemsScraper::parse_html(html).unwrap();
        assert_eq!(profile.getgems_username.as_deref(), Some("alice_collector"));
        assert_eq!(profile.nft_count, 42);
        assert_eq!(profile.collections.len(), 2);
        assert!(profile.collections.contains(&"TON Diamonds".to_string()));
    }

    #[test]
    fn parse_profile_formatted_number() {
        let html = r#"
            <html><body>
                <span class="items-count">1,234</span>
            </body></html>
        "#;
        let profile = GetGemsScraper::parse_html(html).unwrap();
        assert_eq!(profile.nft_count, 1234);
    }

    #[test]
    fn parse_profile_no_data() {
        let html = r#"<html><body><div>No profile here</div></body></html>"#;
        assert!(GetGemsScraper::parse_html(html).is_none());
    }

    #[test]
    fn parse_username_only() {
        let html = r#"
            <html><body>
                <span class="user-name">bob_nft</span>
            </body></html>
        "#;
        let profile = GetGemsScraper::parse_html(html).unwrap();
        assert_eq!(profile.getgems_username.as_deref(), Some("bob_nft"));
        assert_eq!(profile.nft_count, 0);
    }

    #[test]
    fn parse_number_handles_formats() {
        assert_eq!(GetGemsScraper::parse_number("42"), Some(42));
        assert_eq!(GetGemsScraper::parse_number("1,234"), Some(1234));
        assert_eq!(GetGemsScraper::parse_number("1 234"), Some(1234));
        assert_eq!(GetGemsScraper::parse_number(""), None);
        assert_eq!(GetGemsScraper::parse_number("abc"), None);
    }
}
