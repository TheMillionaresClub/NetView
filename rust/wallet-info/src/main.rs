use wallet_info::transactions::{extract_transactions, types::RpcResponse};

fn main() {
    let data = include_str!("../data/rpc.json");
    
    let response: RpcResponse = serde_json::from_str(data).unwrap();
    let transactions = extract_transactions(&response);
    println!("{:#?}", transactions);
    
}