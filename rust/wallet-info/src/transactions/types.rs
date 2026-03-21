use serde::{Deserialize, Deserializer, Serialize, Serializer};
use serde_json::Value;
use std::ops::Deref;

use crate::decoder::smart_decode;

// ═══════════════════════════════════════════════════════════════════
// DecodedBoc — transparent Value newtype, deserialized from a BOC string
// ═══════════════════════════════════════════════════════════════════

/// A field that arrives over the wire as a base64-encoded BOC string
/// but is stored (and serialized) as a decoded [`Value`].
///
/// Deserialization fails immediately if the BOC cannot be parsed,
/// propagating the error through serde as normal.
#[derive(Debug, Clone)]
pub struct DecodedBoc(pub Value);

impl Deref for DecodedBoc {
    type Target = Value;
    fn deref(&self) -> &Value { &self.0 }
}

impl<'de> Deserialize<'de> for DecodedBoc {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        let raw = String::deserialize(d)?;
        let value = smart_decode(&raw).map_err(serde::de::Error::custom)?;
        Ok(DecodedBoc(value))
    }
}

impl Serialize for DecodedBoc {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        self.0.serialize(s)
    }
}

// ═══════════════════════════════════════════════════════════════════
// Private serde helpers
// ═══════════════════════════════════════════════════════════════════

fn de_str_u64<'de, D: Deserializer<'de>>(d: D) -> Result<u64, D::Error> {
    String::deserialize(d)?
        .parse::<u64>()
        .map_err(serde::de::Error::custom)
}

fn de_optional_address<'de, D: Deserializer<'de>>(
    d: D,
) -> Result<Option<String>, D::Error> {
    let s = String::deserialize(d)?;
    Ok(if s.is_empty() { None } else { Some(s) })
}

// ═══════════════════════════════════════════════════════════════════
// Top-level RPC envelope
// ═══════════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize, Serialize)]
pub struct RpcResponse {
    pub ok:     bool,
    pub result: Vec<ExtTransaction>,
    #[serde(rename = "@extra")]
    pub extra: String,
}

// ═══════════════════════════════════════════════════════════════════
// Transaction
// ═══════════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize, Serialize)]
pub struct ExtTransaction {
    pub address:        AccountAddress,
    pub account:        String,
    pub utime:          u64,
    /// Decoded transaction cell — was a base64 BOC string on the wire.
    pub data:           DecodedBoc,
    pub transaction_id: TransactionId,
    #[serde(deserialize_with = "de_str_u64")]
    pub fee:            u64,
    #[serde(deserialize_with = "de_str_u64")]
    pub storage_fee:    u64,
    #[serde(deserialize_with = "de_str_u64")]
    pub other_fee:      u64,
    pub in_msg:         Option<ExtMessage>,
    pub out_msgs:       Vec<ExtMessage>,
}

// ═══════════════════════════════════════════════════════════════════
// Nested identity types
// ═══════════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize, Serialize)]
pub struct AccountAddress {
    pub account_address: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct TransactionId {
    #[serde(deserialize_with = "de_str_u64")]
    pub lt:   u64,
    pub hash: String,
}

// ═══════════════════════════════════════════════════════════════════
// Message
// ═══════════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize, Serialize)]
pub struct ExtMessage {
    pub hash:            String,
    #[serde(deserialize_with = "de_optional_address")]
    pub source:          Option<String>,
    pub destination:     String,
    #[serde(deserialize_with = "de_str_u64")]
    pub value:           u64,
    pub extra_currencies: Vec<Value>,
    #[serde(deserialize_with = "de_str_u64")]
    pub fwd_fee:         u64,
    #[serde(deserialize_with = "de_str_u64")]
    pub ihr_fee:         u64,
    #[serde(deserialize_with = "de_str_u64")]
    pub created_lt:      u64,
    pub body_hash:       String,
    pub msg_data:        MsgData,
    #[serde(default)]
    pub message:         Option<String>,
}

// ═══════════════════════════════════════════════════════════════════
// Message data
// ═══════════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize, Serialize)]
#[serde(tag = "@type")]
pub enum MsgData {
    /// `msg.dataRaw` — body BOC decoded automatically; fails if unparseable.
    #[serde(rename = "msg.dataRaw")]
    Raw {
        /// Decoded message body cell — was a base64 BOC string on the wire.
        body:       DecodedBoc,
        init_state: String,
    },
}

impl MsgData {
    pub fn body(&self) -> &DecodedBoc {
        match self {
            MsgData::Raw { body, .. } => body,
        }
    }
}
