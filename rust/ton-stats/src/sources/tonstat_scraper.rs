use reqwest_wasm::Client;

use crate::error::SourceError;
use crate::models::*;
use crate::sources::StatsSource;

pub struct TonStatScraper {
    client: Client,
}

impl TonStatScraper {
    pub fn new(client: Client) -> Self {
        Self { client }
    }
}

impl StatsSource for TonStatScraper {
    fn source_name(&self) -> &'static str {
        "tonstat"
    }

    async fn fetch(&self) -> Result<Vec<SnapshotContribution>, SourceError> {
        let resp = self.client
            .get("https://tonstat.com")
            .header("User-Agent", "TonStatsDashboard/1.0")
            .send()
            .await?;

        if !resp.status().is_success() {
            return Err(SourceError::Http(resp.status().as_u16(), "tonstat.com failed".into()));
        }

        let html = resp.text().await.map_err(|e| SourceError::Parse(e.to_string()))?;
        let network = parse_tonstat_html(&html)?;

        Ok(vec![SnapshotContribution::Network(network)])
    }
}

fn parse_stat(s: &str) -> Option<f64> {
    s.trim()
        .replace(",", "")
        .replace("$", "")
        .replace("%", "")
        .replace(" ", "")
        .parse::<f64>()
        .ok()
}

fn parse_stat_u64(s: &str) -> Option<u64> {
    parse_stat(s).map(|f| f as u64)
}

fn parse_tonstat_html(html: &str) -> Result<NetworkStats, SourceError> {
    let dom = tl::parse(html, tl::ParserOptions::default())
        .map_err(|e| SourceError::Parse(format!("HTML parse error: {:?}", e)))?;
    let parser = dom.parser();

    // Extract stat values — tonstat.com uses various patterns for stat display
    // We'll look for common patterns: elements with numeric content near known labels
    let mut stats = NetworkStats::default();

    // Try to extract amounts from elements with class "amount" or similar stat containers
    if let Some(iter) = dom.query_selector(".amount") {
        let amounts: Vec<String> = iter
            .filter_map(|h| h.get(parser))
            .map(|n| n.inner_text(parser).trim().to_string())
            .collect();

        // tonstat.com typically shows stats in order:
        // total supply, annual inflation, burned/day, minted/day,
        // total accounts, txs/day, active wallets daily, active wallets monthly
        if amounts.len() >= 1 { stats.total_supply_ton = parse_stat(&amounts[0]); }
        if amounts.len() >= 2 { stats.annual_inflation_rate_pct = parse_stat(&amounts[1]); }
        if amounts.len() >= 3 { stats.burned_per_day_ton = parse_stat(&amounts[2]); }
        if amounts.len() >= 4 { stats.minted_per_day_ton = parse_stat(&amounts[3]); }
        if amounts.len() >= 5 { stats.total_accounts = parse_stat_u64(&amounts[4]); }
        if amounts.len() >= 6 { stats.transactions_per_day = parse_stat_u64(&amounts[5]); }
        if amounts.len() >= 7 { stats.active_wallets_daily = parse_stat_u64(&amounts[6]); }
        if amounts.len() >= 8 { stats.active_wallets_monthly = parse_stat_u64(&amounts[7]); }
    }

    // Also try data-value attributes
    if let Some(iter) = dom.query_selector("[data-value]") {
        for handle in iter {
            if let Some(node) = handle.get(parser) {
                if let Some(tag) = node.as_tag() {
                    if let Some(val) = tag.attributes().get("data-value").flatten() {
                        let val_str = val.as_utf8_str();
                        let label = node.inner_text(parser).to_lowercase();

                        if label.contains("total supply") {
                            stats.total_supply_ton = parse_stat(&val_str);
                        } else if label.contains("account") {
                            stats.total_accounts = parse_stat_u64(&val_str);
                        }
                    }
                }
            }
        }
    }

    Ok(stats)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_stat_handles_formats() {
        assert_eq!(parse_stat("1,234,567"), Some(1234567.0));
        assert_eq!(parse_stat("$1,234"), Some(1234.0));
        assert_eq!(parse_stat("2.5%"), Some(2.5));
        assert_eq!(parse_stat("  42  "), Some(42.0));
        assert!(parse_stat("N/A").is_none());
    }

    #[test]
    fn parse_empty_html() {
        let html = "<html><body></body></html>";
        let stats = parse_tonstat_html(html).unwrap();
        assert!(stats.total_supply_ton.is_none());
    }

    #[test]
    fn parse_html_with_amounts() {
        let html = r#"
        <html><body>
            <span class="amount">5,110,000,000</span>
            <span class="amount">0.6</span>
            <span class="amount">12,500</span>
            <span class="amount">50,000</span>
            <span class="amount">150,000,000</span>
            <span class="amount">4,500,000</span>
            <span class="amount">850,000</span>
            <span class="amount">3,200,000</span>
        </body></html>
        "#;
        let stats = parse_tonstat_html(html).unwrap();
        assert_eq!(stats.total_supply_ton, Some(5_110_000_000.0));
        assert_eq!(stats.annual_inflation_rate_pct, Some(0.6));
        assert_eq!(stats.total_accounts, Some(150_000_000));
        assert_eq!(stats.active_wallets_daily, Some(850_000));
    }
}
