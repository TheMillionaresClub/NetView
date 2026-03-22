use std::collections::{BinaryHeap, HashMap, HashSet};
use std::rc::Rc;

use wasm_bindgen::prelude::*;

use crate::error::TonError;
use crate::graph::WalletGraph;
use crate::optimizer;
use crate::ton_client::TonApiClient;
use crate::types::{
    ConnectionPath, ScoredWallet, TimeWindow, TraversalConfig, TransactionEdge,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Side {
    A,
    B,
}

struct Frontier {
    visited: HashMap<String, String>,
    queue: BinaryHeap<ScoredWallet>,
}

impl Frontier {
    fn new(start: &str) -> Self {
        let mut visited = HashMap::new();
        visited.insert(start.to_string(), String::new());

        let mut queue = BinaryHeap::new();
        queue.push(ScoredWallet {
            address: start.to_string(),
            priority: 1.0,
            depth: 0,
        });

        Self { visited, queue }
    }
}

pub struct BidirectionalBFS {
    client: Rc<TonApiClient>,
    config: TraversalConfig,
}

/// Progress data sent to the JS callback after each node expansion.
fn make_progress(
    nodes_explored: usize,
    current_address: &str,
    queue_a: usize,
    queue_b: usize,
    visited_a: usize,
    visited_b: usize,
    elapsed_ms: f64,
    current_depth: u8,
) -> JsValue {
    let obj = js_sys::Object::new();
    let _ = js_sys::Reflect::set(&obj, &"nodes_explored".into(), &(nodes_explored as u32).into());
    let _ = js_sys::Reflect::set(&obj, &"current_address".into(), &current_address.into());
    let _ = js_sys::Reflect::set(&obj, &"queue_a".into(), &(queue_a as u32).into());
    let _ = js_sys::Reflect::set(&obj, &"queue_b".into(), &(queue_b as u32).into());
    let _ = js_sys::Reflect::set(&obj, &"visited_a".into(), &(visited_a as u32).into());
    let _ = js_sys::Reflect::set(&obj, &"visited_b".into(), &(visited_b as u32).into());
    let _ = js_sys::Reflect::set(&obj, &"elapsed_ms".into(), &(elapsed_ms as u32).into());
    let _ = js_sys::Reflect::set(&obj, &"depth".into(), &(current_depth as u32).into());
    obj.into()
}

impl BidirectionalBFS {
    pub fn new(client: Rc<TonApiClient>, config: TraversalConfig) -> Self {
        Self { client, config }
    }

    /// Main entry: find connection with optional progress callback.
    /// `on_progress` is called after each node expansion.
    /// If `on_progress` returns `false` (JS falsy), the search is cancelled.
    pub async fn find_connection(
        &self,
        wallet_a: &str,
        wallet_b: &str,
        on_progress: Option<&js_sys::Function>,
    ) -> Result<Option<ConnectionPath>, TonError> {
        let start_time = js_sys::Date::now();

        if wallet_a == wallet_b {
            return Ok(Some(ConnectionPath {
                found: true,
                path: vec![],
                depth: 0,
                nodes_explored: 0,
                elapsed_ms: 0,
            }));
        }

        let time_window = optimizer::compute_time_overlap(&self.client, wallet_a, wallet_b)
            .await
            .unwrap_or(None);

        let mut frontier_a = Frontier::new(wallet_a);
        let mut frontier_b = Frontier::new(wallet_b);
        let mut graph = WalletGraph::new();
        let mut nodes_explored: usize = 0;
        let mut skipped_high_degree: HashSet<String> = HashSet::new();

        loop {
            let elapsed = js_sys::Date::now() - start_time;
            if elapsed > 120_000.0 {
                return Err(TonError::Timeout);
            }

            if frontier_a.queue.is_empty() && frontier_b.queue.is_empty() {
                break;
            }

            let expand_a = match (frontier_a.queue.is_empty(), frontier_b.queue.is_empty()) {
                (true, _) => false,
                (_, true) => true,
                _ => frontier_a.queue.len() <= frontier_b.queue.len(),
            };

            let batch: Vec<ScoredWallet>;
            let active_side: Side;

            if expand_a {
                active_side = Side::A;
                let batch_size = self.config.batch_size.min(frontier_a.queue.len());
                batch = (0..batch_size)
                    .filter_map(|_| frontier_a.queue.pop())
                    .collect();
            } else {
                active_side = Side::B;
                let batch_size = self.config.batch_size.min(frontier_b.queue.len());
                batch = (0..batch_size)
                    .filter_map(|_| frontier_b.queue.pop())
                    .collect();
            }

            let batch_max_depth = batch.iter().map(|w| w.depth).max().unwrap_or(0);
            if batch_max_depth >= self.config.max_depth {
                continue;
            }

            for wallet in &batch {
                let elapsed = js_sys::Date::now() - start_time;
                if elapsed > 120_000.0 {
                    return Err(TonError::Timeout);
                }

                if skipped_high_degree.contains(&wallet.address) {
                    continue;
                }

                // Report progress and check for cancellation
                if let Some(cb) = on_progress {
                    let progress = make_progress(
                        nodes_explored,
                        &wallet.address,
                        frontier_a.queue.len(),
                        frontier_b.queue.len(),
                        frontier_a.visited.len(),
                        frontier_b.visited.len(),
                        elapsed,
                        wallet.depth,
                    );
                    let ret = cb.call1(&JsValue::NULL, &progress)
                        .unwrap_or(JsValue::TRUE);
                    // If callback returns false, cancel
                    if ret.is_falsy() {
                        return Ok(Some(ConnectionPath {
                            found: false,
                            path: vec![],
                            depth: wallet.depth,
                            nodes_explored,
                            elapsed_ms: elapsed as u64,
                        }));
                    }
                }

                let neighbors = match self
                    .expand_wallet(&wallet.address, &time_window)
                    .await
                {
                    Ok(Some(n)) => n,
                    Ok(None) => {
                        skipped_high_degree.insert(wallet.address.clone());
                        continue;
                    }
                    Err(TonError::Timeout) => return Err(TonError::Timeout),
                    Err(_) => continue,
                };

                nodes_explored += 1;
                let child_depth = wallet.depth + 1;

                for (counterpart, tx_hash, amount, lt) in neighbors {
                    let already_visited = match active_side {
                        Side::A => frontier_a.visited.contains_key(&counterpart),
                        Side::B => frontier_b.visited.contains_key(&counterpart),
                    };
                    if already_visited {
                        continue;
                    }

                    match active_side {
                        Side::A => {
                            graph.add_edge(
                                &wallet.address,
                                &counterpart,
                                TransactionEdge { lt, amount, tx_hash: tx_hash.clone() },
                            );
                            frontier_a
                                .visited
                                .insert(counterpart.clone(), wallet.address.clone());
                        }
                        Side::B => {
                            graph.add_edge(
                                &counterpart,
                                &wallet.address,
                                TransactionEdge { lt, amount, tx_hash: tx_hash.clone() },
                            );
                            frontier_b
                                .visited
                                .insert(counterpart.clone(), wallet.address.clone());
                        }
                    }

                    let intersection = match active_side {
                        Side::A => frontier_b.visited.contains_key(&counterpart),
                        Side::B => frontier_a.visited.contains_key(&counterpart),
                    };

                    if intersection {
                        let elapsed_ms = (js_sys::Date::now() - start_time) as u64;
                        let path = graph.reconstruct_path(
                            &frontier_a.visited,
                            &frontier_b.visited,
                            &counterpart,
                        );
                        return Ok(Some(ConnectionPath {
                            found: true,
                            path,
                            depth: child_depth,
                            nodes_explored,
                            elapsed_ms,
                        }));
                    }

                    let score = if time_window.is_some() {
                        optimizer::score_wallet(1, false)
                    } else {
                        1.0
                    };
                    if score > 0.0 {
                        match active_side {
                            Side::A => frontier_a.queue.push(ScoredWallet {
                                address: counterpart,
                                priority: score,
                                depth: child_depth,
                            }),
                            Side::B => frontier_b.queue.push(ScoredWallet {
                                address: counterpart,
                                priority: score,
                                depth: child_depth,
                            }),
                        }
                    }
                }
            }
        }

        let elapsed_ms = (js_sys::Date::now() - start_time) as u64;
        let max_depth_reached = frontier_a
            .visited
            .len()
            .max(frontier_b.visited.len()) as u8;
        Ok(Some(ConnectionPath {
            found: false,
            path: vec![],
            depth: max_depth_reached.min(self.config.max_depth),
            nodes_explored,
            elapsed_ms,
        }))
    }

    async fn expand_wallet(
        &self,
        address: &str,
        _time_window: &Option<TimeWindow>,
    ) -> Result<Option<Vec<(String, String, i64, u64)>>, TonError> {
        let degree = self.client.get_account_degree(address).await?;
        if degree > self.config.max_degree as u64 {
            return Ok(None);
        }

        let mut all_events = Vec::new();
        let mut before_lt: Option<u64> = None;
        let max_pages = 3;

        for _ in 0..max_pages {
            let events = self
                .client
                .get_account_events(address, before_lt, 100)
                .await?;
            if events.is_empty() {
                break;
            }
            let last_lt = events.last().map(|e| e.lt);
            all_events.extend(events);
            match last_lt {
                Some(lt) if lt > 0 => before_lt = Some(lt),
                _ => break,
            }
        }

        let counterparts = TonApiClient::extract_counterparts(&all_events, address);
        Ok(Some(counterparts))
    }
}
