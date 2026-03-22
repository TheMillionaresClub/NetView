use wallet_scraper::{Network, ProfileBuilder, ScraperConfig};

fn print_profile(profile: &wallet_scraper::WalletProfile) {
    println!("\n{}", "=".repeat(70));
    println!("  Address: {}", profile.address);
    println!("  Elapsed: {}ms", profile.elapsed_ms);
    println!("  Insights: {}", profile.insights.len());
    println!("  Errors:   {}", profile.errors.len());
    println!("{}", "=".repeat(70));

    for insight in &profile.insights {
        match insight {
            wallet_scraper::WalletInsight::AccountMeta(m) => {
                println!("  [AccountMeta] source={}, balance={:.4} TON, type={}, active={}",
                    m.source, m.balance_ton, m.wallet_type, m.is_active);
                if let Some(name) = &m.linked_name {
                    println!("    -> Linked Telegram: {}", name);
                }
                if let Some(icon) = &m.icon_url {
                    println!("    -> Avatar: {}", icon);
                }
            }
            wallet_scraper::WalletInsight::TonDomain(d) => {
                println!("  [TonDomain] {} (expiry_lt: {:?})", d.domain, d.expiry_lt);
            }
            wallet_scraper::WalletInsight::JettonPortfolio(j) => {
                println!("  [JettonPortfolio] {} tokens:", j.balances.len());
                for b in &j.balances {
                    println!("    - {} ({}): {} (USD: {:?})",
                        b.symbol, b.name.as_deref().unwrap_or("?"), b.balance, b.usd_value);
                }
            }
            wallet_scraper::WalletInsight::NftProfile(n) => {
                println!("  [NftProfile] username={:?}, count={}, collections={:?}",
                    n.getgems_username, n.nft_count, n.collections);
            }
            wallet_scraper::WalletInsight::WalletLabel(l) => {
                println!("  [WalletLabel] source={}, label='{}', category={:?}",
                    l.source, l.label, l.category);
            }
            wallet_scraper::WalletInsight::TelegramUsername(t) => {
                println!("  [TelegramUsername] @{} (purchased: {:?}, url: {})",
                    t.username, t.purchase_date, t.fragment_url);
            }
            wallet_scraper::WalletInsight::RiskScore(r) => {
                println!("  [RiskScore] source={}, score={}, flags={:?}",
                    r.source, r.score, r.flags);
            }
            wallet_scraper::WalletInsight::FragmentListing(f) => {
                println!("  [FragmentListing] @{} price={:?} TON, owner={}",
                    f.username, f.price_ton, f.owner_wallet);
            }
            wallet_scraper::WalletInsight::TelegramIdentity(t) => {
                println!("  [TelegramIdentity]");
                if let Some(tg) = &t.linked_telegram {
                    println!("    -> Linked Telegram: {}", tg);
                }
                if let Some(avatar) = &t.avatar_url {
                    println!("    -> Avatar URL: {}", avatar);
                }
                if !t.owned_usernames.is_empty() {
                    println!("    -> Owned usernames: {:?}", t.owned_usernames);
                }
                if !t.owned_phone_numbers.is_empty() {
                    println!("    -> Owned phone numbers: {:?}", t.owned_phone_numbers);
                }
                if !t.dns_records.is_empty() {
                    println!("    -> DNS records: {:?}", t.dns_records);
                }
            }
        }
    }

    for err in &profile.errors {
        println!("  [ERROR] {}: {}", err.source_name, err.error);
    }

    // Also dump raw JSON
    println!("\n  --- Raw JSON ---");
    println!("  {}", serde_json::to_string_pretty(profile).unwrap_or_default());
}

#[tokio::main]
async fn main() {
    println!("=== Wallet Scraper Live Test ===\n");

    // ── Testnet wallets ──────────────────────────────────────────────────
    let testnet_addrs = vec![
        "0QBbtZtF0cYG5xj7JvpbUhHIkMqx3PhE4FVqAXJx9k-Ljy8_".to_string(),
        "0QD1hNskAprdzNaWFYE46Np1AjF0bUa3eIBohc4BLXIYlEGV".to_string(),
    ];

    // For testnet: only use tonapi + toncenter (scrapers won't find testnet data)
    let testnet_config = ScraperConfig::new()
        .with_network(Network::Testnet)
        .with_enabled_sources(vec![
            "tonapi".into(),
            "toncenter".into(),
        ]);

    println!("--- TESTNET (tonapi + toncenter, no API key) ---");
    let builder = ProfileBuilder::new(&testnet_config);
    println!("  Sources enabled: {}", builder.source_count());

    let response = builder.build_profiles(&testnet_addrs).await;
    println!("  Total elapsed: {}ms", response.total_elapsed_ms);

    for profile in &response.profiles {
        print_profile(profile);
    }

    // ── Mainnet wallets ──────────────────────────────────────────────────
    let mainnet_addrs = vec![
        "EQACuz151snlY46PKdUOkyiCf0zzcxMsN6XmKQkSKZjkvyFH".to_string(),
        "UQAGXzN4NqPhUUpHkK0iCQRwMWbR8rTAzQpgf4JKZwLYMjUK".to_string(),
        // Wallet that owns a Fragment phone number NFT + has linked Telegram
        "0:9b6aa17c715d8960129a15213f3c6702cbd7c815de1e61e4973ddeb6c3a61ddd".to_string(),
    ];

    // For mainnet: use tonapi only to avoid rate limiting from other sources
    let mainnet_config = ScraperConfig::new()
        .with_network(Network::Mainnet)
        .with_enabled_sources(vec!["tonapi".into()]);

    println!("\n\n--- MAINNET (tonapi only, no API key) ---");
    let builder = ProfileBuilder::new(&mainnet_config);
    println!("  Sources enabled: {}", builder.source_count());

    let response = builder.build_profiles(&mainnet_addrs).await;
    println!("  Total elapsed: {}ms", response.total_elapsed_ms);

    for profile in &response.profiles {
        print_profile(profile);
    }

    println!("\n=== Done ===");
}
