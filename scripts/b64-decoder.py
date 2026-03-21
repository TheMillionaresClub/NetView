import base64
import struct
import hashlib
import binascii
import sys
from datetime import datetime, timezone


# ═══════════════════════════════════════════════════════════════════
# TON Address Decoder
# ═══════════════════════════════════════════════════════════════════

def decode_ton_address(address_b64: str) -> dict:
    address_b64 = address_b64.replace('-', '+').replace('_', '/')
    missing_padding = len(address_b64) % 4
    if missing_padding:
        address_b64 += '=' * (4 - missing_padding)

    raw_bytes = base64.b64decode(address_b64)

    if len(raw_bytes) != 36:
        return {"error": f"Invalid length {len(raw_bytes)}: TON addresses must be 36 bytes."}

    flags = raw_bytes[0]
    workchain = struct.unpack('b', raw_bytes[1:2])[0]
    account_id = raw_bytes[2:34].hex()

    return {
        "bounceable": bool(flags & 0x11),
        "testnet": bool(flags & 0x80),
        "workchain": workchain,
        "account_id_hex": account_id,
        "raw_form": f"{workchain}:{account_id}",
    }


def raw_to_friendly(workchain: int, account_hex: str, bounceable=True, testnet=False) -> str:
    """Convert raw address to user-friendly base64url form."""
    tag = 0x11 if bounceable else 0x51
    if testnet:
        tag |= 0x80
    addr_bytes = bytes([tag]) + struct.pack('b', workchain) + bytes.fromhex(account_hex)
    crc = binascii.crc_hqx(addr_bytes, 0).to_bytes(2, 'big')
    return base64.urlsafe_b64encode(addr_bytes + crc).decode().rstrip('=')


# ═══════════════════════════════════════════════════════════════════
# TL-B / Cell bit-reader helpers
# ═══════════════════════════════════════════════════════════════════

class BitReader:
    """Read bits from a byte buffer."""

    def __init__(self, data: bytes):
        self.data = data
        self.bit_pos = 0

    @property
    def bits_left(self):
        return len(self.data) * 8 - self.bit_pos

    def read_bit(self) -> int:
        byte_idx = self.bit_pos // 8
        bit_idx = 7 - (self.bit_pos % 8)
        self.bit_pos += 1
        return (self.data[byte_idx] >> bit_idx) & 1

    def read_bits(self, n: int) -> int:
        val = 0
        for _ in range(n):
            val = (val << 1) | self.read_bit()
        return val

    def read_bytes(self, n: int) -> bytes:
        out = []
        for _ in range(n):
            out.append(self.read_bits(8))
        return bytes(out)

    def read_uint(self, bits: int) -> int:
        return self.read_bits(bits)

    def read_int(self, bits: int) -> int:
        val = self.read_bits(bits)
        if val >= (1 << (bits - 1)):
            val -= 1 << bits
        return val

    def read_coins(self) -> int:
        """Read VarUInteger 16 (Grams/nanoTON)."""
        byte_len = self.read_bits(4)
        if byte_len == 0:
            return 0
        return self.read_bits(byte_len * 8)

    def read_address(self) -> str | None:
        """Read MsgAddressInt (addr_std$10 or addr_none$00)."""
        tag = self.read_bits(2)
        if tag == 0:  # addr_none
            return None
        if tag == 2:  # addr_std
            _anycast = self.read_bit()
            if _anycast:
                self.read_bits(5 + 256)  # skip anycast
            wc = self.read_int(8)
            account = self.read_bytes(32).hex()
            return raw_to_friendly(wc, account)
        # addr_extern or addr_var — skip
        return f"<unsupported addr tag={tag}>"


# ═══════════════════════════════════════════════════════════════════
# BOC (Bag of Cells) Deserializer
# ═══════════════════════════════════════════════════════════════════

class Cell:
    def __init__(self, data: bytes, data_bits: int, refs: list):
        self.data = data
        self.data_bits = data_bits
        self.refs = refs  # list of Cell

    def reader(self) -> BitReader:
        return BitReader(self.data)


def deserialize_boc(boc_b64: str) -> list[Cell]:
    """Deserialize a base64-encoded BOC into a list of cells."""
    raw = base64.b64decode(boc_b64)
    r = BitReader(raw)

    # Magic
    magic = r.read_bytes(4)
    if magic != b'\xb5\xee\x9c\x72':
        raise ValueError(f"Bad BOC magic: {magic.hex()}")

    flags_byte = r.read_uint(8)
    has_idx = bool(flags_byte & 0x80)
    has_crc32c = bool(flags_byte & 0x40)
    has_cache_bits = bool(flags_byte & 0x20)
    ref_size = flags_byte & 0x07

    # sizes
    off_bytes = r.read_uint(8)
    cell_count = r.read_uint(ref_size * 8)
    root_count = r.read_uint(ref_size * 8)
    _absent = r.read_uint(ref_size * 8)
    total_data_len = r.read_uint(off_bytes * 8)

    # root indices
    root_indices = [r.read_uint(ref_size * 8) for _ in range(root_count)]

    # cell index (offsets)
    if has_idx:
        for _ in range(cell_count):
            r.read_uint(off_bytes * 8)

    # parse cells
    cells_raw = []
    for _ in range(cell_count):
        d1 = r.read_uint(8)
        d2 = r.read_uint(8)
        ref_cnt = d1 & 7
        is_exotic = bool(d1 & 8)
        level = (d1 >> 5) & 3
        data_bytes_count = (d2 + 1) // 2
        is_complete = not (d2 & 1)

        data = r.read_bytes(data_bytes_count)
        data_bits = d2 >> 1 if is_complete else d2 >> 1  # approximate

        # For incomplete cells, compute actual bit length
        if not is_complete and data_bytes_count > 0:
            # Find last 1-bit (padding marker)
            last = data[-1]
            trail = 0
            for i in range(8):
                if (last >> i) & 1:
                    trail = i
                    break
            data_bits = data_bytes_count * 8 - trail - 1
        else:
            data_bits = (d2 >> 1) * 8 if is_complete else data_bytes_count * 8

        ref_indices = [r.read_uint(ref_size * 8) for _ in range(ref_cnt)]
        cells_raw.append((data, data_bits, ref_indices))

    # CRC32C check (skip)
    if has_crc32c:
        pass  # 4 bytes at end

    # Build cell objects
    cells = [Cell(d, db, []) for d, db, _ in cells_raw]
    for i, (_, _, ref_indices) in enumerate(cells_raw):
        cells[i].refs = [cells[ri] for ri in ref_indices]

    return [cells[ri] for ri in root_indices]


# ═══════════════════════════════════════════════════════════════════
# Transaction Decoder
# ═══════════════════════════════════════════════════════════════════

def nano_to_ton(nano: int) -> str:
    return f"{nano / 1e9:.9f}"


def decode_message(cell: Cell) -> dict:
    """Decode a CommonMsgInfo from a message cell."""
    r = cell.reader()
    msg = {}

    tag = r.read_bit()
    if tag == 0:
        # int_msg_info$0
        ihr_disabled = r.read_bit()
        bounce = r.read_bit()
        bounced = r.read_bit()
        src = r.read_address()
        dst = r.read_address()
        value = r.read_coins()
        msg["type"] = "internal"
        msg["bounce"] = bool(bounce)
        msg["bounced"] = bool(bounced)
        msg["src"] = src
        msg["dst"] = dst
        msg["value_nano"] = value
        msg["value_ton"] = nano_to_ton(value)
    else:
        sub = r.read_bit()
        if sub == 0:
            # ext_in_msg_info$10
            src = r.read_address()
            dst = r.read_address()
            import_fee = r.read_coins()
            msg["type"] = "external_in"
            msg["src"] = src
            msg["dst"] = dst
        else:
            # ext_out_msg_info$11
            src = r.read_address()
            dst = r.read_address()
            created_lt = r.read_uint(64)
            created_at = r.read_uint(32)
            msg["type"] = "external_out"
            msg["src"] = src
            msg["dst"] = dst

    # Try to read body (comment) from first ref if available
    if cell.refs:
        body_cell = cell.refs[0]
        try:
            br = body_cell.reader()
            op = br.read_uint(32)
            if op == 0:
                # Text comment
                remaining_bytes = br.bits_left // 8
                text = br.read_bytes(remaining_bytes)
                try:
                    msg["comment"] = text.decode('utf-8').rstrip('\x00')
                except UnicodeDecodeError:
                    msg["body_hex"] = text.hex()
            else:
                msg["op"] = f"0x{op:08x}"
        except Exception:
            pass

    return msg


def decode_transaction(root: Cell) -> dict:
    """Decode a Transaction cell (TL-B: transaction$0111)."""
    r = root.reader()
    tx = {}

    # transaction$0111
    tag = r.read_bits(4)
    tx["_tag"] = f"0b{tag:04b}"

    account_addr = r.read_bytes(32).hex()
    lt = r.read_uint(64)
    prev_tx_hash = r.read_bytes(32).hex()
    prev_tx_lt = r.read_uint(64)
    now = r.read_uint(32)
    outmsg_cnt = r.read_uint(15)

    tx["account"] = f"0:{account_addr}"
    tx["account_friendly"] = raw_to_friendly(0, account_addr)
    tx["lt"] = lt
    tx["time"] = now
    tx["time_iso"] = datetime.fromtimestamp(now, tz=timezone.utc).isoformat()
    tx["prev_tx_hash"] = prev_tx_hash
    tx["prev_tx_lt"] = prev_tx_lt
    tx["outmsg_cnt"] = outmsg_cnt

    # orig_status, end_status (each 2 bits)
    orig_status = r.read_bits(2)
    end_status = r.read_bits(2)
    status_map = {0: "uninit", 1: "frozen", 2: "active", 3: "nonexist"}
    tx["orig_status"] = status_map.get(orig_status, str(orig_status))
    tx["end_status"] = status_map.get(end_status, str(end_status))

    # Decode messages from refs
    tx["in_msg"] = None
    tx["out_msgs"] = []

    if len(root.refs) >= 1 and root.refs[0].refs:
        # ref[0] is typically the message description cell
        # In a BOC, the in_msg is usually in the first or second ref
        pass

    # Walk refs looking for messages
    for i, ref in enumerate(root.refs):
        try:
            msg = decode_message(ref)
            if msg.get("type") == "internal":
                if tx["in_msg"] is None:
                    tx["in_msg"] = msg
                else:
                    tx["out_msgs"].append(msg)
            elif msg.get("type") in ("external_in", "external_out"):
                if tx["in_msg"] is None:
                    tx["in_msg"] = msg
                else:
                    tx["out_msgs"].append(msg)
        except Exception:
            pass

        # Recurse one level into sub-refs for nested messages
        for sub_ref in ref.refs:
            try:
                msg = decode_message(sub_ref)
                if msg:
                    tx["out_msgs"].append(msg)
            except Exception:
                pass

    return tx


# ═══════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════

def decode_boc(boc_b64: str) -> dict:
    """Decode a base64-encoded BOC, auto-detecting if it's a transaction."""
    roots = deserialize_boc(boc_b64)
    if not roots:
        return {"error": "Empty BOC"}

    root = roots[0]
    r = root.reader()
    tag = r.read_bits(4)

    if tag == 0b0111:  # transaction$0111
        return decode_transaction(root)

    return {
        "type": "unknown_cell",
        "tag_bits": f"0b{tag:04b}",
        "data_hex": root.data.hex(),
        "num_refs": len(root.refs),
    }


def smart_decode(input_str: str) -> dict:
    """Auto-detect: TON address (48 chars) or BOC (longer base64)."""
    cleaned = input_str.strip()

    # TON user-friendly address: 48 base64url chars
    if len(cleaned) <= 48 and len(cleaned) >= 46:
        return {"type": "address", **decode_ton_address(cleaned)}

    # Otherwise treat as BOC
    return {"type": "boc_transaction", **decode_boc(cleaned)}


if __name__ == "__main__":
    import json

    # ── Test 1: Address ──
    print("=" * 60)
    print("ADDRESS DECODE")
    print("=" * 60)
    addr = "EQAOl3l3CEEcKaPLHz-BDvT4P0HZkIOPf5POcILE_5qgJuR2"
    print(json.dumps(smart_decode(addr), indent=2))

    # ── Test 2: Transaction BOC ──
    print("\n" + "=" * 60)
    print("TRANSACTION BOC DECODE")
    print("=" * 60)
    boc = (
        "te6cckECCAEAAaMAA7V/76uDRL5+qtRthJhlFh5WcmxFsLsI1xVZhDsx05VhIuAAA0CpXT"
        "wQ21vSX7QL9k/Pk1ses73+ssIn34eH0rSoZNjEt8fwprDwAANAqV08EBab6XYAABRgl/QIA"
        "QIDAQGgBACCcg/zgGz1srprhD5vFdV0FxZziXaTOYaR/OK2/FWZKwa+1CvIv612HkLaH1S3"
        "+1UmdLIbFNoP2NRtLIiZ4/u8LikCFQQJAnMpBlhgl/QRBgcBsWgASNQI+qHDUfl9kBP4d7"
        "v241oIGjd8hZmnjDzebju49g0AP76uDRL5+qtRthJhlFh5WcmxFsLsI1xVZhDsx05VhIuQJ"
        "zKQZAYJ3QYAAGgVK6eCGNN9LsDABQAcAAAAAFJlZ2lzdGVyZWQAnkBhTBkWHAAAAAAAAAAAF"
        "wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        "AAAAAAAAAAAAAAAW8AAAAAAAAAAAAAAAAEtRS2kSeULjPfdJ4YfFGEir+G1RruLcPyCFvDGF"
        "BOfjgSX0d6G"
    )
    result = smart_decode(boc)
    print(json.dumps(result, indent=2, default=str))
