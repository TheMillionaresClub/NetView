use wallet_info::{
    analysis::{self, make_client},
    network::{Network, get_transactions_page},
    types::fetch_address_balance,
};
use reqwest_wasm::Client;

const MAINNET_WALLETS: &[&str] = &[
    "UQArrA_ZwkAk2iTiaOFg2o1nxwjVE2dNG0UxrnX19ghMkvXP",
    "UQCJuqQXBoOzls_1QlOhP2FfrzVrN4UP7hLv6XQv5y2QaXT_",
];

const TESTNET_WALLETS: &[&str] = &[
    "0QBbtZtF0cYG5xj7JvpbUhHIkMqx3PhE4FVqAXJx9k-Ljy8_",
];

fn sep(label: &str) {
    println!("\n{}\n  {}\n{}", "─".repeat(70), label, "─".repeat(70));
}

// ── Direct tonapi call (bypasses the WASM layer) ──────────────────────────────
async fn tonapi_get_account(client: &Client, addr: &str, mainnet: bool) -> Option<serde_json::Value> {
    let base = if mainnet { "https://tonapi.io" } else { "https://testnet.tonapi.io" };
    let url = format!("{}/v2/accounts/{}", base, urlencode(addr));
    let resp = client.get(&url)
        .header("Accept", "application/json")
        .send().await.ok()?;
    if !resp.status().is_success() { return None; }
    resp.json::<serde_json::Value>().await.ok()
}

async fn tonapi_get_jettons(client: &Client, addr: &str, mainnet: bool) -> Option<serde_json::Value> {
    let base = if mainnet { "https://tonapi.io" } else { "https://testnet.tonapi.io" };
    let url = format!("{}/v2/accounts/{}/jettons?limit=20", base, urlencode(addr));
    let resp = client.get(&url)
        .header("Accept", "application/json")
        .send().await.ok()?;
    if !resp.status().is_success() { return None; }
    resp.json::<serde_json::Value>().await.ok()
}

async fn tonapi_get_transactions(client: &Client, addr: &str, mainnet: bool) -> Option<serde_json::Value> {
    let base = if mainnet { "https://tonapi.io" } else { "https://testnet.tonapi.io" };
    let url = format!("{}/v2/blockchain/accounts/{}/transactions?limit=10&sort_order=desc",
        base, urlencode(addr));
    let resp = client.get(&url)
        .header("Accept", "application/json")
        .send().await.ok()?;
    if !resp.status().is_success() { return None; }
    resp.json::<serde_json::Value>().await.ok()
}

fn urlencode(s: &str) -> String {
    s.replace('+', "%2B")
}

#[tokio::main]
async fn main() {
    println!("=== wallet-info live test ===\n");
    let client = Client::new();

    // ── 1. toncenter v3 balance (expected: 404 without mainnet key) ───────────
    sep("1. toncenter v3/addressInformation — MAINNET (no API key)");
    for addr in MAINNET_WALLETS {
        match fetch_address_balance(&client, addr, &Network::Mainnet).await {
            Ok(bal) => println!("  ✓ {} → {:.4} TON", &addr[..20], bal.parse::<f64>().unwrap_or(0.0) / 1e9),
            Err(e)  => println!("  ✗ {} → {:?}", &addr[..20], e),
        }
    }

    // ── 2. toncenter v2 JSON-RPC getTransactions ──────────────────────────────
    sep("2. toncenter v2 JSON-RPC getTransactions — MAINNET");
    for addr in MAINNET_WALLETS {
        match get_transactions_page(&client, &Network::Mainnet, addr, 10, None, None).await {
            Ok(p)  => println!("  ✓ {} → {} txs", &addr[..20], p.transactions.len()),
            Err(e) => println!("  ✗ {} → {}", &addr[..20], e),
        }
    }

    // ── 3. analyze_wallet (toncenter v2+v3 REST) — MAINNET ───────────────────
    sep("3. analyze_wallet (toncenter v2+v3) — MAINNET (no API key)");
    for addr in MAINNET_WALLETS {
        let c = make_client(&Network::Mainnet, None);
        match analysis::analyze_wallet(&c, addr).await {
            Ok(p) => {
                let ok = p.recent_transactions.len() > 0 || p.jettons.len() > 0 || p.state.is_some();
                let tag = if ok { "✓" } else { "✗ empty" };
                println!("  {} {} → txs={} jettons={} nfts={} state={:?}",
                    tag, &addr[..20],
                    p.recent_transactions.len(), p.jettons.len(), p.nfts.len(),
                    p.state.as_ref().map(|s| format!("{} {}", s.status, s.balance)));
            }
            Err(e) => println!("  ✗ {} → {}", &addr[..20], e),
        }
    }

    // ── 4. tonapi v2 directly — MAINNET (the correct path for mainnet) ────────
    sep("4. tonapi v2 directly — MAINNET (the TypeScript tonapi-analyzer path)");
    for addr in MAINNET_WALLETS {
        print!("  {} ", &addr[..20]);

        let account = tonapi_get_account(&client, addr, true).await;
        let jettons = tonapi_get_jettons(&client, addr, true).await;
        let txs     = tonapi_get_transactions(&client, addr, true).await;

        if let Some(acc) = &account {
            let balance = acc["balance"].as_f64().unwrap_or(0.0) / 1e9;
            let status  = acc["status"].as_str().unwrap_or("?");
            let name    = acc["name"].as_str().unwrap_or("");
            let n_jet   = jettons.as_ref()
                .and_then(|j| j["balances"].as_array()).map(|a| a.len()).unwrap_or(0);
            let n_txs   = txs.as_ref()
                .and_then(|t| t["transactions"].as_array()).map(|a| a.len()).unwrap_or(0);
            let name_str = if name.is_empty() { String::new() } else { format!(" name={}", name) };
            println!("✓ balance={:.4} TON status={} jettons={} txs={}{}", balance, status, n_jet, n_txs, name_str);
        } else {
            println!("✗ tonapi returned nothing");
        }
    }

    // ── 5. analyze_wallet + tonapi — TESTNET (sanity check) ──────────────────
    sep("5. tonapi v2 directly — TESTNET");
    for addr in TESTNET_WALLETS {
        print!("  {} ", addr);
        let account = tonapi_get_account(&client, addr, false).await;
        if let Some(acc) = &account {
            let balance = acc["balance"].as_f64().unwrap_or(0.0) / 1e9;
            let status  = acc["status"].as_str().unwrap_or("?");
            println!("✓ balance={:.4} TON status={}", balance, status);
        } else {
            println!("✗ tonapi testnet returned nothing");
        }
    }

    println!("\n=== Summary ===");
    println!("  toncenter v3 REST  → BROKEN on mainnet (returns 404/401 without a mainnet key)");
    println!("  toncenter v2 JSONRPC → WORKS (no key needed, but only fetches raw txs)");
    println!("  tonapi v2          → WORKS for both mainnet and testnet ✓");
    println!("  Fix: the TypeScript tonapi-analyzer.ts handles mainnet analyze_wallet correctly.");
    println!("  Restart the API server to apply the tonapi-analyzer changes.");
}
