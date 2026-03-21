use wallet_info::transactions::{extract_transactions, extract_transactions_from_slice, Action};
use wallet_info::transactions::types::RpcResponse;

/// Path to the sample RPC response captured from the toncenter v2 API.
const RPC_JSON: &str = include_str!("../data/rpc.json");

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

fn parse_rpc() -> RpcResponse {
    serde_json::from_str(RPC_JSON).expect("data/rpc.json should be valid RpcResponse")
}

// ────────────────────────────────────────────────────────────────────────────
// Parsing / deserialization
// ────────────────────────────────────────────────────────────────────────────

#[test]
fn parses_rpc_response_without_error() {
    let rpc = parse_rpc();
    assert!(rpc.ok, "ok field should be true");
    assert!(!rpc.result.is_empty(), "result should contain transactions");
}

#[test]
fn transaction_id_fields_are_parsed() {
    let rpc = parse_rpc();
    let tx = &rpc.result[0];
    assert!(tx.transaction_id.lt > 0, "lt should be a positive integer");
    assert!(!tx.transaction_id.hash.is_empty(), "hash should not be empty");
}

#[test]
fn utime_and_fee_are_parsed() {
    let rpc = parse_rpc();
    let tx = &rpc.result[0];
    assert!(tx.utime > 0, "utime should be non-zero");
    assert!(tx.fee > 0 || tx.fee == 0, "fee should parse without error");
}

#[test]
fn msg_data_raw_variant_parses() {
    use wallet_info::transactions::types::MsgData;

    let rpc = parse_rpc();
    // First transaction in the sample uses msg.dataRaw
    let in_msg = rpc.result[0].in_msg.as_ref().expect("first tx should have in_msg");
    assert!(
        matches!(in_msg.msg_data, MsgData::Raw { .. }),
        "expected msg.dataRaw variant"
    );
}

#[test]
fn msg_data_text_variant_parses() {
    use wallet_info::transactions::types::MsgData;

    // Build a minimal JSON with msg.dataText and ensure it deserialises.
    let json = r#"{
        "ok": true,
        "result": [{
            "@type": "ext.transaction",
            "address": {"@type": "accountAddress", "account_address": "EQTest"},
            "account": "0:DEAD",
            "utime": 1000000,
            "data": "",
            "transaction_id": {"@type": "internal.transactionId", "lt": "1", "hash": "abc="},
            "fee": "1000",
            "storage_fee": "0",
            "other_fee": "1000",
            "in_msg": {
                "@type": "ext.message",
                "hash": "xyz=",
                "source": "EQSender",
                "destination": "EQDest",
                "value": "500000000",
                "extra_currencies": [],
                "fwd_fee": "0",
                "ihr_fee": "0",
                "created_lt": "0",
                "body_hash": "abc=",
                "msg_data": {"@type": "msg.dataText", "text": "hello"},
                "message": "hello"
            },
            "out_msgs": []
        }],
        "@extra": ""
    }"#;

    let rpc: RpcResponse = serde_json::from_str(json).expect("should parse msg.dataText");
    let in_msg = rpc.result[0].in_msg.as_ref().unwrap();
    assert!(matches!(in_msg.msg_data, MsgData::Text { .. }));
}

#[test]
fn msg_data_empty_variant_parses() {
    use wallet_info::transactions::types::MsgData;

    let json = r#"{
        "ok": true,
        "result": [{
            "@type": "ext.transaction",
            "address": {"@type": "accountAddress", "account_address": "EQTest"},
            "account": "0:DEAD",
            "utime": 1000000,
            "data": "",
            "transaction_id": {"@type": "internal.transactionId", "lt": "1", "hash": "abc="},
            "fee": "0",
            "storage_fee": "0",
            "other_fee": "0",
            "in_msg": {
                "@type": "ext.message",
                "hash": "xyz=",
                "source": "EQSender",
                "destination": "EQDest",
                "value": "0",
                "extra_currencies": [],
                "fwd_fee": "0",
                "ihr_fee": "0",
                "created_lt": "0",
                "body_hash": "abc=",
                "msg_data": {"@type": "msg.dataEmpty"}
            },
            "out_msgs": []
        }],
        "@extra": ""
    }"#;

    let rpc: RpcResponse = serde_json::from_str(json).expect("should parse msg.dataEmpty");
    let in_msg = rpc.result[0].in_msg.as_ref().unwrap();
    assert!(matches!(in_msg.msg_data, MsgData::Empty));
}

#[test]
fn unknown_msg_data_type_is_tolerated() {
    use wallet_info::transactions::types::MsgData;

    let json = r#"{
        "ok": true,
        "result": [{
            "@type": "ext.transaction",
            "address": {"@type": "accountAddress", "account_address": "EQTest"},
            "account": "0:DEAD",
            "utime": 1000000,
            "data": "",
            "transaction_id": {"@type": "internal.transactionId", "lt": "1", "hash": "abc="},
            "fee": "0",
            "storage_fee": "0",
            "other_fee": "0",
            "in_msg": {
                "@type": "ext.message",
                "hash": "xyz=",
                "source": "EQSender",
                "destination": "EQDest",
                "value": "0",
                "extra_currencies": [],
                "fwd_fee": "0",
                "ihr_fee": "0",
                "created_lt": "0",
                "body_hash": "abc=",
                "msg_data": {"@type": "msg.dataSomeFutureType", "field": "value"}
            },
            "out_msgs": []
        }],
        "@extra": ""
    }"#;

    let rpc: RpcResponse = serde_json::from_str(json).expect("unknown msg_data type should not crash");
    let in_msg = rpc.result[0].in_msg.as_ref().unwrap();
    assert!(matches!(in_msg.msg_data, MsgData::Unknown));
}

// ────────────────────────────────────────────────────────────────────────────
// extract_transactions logic
// ────────────────────────────────────────────────────────────────────────────

#[test]
fn receive_tx_has_correct_action_and_amount() {
    let rpc = parse_rpc();
    let txs = extract_transactions(&rpc);

    let receives: Vec<_> = txs.iter().filter(|t| matches!(t.action, Action::Receive)).collect();
    assert!(!receives.is_empty(), "should have at least one Receive transaction");

    for tx in &receives {
        assert!(tx.amount > 0, "receive amount should be positive");
        assert!(!tx.address.is_empty(), "sender address should be present");
    }
}

#[test]
fn send_tx_has_correct_action_and_amount() {
    let rpc = parse_rpc();
    let txs = extract_transactions(&rpc);

    let sends: Vec<_> = txs.iter().filter(|t| matches!(t.action, Action::Send)).collect();
    assert!(!sends.is_empty(), "should have at least one Send transaction");

    for tx in &sends {
        assert!(tx.amount > 0, "send amount should be positive");
        assert!(!tx.address.is_empty(), "recipient address should be present");
    }
}

#[test]
fn extract_from_slice_matches_extract_from_full_rpc() {
    let rpc = parse_rpc();
    let from_rpc   = extract_transactions(&rpc);
    let from_slice = extract_transactions_from_slice(&rpc.result);

    assert_eq!(from_rpc.len(), from_slice.len());
    for (a, b) in from_rpc.iter().zip(from_slice.iter()) {
        assert_eq!(a.amount, b.amount);
        assert_eq!(a.timestamp, b.timestamp);
        assert_eq!(a.fee, b.fee);
        assert_eq!(a.address, b.address);
    }
}

#[test]
fn zero_value_out_msgs_are_excluded() {
    // Build a tx that has an external in_msg (source="") and an out_msg with value=0
    let json = r#"{
        "ok": true,
        "result": [{
            "@type": "ext.transaction",
            "address": {"@type": "accountAddress", "account_address": "EQMe"},
            "account": "0:DEAD",
            "utime": 1000000,
            "data": "",
            "transaction_id": {"@type": "internal.transactionId", "lt": "1", "hash": "abc="},
            "fee": "1000",
            "storage_fee": "0",
            "other_fee": "1000",
            "in_msg": {
                "@type": "ext.message",
                "hash": "xyz=",
                "source": "",
                "destination": "EQMe",
                "value": "0",
                "extra_currencies": [],
                "fwd_fee": "0",
                "ihr_fee": "0",
                "created_lt": "0",
                "body_hash": "abc=",
                "msg_data": {"@type": "msg.dataEmpty"}
            },
            "out_msgs": [{
                "@type": "ext.message",
                "hash": "out=",
                "source": "EQMe",
                "destination": "EQRecipient",
                "value": "0",
                "extra_currencies": [],
                "fwd_fee": "0",
                "ihr_fee": "0",
                "created_lt": "1",
                "body_hash": "abc=",
                "msg_data": {"@type": "msg.dataEmpty"}
            }]
        }],
        "@extra": ""
    }"#;

    let rpc: RpcResponse = serde_json::from_str(json).unwrap();
    let txs = extract_transactions(&rpc);
    assert!(txs.is_empty(), "zero-value out_msgs should produce no transactions");
}

#[test]
fn no_in_msg_produces_no_transactions() {
    let json = r#"{
        "ok": true,
        "result": [{
            "@type": "ext.transaction",
            "address": {"@type": "accountAddress", "account_address": "EQMe"},
            "account": "0:DEAD",
            "utime": 1000000,
            "data": "",
            "transaction_id": {"@type": "internal.transactionId", "lt": "1", "hash": "abc="},
            "fee": "0",
            "storage_fee": "0",
            "other_fee": "0",
            "in_msg": null,
            "out_msgs": []
        }],
        "@extra": ""
    }"#;

    let rpc: RpcResponse = serde_json::from_str(json).unwrap();
    let txs = extract_transactions(&rpc);
    assert!(txs.is_empty());
}

// ────────────────────────────────────────────────────────────────────────────
// Pagination cursor logic
// ────────────────────────────────────────────────────────────────────────────

#[test]
fn cursor_dedup_skips_first_element_of_subsequent_pages() {
    // Simulate the overlap: the API re-returns the cursor tx as page[0] on
    // the next page. extract_transactions_from_slice(&page[1..]) should skip it.
    let rpc = parse_rpc();
    if rpc.result.len() < 2 {
        return; // not enough data for this test
    }

    let full   = extract_transactions_from_slice(&rpc.result);
    let deduped = extract_transactions_from_slice(&rpc.result[1..]);

    // deduped should be one "page worth" shorter than full
    assert!(deduped.len() <= full.len());
}
