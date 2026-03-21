use wallet_info::transactions::types::RpcResponse;

fn main() {
    let data = include_str!("../data/rpc.json");
    
    let response: RpcResponse = serde_json::from_str(data).unwrap();
    println!("{}", serde_json::to_string_pretty(&response).unwrap());
}