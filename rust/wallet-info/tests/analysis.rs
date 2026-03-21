use wasm_bindgen_test::*;

use wallet_info::analysis::{
    self, ActorKind,
    api,
    client::TonAnalysisClient,
};
use wallet_info::network::Network;

wasm_bindgen_test_configure!(run_in_node_experimental);

/// A regular user wallet (is_wallet=true, seqno > 0).
const HUMAN_WALLET: &str = "0QD-F8oMBbR7p3SCMbGFQZOuxyNmu_-Kf9ilGmeSSC9IyFwz";

/// A smart contract address (is_wallet=false).
const CONTRACT_ADDR: &str = "kQDMo9xJIt6qMhYJg5luhIK18XkRJVKUPeOgrA0ORJoTgewC";

fn make_client() -> TonAnalysisClient {
    let api_key = option_env!("RPC_API_KEY").map(|s| s.to_string());
    analysis::make_client(&Network::Testnet, api_key)
}

// ── 1. Wallet state is active ─────────────────────────────────────────────────

#[wasm_bindgen_test]
async fn test_wallet_state_active() {
    let client = make_client();
    let states = api::get_wallet_states(&client, HUMAN_WALLET)
        .await
        .expect("get_wallet_states should succeed");

    assert!(!states.is_empty(), "expected at least one wallet state");
    assert_eq!(states[0].status, "active");
    assert!(states[0].is_wallet, "expected is_wallet=true for human wallet");
}

// ── 2. v2 wallet info has seqno for a real wallet ─────────────────────────────

#[wasm_bindgen_test]
async fn test_wallet_info_has_seqno() {
    let client = make_client();
    let info = api::get_wallet_information(&client, HUMAN_WALLET)
        .await
        .expect("get_wallet_information should succeed");

    assert!(
        info.seqno.is_some(),
        "expected seqno to be Some for an active wallet, got None"
    );
    assert!(info.seqno.unwrap() > 0, "seqno should be > 0");
}

// ── 3. Jettons returns a list (no panic) ──────────────────────────────────────

#[wasm_bindgen_test]
async fn test_jettons_returns_list() {
    let client = make_client();
    let jettons = api::get_jetton_wallets(&client, HUMAN_WALLET)
        .await
        .expect("get_jetton_wallets should not fail");
    let _ = jettons.len();
}

// ── 4. NFTs returns a list (no panic) ────────────────────────────────────────

#[wasm_bindgen_test]
async fn test_nfts_returns_list() {
    let client = make_client();
    let nfts = api::get_nft_items(&client, HUMAN_WALLET)
        .await
        .expect("get_nft_items should not fail");
    let _ = nfts.len();
}

// ── 5. Full profile for human wallet ─────────────────────────────────────────

#[wasm_bindgen_test]
async fn test_full_profile_human() {
    let client = make_client();
    let profile = analysis::analyze_wallet(&client, HUMAN_WALLET)
        .await
        .expect("analyze_wallet should succeed");

    assert_eq!(profile.address, HUMAN_WALLET);
    assert_eq!(
        profile.classification.kind,
        ActorKind::HumanWallet,
        "got {:?}. signals: {:?}",
        profile.classification.kind,
        profile.classification.signals,
    );
    assert!(profile.state.is_some(), "state should be populated");
    assert!(profile.info.is_some(), "info should be populated");
}

// ── 6. Smart contract is classified correctly ─────────────────────────────────

#[wasm_bindgen_test]
async fn test_smart_contract_classification() {
    let client = make_client();
    let profile = analysis::analyze_wallet(&client, CONTRACT_ADDR)
        .await
        .expect("analyze_wallet should succeed");

    assert_eq!(
        profile.classification.kind,
        ActorKind::SmartContract,
        "expected SmartContract for {CONTRACT_ADDR}, got {:?}",
        profile.classification.kind,
    );
    assert!(
        profile.classification.confidence >= 0.9,
        "expected high confidence for is_wallet=false signal"
    );
}

// ── 7. Smoke test — analyze_wallet returns Ok ─────────────────────────────────

#[wasm_bindgen_test]
async fn test_classification_smoke() {
    let client = make_client();
    let profile = analysis::analyze_wallet(&client, HUMAN_WALLET)
        .await
        .expect("analyze_wallet returned Err");

    assert!(!profile.address.is_empty());
    assert!(profile.classification.confidence > 0.0);
    assert!(!profile.classification.signals.is_empty());
}
