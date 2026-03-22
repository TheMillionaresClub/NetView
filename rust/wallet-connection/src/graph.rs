use std::collections::HashMap;

use petgraph::graph::{DiGraph, NodeIndex};

use crate::types::{PathStep, TransactionEdge};

pub struct WalletGraph {
    graph: DiGraph<String, TransactionEdge>,
    node_map: HashMap<String, NodeIndex>,
}

impl WalletGraph {
    pub fn new() -> Self {
        Self {
            graph: DiGraph::new(),
            node_map: HashMap::new(),
        }
    }

    fn get_or_insert_node(&mut self, address: &str) -> NodeIndex {
        if let Some(&idx) = self.node_map.get(address) {
            idx
        } else {
            let idx = self.graph.add_node(address.to_string());
            self.node_map.insert(address.to_string(), idx);
            idx
        }
    }

    pub fn add_edge(&mut self, from: &str, to: &str, edge: TransactionEdge) {
        let from_idx = self.get_or_insert_node(from);
        let to_idx = self.get_or_insert_node(to);
        self.graph.add_edge(from_idx, to_idx, edge);
    }

    /// Look up the edge data between two addresses (first edge found).
    pub fn get_edge_data(&self, from: &str, to: &str) -> Option<&TransactionEdge> {
        let from_idx = self.node_map.get(from)?;
        let to_idx = self.node_map.get(to)?;
        self.graph
            .edges_connecting(*from_idx, *to_idx)
            .next()
            .map(|e| e.weight())
    }

    /// Reconstruct the full path from wallet_a to wallet_b given:
    /// - `visited_a`: parent map from side A (address -> parent_address)
    /// - `visited_b`: parent map from side B (address -> parent_address)
    /// - `meeting_point`: the address where both frontiers met
    ///
    /// Side A's chain: wallet_a -> ... -> meeting_point
    /// Side B's chain: meeting_point -> ... -> wallet_b
    pub fn reconstruct_path(
        &self,
        visited_a: &HashMap<String, String>,
        visited_b: &HashMap<String, String>,
        meeting_point: &str,
    ) -> Vec<PathStep> {
        // Build path from meeting_point back to wallet_a
        let mut path_a = Vec::new();
        let mut current = meeting_point.to_string();
        loop {
            let parent = match visited_a.get(&current) {
                Some(p) if !p.is_empty() => p.clone(),
                _ => break,
            };
            // Edge goes parent -> current
            let edge = self.get_edge_data(&parent, &current);
            path_a.push(PathStep {
                wallet: current.clone(),
                tx_hash: edge.map(|e| e.tx_hash.clone()).unwrap_or_default(),
                amount: edge.map(|e| e.amount).unwrap_or(0),
                lt: edge.map(|e| e.lt).unwrap_or(0),
            });
            current = parent;
        }
        // Add the start node (wallet_a)
        path_a.push(PathStep {
            wallet: current,
            tx_hash: String::new(),
            amount: 0,
            lt: 0,
        });
        path_a.reverse();

        // Build path from meeting_point forward to wallet_b
        let mut current = meeting_point.to_string();
        loop {
            let parent = match visited_b.get(&current) {
                Some(p) if !p.is_empty() => p.clone(),
                _ => break,
            };
            // Edge goes current -> parent (side B walks backwards from wallet_b)
            let edge = self.get_edge_data(&current, &parent);
            path_a.push(PathStep {
                wallet: parent.clone(),
                tx_hash: edge.map(|e| e.tx_hash.clone()).unwrap_or_default(),
                amount: edge.map(|e| e.amount).unwrap_or(0),
                lt: edge.map(|e| e.lt).unwrap_or(0),
            });
            current = parent;
        }

        path_a
    }
}
