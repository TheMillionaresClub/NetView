use serde::Serialize;

use crate::transactions::types::{ExtTransaction, RpcResponse};

pub mod types;

#[derive(Debug, Serialize)]
pub enum Action {
    Receive,
    Send,
}

#[derive(Debug, Serialize)]
pub struct Transaction {
    /// The other party — sender on Receive, recipient on Send.
    pub address:   String,
    pub action:    Action,
    pub amount:    u64,    // nanoTON
    pub timestamp: u64,    // unix
    pub fee:       u64,    // nanoTON
}

pub fn extract_transactions(rpc: &RpcResponse) -> Vec<Transaction> {
    extract_transactions_from_slice(&rpc.result)
}

pub fn extract_transactions_from_slice(ext_txs: &[ExtTransaction]) -> Vec<Transaction> {
    let mut txs = Vec::new();

    for ext_tx in ext_txs {
        let ts  = ext_tx.utime;
        let fee = ext_tx.fee;

        match &ext_tx.in_msg {
            // source is Some → another wallet sent us funds
            Some(msg) if msg.source.is_some() && msg.value > 0 => {
                txs.push(Transaction {
                    address:   msg.source.clone().unwrap(),
                    action:    Action::Receive,
                    amount:    msg.value,
                    timestamp: ts,
                    fee,
                });
            }

            // source is None → we signed an external message, pushed funds out
            Some(_) => {
                for out in &ext_tx.out_msgs {
                    if out.value > 0 {
                        txs.push(Transaction {
                            address:   out.destination.clone(),
                            action:    Action::Send,
                            amount:    out.value,
                            timestamp: ts,
                            fee,
                        });
                    }
                }
            }

            None => {} // no in_msg at all — skip (shouldn't occur in practice)
        }
    }

    txs
}
