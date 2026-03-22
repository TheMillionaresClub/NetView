use base64::{engine::general_purpose, Engine as _};
use chrono::{TimeZone, Utc};
use serde_json::{json, Value};

// ═══════════════════════════════════════════════════════════════════
// Error
// ═══════════════════════════════════════════════════════════════════

#[derive(Debug, thiserror::Error)]
pub enum TonError {
    #[error("base64 decode: {0}")]
    Base64(#[from] base64::DecodeError),

    #[error("hex decode: {0}")]
    Hex(#[from] hex::FromHexError),

    #[error("invalid address length {got}: expected 36 bytes")]
    InvalidAddressLength { got: usize },

    #[error("bad BOC magic: expected b5ee9c72, got {0}")]
    BadBocMagic(String),

    #[error("read overrun: requested {requested} bits but only {available} remain")]
    OutOfBits { requested: usize, available: usize },

    #[error("cell ref index {0} not yet built")]
    UnbuiltCellRef(usize),

    #[error("empty BOC: no root cells")]
    EmptyBoc,

    #[error("unsupported address tag {0}")]
    UnsupportedAddressTag(u64),
}

// ═══════════════════════════════════════════════════════════════════
// CRC-16/CCITT (poly=0x1021)
// ═══════════════════════════════════════════════════════════════════

fn crc_hqx(data: &[u8], mut crc: u16) -> u16 {
    for &byte in data {
        crc ^= (byte as u16) << 8;
        for _ in 0..8 {
            crc = if crc & 0x8000 != 0 { (crc << 1) ^ 0x1021 } else { crc << 1 };
        }
    }
    crc
}

// ═══════════════════════════════════════════════════════════════════
// TON Address
// ═══════════════════════════════════════════════════════════════════

pub fn decode_ton_address(address_b64: &str) -> Result<Value, TonError> {
    let normalized = address_b64.replace('-', "+").replace('_', "/");
    let padding = match normalized.len() % 4 {
        0 => String::new(),
        n => "=".repeat(4 - n),
    };
    let raw_bytes = general_purpose::STANDARD.decode(format!("{normalized}{padding}"))?;

    if raw_bytes.len() != 36 {
        return Err(TonError::InvalidAddressLength { got: raw_bytes.len() });
    }

    let flags      = raw_bytes[0];
    let workchain  = raw_bytes[1] as i8;
    let account_id = hex::encode(&raw_bytes[2..34]);

    Ok(json!({
        "bounceable":     (flags & 0x11) != 0,
        "testnet":        (flags & 0x80) != 0,
        "workchain":      workchain,
        "account_id_hex": account_id,
        "raw_form":       format!("{workchain}:{account_id}"),
    }))
}

/// Normalize any user-friendly TON address to its canonical bounceable form.
/// Non-bounceable (0Q…), bounceable (EQ…), and their testnet variants are all
/// accepted. Returns the input unchanged if parsing fails so callers never
/// lose an address due to an unexpected format.
pub fn normalize_address(addr: &str) -> String {
    let normalized = addr.replace('-', "+").replace('_', "/");
    let padding = match normalized.len() % 4 {
        0 => String::new(),
        n => "=".repeat(4 - n),
    };
    let Ok(raw_bytes) = general_purpose::STANDARD.decode(format!("{normalized}{padding}")) else {
        return addr.to_string();
    };
    if raw_bytes.len() != 36 {
        return addr.to_string();
    }
    let workchain = raw_bytes[1] as i8 as i32;
    let account   = hex::encode(&raw_bytes[2..34]);
    // Always emit mainnet bounceable (EQ…) — the testnet flag is just a wallet
    // hint, the on-chain account is the same regardless of the flag.
    raw_to_friendly(workchain, &account, true, false).unwrap_or_else(|_| addr.to_string())
}

pub fn raw_to_friendly(
    workchain: i32,
    account_hex: &str,
    bounceable: bool,
    testnet: bool,
) -> Result<String, TonError> {
    let mut tag: u8 = if bounceable { 0x11 } else { 0x51 };
    if testnet { tag |= 0x80; }

    let mut addr_bytes: Vec<u8> = vec![tag, workchain as i8 as u8];
    addr_bytes.extend_from_slice(&hex::decode(account_hex)?);

    let crc = crc_hqx(&addr_bytes, 0);
    addr_bytes.push((crc >> 8) as u8);
    addr_bytes.push((crc & 0xff) as u8);

    Ok(general_purpose::URL_SAFE_NO_PAD.encode(&addr_bytes))
}

// ═══════════════════════════════════════════════════════════════════
// BitReader
// ═══════════════════════════════════════════════════════════════════

pub struct BitReader {
    data:    Vec<u8>,
    bit_pos: usize,
}

impl BitReader {
    pub fn new(data: &[u8]) -> Self {
        Self { data: data.to_vec(), bit_pos: 0 }
    }

    pub fn bits_left(&self) -> usize {
        self.data.len() * 8 - self.bit_pos
    }

    // Only call after validating capacity with bits_left()
    fn read_bit_unchecked(&mut self) -> u8 {
        let byte_idx = self.bit_pos / 8;
        let bit_idx  = 7 - (self.bit_pos % 8);
        self.bit_pos += 1;
        (self.data[byte_idx] >> bit_idx) & 1
    }

    pub fn read_bit(&mut self) -> Result<u8, TonError> {
        if self.bits_left() < 1 {
            return Err(TonError::OutOfBits { requested: 1, available: 0 });
        }
        Ok(self.read_bit_unchecked())
    }

    pub fn read_bits(&mut self, n: usize) -> Result<u64, TonError> {
        let avail = self.bits_left();
        if n > avail {
            return Err(TonError::OutOfBits { requested: n, available: avail });
        }
        let mut val = 0u64;
        for _ in 0..n {
            val = (val << 1) | self.read_bit_unchecked() as u64;
        }
        Ok(val)
    }

    pub fn read_bytes(&mut self, n: usize) -> Result<Vec<u8>, TonError> {
        let avail = self.bits_left();
        if n * 8 > avail {
            return Err(TonError::OutOfBits { requested: n * 8, available: avail });
        }
        Ok((0..n)
            .map(|_| {
                let mut byte = 0u8;
                for _ in 0..8 {
                    byte = (byte << 1) | self.read_bit_unchecked();
                }
                byte
            })
            .collect())
    }

    pub fn read_uint(&mut self, bits: usize) -> Result<u64, TonError> {
        self.read_bits(bits)
    }

    pub fn read_int(&mut self, bits: usize) -> Result<i64, TonError> {
        let val = self.read_bits(bits)? as i64;
        Ok(if val >= (1i64 << (bits - 1)) { val - (1i64 << bits) } else { val })
    }

    pub fn read_coins(&mut self) -> Result<u64, TonError> {
        let byte_len = self.read_bits(4)? as usize;
        if byte_len == 0 { return Ok(0); }
        self.read_bits(byte_len * 8)
    }

    pub fn read_address(&mut self) -> Result<Option<String>, TonError> {
        match self.read_bits(2)? {
            0 => Ok(None),
            2 => {
                if self.read_bit()? != 0 {
                    self.read_bits(5 + 256)?; // skip anycast
                }
                let wc      = self.read_int(8)? as i32;
                let account = self.read_bytes(32)?;
                Ok(Some(raw_to_friendly(wc, &hex::encode(&account), true, false)?))
            }
            tag => Err(TonError::UnsupportedAddressTag(tag)),
        }
    }
}

// ═══════════════════════════════════════════════════════════════════
// Cell
// ═══════════════════════════════════════════════════════════════════

#[derive(Clone)]
pub struct Cell {
    pub data:      Vec<u8>,
    pub data_bits: usize,
    pub refs:      Vec<Cell>,
}

impl Cell {
    pub fn reader(&self) -> BitReader {
        BitReader::new(&self.data)
    }
}

// ═══════════════════════════════════════════════════════════════════
// BOC Deserializer
// ═══════════════════════════════════════════════════════════════════

pub fn deserialize_boc(boc_b64: &str) -> Result<Vec<Cell>, TonError> {
    let raw = general_purpose::STANDARD.decode(boc_b64)?;
    let mut r = BitReader::new(&raw);

    let magic = r.read_bytes(4)?;
    if magic != [0xb5, 0xee, 0x9c, 0x72] {
        return Err(TonError::BadBocMagic(hex::encode(&magic)));
    }

    let flags_byte = r.read_uint(8)?;
    let has_idx    = (flags_byte & 0x80) != 0;
    let _has_crc   = (flags_byte & 0x40) != 0;
    let ref_size   = (flags_byte & 0x07) as usize;

    let off_bytes  = r.read_uint(8)? as usize;
    let cell_count = r.read_uint(ref_size * 8)? as usize;
    let root_count = r.read_uint(ref_size * 8)? as usize;
    let _absent    = r.read_uint(ref_size * 8)?;
    let _total_len = r.read_uint(off_bytes * 8)?;

    let root_indices: Vec<usize> = (0..root_count)
        .map(|_| r.read_uint(ref_size * 8).map(|v| v as usize))
        .collect::<Result<_, _>>()?;

    if has_idx {
        for _ in 0..cell_count { r.read_uint(off_bytes * 8)?; }
    }

    let mut cells_raw: Vec<(Vec<u8>, usize, Vec<usize>)> = Vec::with_capacity(cell_count);
    for _ in 0..cell_count {
        let d1 = r.read_uint(8)? as u8;
        let d2 = r.read_uint(8)? as u8;
        let ref_cnt          = (d1 & 7) as usize;
        let data_bytes_count = ((d2 as usize) + 1) / 2;
        let is_complete      = (d2 & 1) == 0;

        let data = r.read_bytes(data_bytes_count)?;

        let data_bits = if !is_complete && data_bytes_count > 0 {
            let last  = *data.last().unwrap();
            let trail = (0..8).find(|&i| (last >> i) & 1 != 0).unwrap_or(0);
            data_bytes_count * 8 - trail - 1
        } else if is_complete {
            (d2 as usize >> 1) * 8
        } else {
            0
        };

        let ref_indices: Vec<usize> = (0..ref_cnt)
            .map(|_| r.read_uint(ref_size * 8).map(|v| v as usize))
            .collect::<Result<_, _>>()?;

        cells_raw.push((data, data_bits, ref_indices));
    }

    // Build bottom-up: refs always have higher indices in BOC
    let n = cells_raw.len();
    let mut cells: Vec<Option<Cell>> = (0..n).map(|_| None).collect();
    for i in (0..n).rev() {
        let (data, data_bits, ref_indices) = &cells_raw[i];
        let refs = ref_indices
            .iter()
            .map(|&ri| cells[ri].clone().ok_or(TonError::UnbuiltCellRef(ri)))
            .collect::<Result<Vec<_>, _>>()?;
        cells[i] = Some(Cell { data: data.clone(), data_bits: *data_bits, refs });
    }

    root_indices
        .iter()
        .map(|&ri| cells[ri].clone().ok_or(TonError::UnbuiltCellRef(ri)))
        .collect()
}

// ═══════════════════════════════════════════════════════════════════
// Transaction Decoder
// ═══════════════════════════════════════════════════════════════════

fn nano_to_ton(nano: u64) -> String {
    format!("{:.9}", nano as f64 / 1_000_000_000.0)
}

/// All structural fields propagate errors.
/// Body/comment from refs is best-effort — it's optional metadata.
pub fn decode_message(cell: &Cell) -> Result<Value, TonError> {
    let mut r   = cell.reader();
    let mut msg = serde_json::Map::new();

    let tag = r.read_bit()?;
    if tag == 0 {
        // int_msg_info$0
        let _ihr    = r.read_bit()?;
        let bounce  = r.read_bit()?;
        let bounced = r.read_bit()?;
        let src     = r.read_address()?;
        let dst     = r.read_address()?;
        let value   = r.read_coins()?;

        msg.insert("type".into(),       json!("internal"));
        msg.insert("bounce".into(),     json!(bounce  != 0));
        msg.insert("bounced".into(),    json!(bounced != 0));
        msg.insert("src".into(),        json!(src));
        msg.insert("dst".into(),        json!(dst));
        msg.insert("value_nano".into(), json!(value));
        msg.insert("value_ton".into(),  json!(nano_to_ton(value)));
    } else {
        let sub = r.read_bit()?;
        let src = r.read_address()?;
        let dst = r.read_address()?;
        if sub == 0 {
            // ext_in_msg_info$10
            let _fee = r.read_coins()?;
            msg.insert("type".into(), json!("external_in"));
        } else {
            // ext_out_msg_info$11
            let _lt = r.read_uint(64)?;
            let _at = r.read_uint(32)?;
            msg.insert("type".into(), json!("external_out"));
        }
        msg.insert("src".into(), json!(src));
        msg.insert("dst".into(), json!(dst));
    }

    // Best-effort: body comment from first ref
    if let Some(body) = cell.refs.first() {
        let mut br = body.reader();
        if let Ok(op) = br.read_uint(32) {
            if op == 0 {
                let remaining = br.bits_left() / 8;
                if let Ok(bytes) = br.read_bytes(remaining) {
                    match String::from_utf8(bytes.clone()) {
                        Ok(s)  => { msg.insert("comment".into(),  json!(s.trim_end_matches('\0'))); }
                        Err(_) => { msg.insert("body_hex".into(), json!(hex::encode(&bytes))); }
                    }
                }
            } else {
                msg.insert("op".into(), json!(format!("0x{op:08x}")));
            }
        }
    }

    Ok(Value::Object(msg))
}

/// Core transaction fields propagate errors.
/// Ref walking for messages is best-effort — a broken ref doesn't
/// invalidate the rest of the transaction.
pub fn decode_transaction(root: &Cell) -> Result<Value, TonError> {
    let mut r = root.reader();

    let tag         = r.read_bits(4)?;
    let acct_bytes  = r.read_bytes(32)?;
    let account_hex = hex::encode(&acct_bytes);
    let lt          = r.read_uint(64)?;
    let prev_hash   = hex::encode(r.read_bytes(32)?);
    let prev_lt     = r.read_uint(64)?;
    let now         = r.read_uint(32)?;
    let outmsg_cnt  = r.read_uint(15)?;

    let time_iso = Utc
        .timestamp_opt(now as i64, 0)
        .single()
        .map(|dt| dt.to_rfc3339())
        .unwrap_or_default();

    let orig_status = r.read_bits(2)?;
    let end_status  = r.read_bits(2)?;
    let status_name = |s: u64| match s {
        0 => "uninit", 1 => "frozen", 2 => "active", _ => "nonexist",
    };

    let mut in_msg: Option<Value> = None;
    let mut out_msgs: Vec<Value>  = Vec::new();

    for ref_cell in &root.refs {
        if let Ok(msg) = decode_message(ref_cell) {
            if in_msg.is_none() { in_msg = Some(msg); } else { out_msgs.push(msg); }
        }
        for sub in &ref_cell.refs {
            if let Ok(msg) = decode_message(sub) { out_msgs.push(msg); }
        }
    }

    Ok(json!({
        "_tag":             format!("0b{tag:04b}"),
        "account":          format!("0:{account_hex}"),
        "account_friendly": raw_to_friendly(0, &account_hex, true, false)?,
        "lt":               lt,
        "time":             now,
        "time_iso":         time_iso,
        "prev_tx_hash":     prev_hash,
        "prev_tx_lt":       prev_lt,
        "outmsg_cnt":       outmsg_cnt,
        "orig_status":      status_name(orig_status),
        "end_status":       status_name(end_status),
        "in_msg":           in_msg,
        "out_msgs":         out_msgs,
    }))
}

pub fn decode_boc(boc_b64: &str) -> Result<Value, TonError> {
    let roots = deserialize_boc(boc_b64)?;
    if roots.is_empty() { return Err(TonError::EmptyBoc); }

    let root = &roots[0];
    let tag  = root.reader().read_bits(4)?;

    if tag == 0b0111 {
        decode_transaction(root)
    } else {
        Ok(json!({
            "type":     "unknown_cell",
            "tag_bits": format!("0b{tag:04b}"),
            "data_hex": hex::encode(&root.data),
            "num_refs": root.refs.len(),
        }))
    }
}

pub fn smart_decode(input: &str) -> Result<Value, TonError> {
    let cleaned = input.trim();
    if (46..=48).contains(&cleaned.len()) {
        let mut v = decode_ton_address(cleaned)?;
        if let Some(obj) = v.as_object_mut() {
            obj.insert("type".into(), json!("address"));
        }
        return Ok(v);
    }
    let mut v = decode_boc(cleaned)?;
    if let Some(obj) = v.as_object_mut() {
        obj.insert("type".into(), json!("boc_transaction"));
    }
    Ok(v)
}