use reqwest_wasm::Client;

use crate::error::SourceError;
use crate::models::*;
use super::WalletSource;

// ══════════════════════════════════════════════════════════════════════════════
// TonscanScraper — extracts explorer labels from HTML pages
//
// Primary:  https://tonscan.org/address/{addr}
// Fallback: https://tonviewer.com/{addr}
// ══════════════════════════════════════════════════════════════════════════════

const USER_AGENT: &str = "Mozilla/5.0 (compatible; TonWalletProfiler/1.0)";

pub struct TonscanScraper {
    client: Client,
}

impl TonscanScraper {
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

    /// Parse tonscan HTML to extract wallet label/tag.
    /// Returns None if no label found.
    pub fn parse_tonscan_html(html: &str) -> Option<LabelInsight> {
        let dom = tl::parse(html, tl::ParserOptions::default()).ok()?;
        let parser = dom.parser();

        // Try multiple CSS selectors commonly used for wallet labels
        let label = Self::extract_text_by_selector(&dom, parser, ".address-tag")
            .or_else(|| Self::extract_text_by_selector(&dom, parser, ".entity-name"))
            .or_else(|| Self::extract_text_by_selector(&dom, parser, "[data-label]"))
            .or_else(|| Self::extract_text_by_selector(&dom, parser, ".wallet-name"));

        let label = label?;
        if label.trim().is_empty() {
            return None;
        }

        // Try to extract category
        let category = Self::extract_text_by_selector(&dom, parser, ".entity-category")
            .or_else(|| Self::extract_text_by_selector(&dom, parser, ".address-category"))
            .filter(|c| !c.trim().is_empty());

        Some(LabelInsight {
            source: "tonscan".into(),
            label: label.trim().to_string(),
            category,
        })
    }

    /// Parse tonviewer HTML as fallback.
    pub fn parse_tonviewer_html(html: &str) -> Option<LabelInsight> {
        let dom = tl::parse(html, tl::ParserOptions::default()).ok()?;
        let parser = dom.parser();

        let label = Self::extract_text_by_selector(&dom, parser, ".account-name")
            .or_else(|| Self::extract_text_by_selector(&dom, parser, "[data-testid=\"account-name\"]"))
            .or_else(|| Self::extract_text_by_selector(&dom, parser, "h1.name"));

        let label = label?;
        if label.trim().is_empty() {
            return None;
        }

        Some(LabelInsight {
            source: "tonviewer".into(),
            label: label.trim().to_string(),
            category: None,
        })
    }

    fn extract_text_by_selector(
        dom: &tl::VDom,
        parser: &tl::Parser,
        selector: &str,
    ) -> Option<String> {
        let mut iter = dom.query_selector(selector)?;
        let handle = iter.next()?;
        let node = handle.get(parser)?;
        let text = node.inner_text(parser);
        let text = text.trim().to_string();
        if text.is_empty() { None } else { Some(text) }
    }
}

impl WalletSource for TonscanScraper {
    fn source_name(&self) -> &'static str {
        "tonscan"
    }

    async fn fetch(&self, address: &str) -> Result<Vec<WalletInsight>, SourceError> {
        // Try tonscan first
        let tonscan_url = format!("https://tonscan.org/address/{}", address);
        if let Ok(html) = self.fetch_html(&tonscan_url).await {
            if let Some(label) = Self::parse_tonscan_html(&html) {
                return Ok(vec![WalletInsight::WalletLabel(label)]);
            }
        }

        // Fallback to tonviewer
        let tonviewer_url = format!("https://tonviewer.com/{}", address);
        if let Ok(html) = self.fetch_html(&tonviewer_url).await {
            if let Some(label) = Self::parse_tonviewer_html(&html) {
                return Ok(vec![WalletInsight::WalletLabel(label)]);
            }
        }

        Ok(vec![])
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_tonscan_with_label() {
        let html = r#"
            <html><body>
                <div class="address-tag">Binance Hot Wallet</div>
                <div class="entity-category">Exchange</div>
            </body></html>
        "#;
        let result = TonscanScraper::parse_tonscan_html(html).unwrap();
        assert_eq!(result.label, "Binance Hot Wallet");
        assert_eq!(result.category.as_deref(), Some("Exchange"));
        assert_eq!(result.source, "tonscan");
    }

    #[test]
    fn parse_tonscan_entity_name() {
        let html = r#"
            <html><body>
                <span class="entity-name">OKX Deposit</span>
            </body></html>
        "#;
        let result = TonscanScraper::parse_tonscan_html(html).unwrap();
        assert_eq!(result.label, "OKX Deposit");
        assert!(result.category.is_none());
    }

    #[test]
    fn parse_tonscan_no_label() {
        let html = r#"<html><body><div>Just some page</div></body></html>"#;
        assert!(TonscanScraper::parse_tonscan_html(html).is_none());
    }

    #[test]
    fn parse_tonscan_empty_label() {
        let html = r#"<html><body><div class="address-tag">   </div></body></html>"#;
        assert!(TonscanScraper::parse_tonscan_html(html).is_none());
    }

    #[test]
    fn parse_tonviewer_with_name() {
        let html = r#"
            <html><body>
                <span class="account-name">Fragment Marketplace</span>
            </body></html>
        "#;
        let result = TonscanScraper::parse_tonviewer_html(html).unwrap();
        assert_eq!(result.label, "Fragment Marketplace");
        assert_eq!(result.source, "tonviewer");
    }

    #[test]
    fn parse_tonviewer_no_name() {
        let html = r#"<html><body><div>Anonymous wallet</div></body></html>"#;
        assert!(TonscanScraper::parse_tonviewer_html(html).is_none());
    }
}
