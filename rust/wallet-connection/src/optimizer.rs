use crate::ton_client::TonApiClient;
use crate::types::TimeWindow;
use crate::error::TonError;

/// Fetch both wallets' timestamp ranges in parallel and compute their overlap.
/// Returns `None` if there is no temporal overlap.
pub async fn compute_time_overlap(
    client: &TonApiClient,
    wallet_a: &str,
    wallet_b: &str,
) -> Result<Option<TimeWindow>, TonError> {
    let (ts_a, ts_b) = futures::future::join(
        client.get_account_timestamps(wallet_a),
        client.get_account_timestamps(wallet_b),
    )
    .await;

    let (min_a, max_a) = ts_a?;
    let (min_b, max_b) = ts_b?;

    // Either wallet has no activity
    if (min_a == 0 && max_a == 0) || (min_b == 0 && max_b == 0) {
        return Ok(None);
    }

    let overlap_min = min_a.max(min_b);
    let overlap_max = max_a.min(max_b);

    if overlap_min <= overlap_max {
        Ok(Some(TimeWindow {
            min_ts: overlap_min,
            max_ts: overlap_max,
        }))
    } else {
        Ok(None)
    }
}

/// Score a wallet for frontier priority.
/// - High-degree wallets (exchanges) get 0.0 → skipped entirely.
/// - Normal wallets get `tx_count_in_window` as priority.
/// - Zero-event wallets get 0.001 (deprioritized but reachable).
pub fn score_wallet(tx_count_in_window: usize, is_high_degree: bool) -> f64 {
    if is_high_degree {
        return 0.0;
    }
    if tx_count_in_window == 0 {
        return 0.001;
    }
    tx_count_in_window as f64
}
