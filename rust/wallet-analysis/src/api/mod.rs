pub mod v2;
pub mod v3;

pub use v2::get_wallet_information;
pub use v3::{
    get_dns_records, get_jetton_wallets, get_nft_items, get_transactions_page, get_wallet_states,
};
