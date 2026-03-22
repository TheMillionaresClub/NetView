use ton_stats::models::GetTonStatsRequest;
use ton_stats::orchestrator::StatsBuilder;

#[tokio::main]
async fn main() {
    println!("=== TON Stats CLI Test ===\n");

    let tonapi_key = std::env::var("TONAPI_KEY").ok();
    if tonapi_key.is_some() {
        println!("[+] TONAPI_KEY found");
    } else {
        println!("[-] TONAPI_KEY not set (tonapi will use unauthenticated rate limits)");
    }

    let request = GetTonStatsRequest {
        tonapi_key,
        ..Default::default()
    };

    let builder = StatsBuilder::from_request(&request);
    println!("[*] Running {} sources...\n", builder.source_count());

    let response = builder.build_snapshot().await;

    println!("Sources used: {:?}", response.sources_used);
    println!("Sources failed: {:?}", response.sources_failed);
    println!("Fetched at: {} ms\n", response.fetched_at_ms);

    if let Some(net) = &response.snapshot.network {
        println!("=== Network ===");
        println!("  Latest block: #{}", net.latest_block_seqno);
        println!("  TPS estimate: {:.1}", net.tps_estimate);
        println!("  Validators: {}", net.validator_count);
        println!("  Total stake: {:.0} TON", net.total_validator_stake_ton);
        if let Some(accts) = net.total_accounts {
            println!("  Total accounts: {}", accts);
        }
        if let Some(txd) = net.transactions_per_day {
            println!("  Txs/day: {}", txd);
        }
        println!();
    }

    if let Some(market) = &response.snapshot.market {
        println!("=== Market ({}) ===", market.source);
        println!("  Price: ${:.4}", market.price_usd);
        println!("  Market cap: ${:.0}", market.market_cap_usd);
        println!("  24h volume: ${:.0}", market.volume_24h_usd);
        println!("  24h change: {:.2}%", market.price_change_24h_pct);
        println!();
    }

    println!("=== Blocks ({}) ===", response.snapshot.latest_blocks.len());
    for block in response.snapshot.latest_blocks.iter().take(5) {
        println!("  #{} — {} txs, {} shards", block.seqno, block.tx_count, block.shard_count);
    }
    println!();

    println!("=== Transactions ({}) ===", response.snapshot.latest_transactions.len());
    for tx in response.snapshot.latest_transactions.iter().take(5) {
        println!("  {} — {} -> {} ({} TON)", &tx.hash[..12], &tx.from.get(..12).unwrap_or(&tx.from), &tx.to.get(..12).unwrap_or(&tx.to), tx.amount_ton.unwrap_or(0.0));
    }
    println!();

    println!("=== Jettons ({}) ===", response.snapshot.new_jettons.len());
    for j in response.snapshot.new_jettons.iter().take(10) {
        println!("  {} ({}) — mintable: {}", j.name, j.symbol, j.mintable);
    }
    println!();

    if let Some(dex) = &response.snapshot.dex {
        println!("=== DEX Overview ===");
        println!("  Total TVL: ${:.0}", dex.total_tvl_usd);
        println!("  24h Volume: ${:.0}", dex.total_volume_24h_usd);
        for ex in &dex.exchanges {
            println!("  {} — TVL: ${:.0}, Vol: ${:.0}, Pools: {}", ex.name, ex.tvl_usd, ex.volume_24h_usd, ex.pool_count);
        }
        println!("\n  Top pools:");
        for pool in dex.top_pools.iter().take(5) {
            println!("    {}/{} ({}) — TVL: ${:.0}", pool.token0_symbol, pool.token1_symbol, pool.dex, pool.tvl_usd);
        }
    }

    // Also output raw JSON for inspection
    let json = serde_json::to_string_pretty(&response).unwrap();
    let path = "ton_stats_output.json";
    std::fs::write(path, &json).ok();
    println!("\n[*] Full JSON output written to {}", path);
}
