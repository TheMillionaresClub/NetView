import base64
import struct

def decode_ton_address(address_b64):
    # 1. Handle URL-safe variant by replacing characters
    address_b64 = address_b64.replace('-', '+').replace('_', '/')
    
    # 2. Add padding if necessary
    missing_padding = len(address_b64) % 4
    if missing_padding:
        address_b64 += '=' * (4 - missing_padding)
    
    # 3. Decode Base64 to bytes (should be 36 bytes)
    raw_bytes = base64.b64decode(address_b64)
    
    if len(raw_bytes) != 36:
        return "Invalid length: TON addresses must be 36 bytes (48 b64 chars)."

    # 4. Unpack components
    # Flags (1b), Workchain (1b), Account ID (32b), Checksum (2b)
    flags = raw_bytes[0]
    workchain = struct.unpack('b', raw_bytes[1:2])[0] # Signed 8-bit int
    account_id = raw_bytes[2:34].hex()
    checksum = raw_bytes[34:]

    return {
        "bounceable": bool(flags & 0x11),
        "testnet": bool(flags & 0x80),
        "workchain": workchain,
        "account_id_hex": account_id,
        "raw_form": f"{workchain}:{account_id}"
    }

# Example usage:
addr = "EQAOl3l3CEEcKaPLHz-BDvT4P0HZkIOPf5POcILE_5qgJuR2"
print(decode_ton_address(addr))