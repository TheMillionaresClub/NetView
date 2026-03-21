"""
get-sent-addresses.py
─────────────────────
Given a TON wallet address, fetches ALL outgoing transactions and collects
every unique destination address the wallet has ever sent TON to.

Output: saves a JSON file with the results.

Usage:
    python get-sent-addresses.py <wallet_address> [--limit 100] [--output sent.json] [--mainnet]
"""

import argparse
import json
import time
import sys
from datetime import datetime, timezone
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

# ── Defaults ──────────────────────────────────────────────────────
DEFAULT_API_KEY = "e251fe96771c8fe3e7c93798924a1b12c600aecfcc25d4b9fa9178ca15a9050d"
TESTNET_URL     = "https://testnet.toncenter.com/api/v2"
MAINNET_URL     = "https://toncenter.com/api/v2"


def api_get(base_url: str, method: str, params: dict, api_key: str) -> dict:
    """Call toncenter HTTP API (GET)."""
    qs = "&".join(f"{k}={v}" for k, v in params.items() if v is not None)
    url = f"{base_url}/{method}?{qs}"
    req = Request(url, headers={"X-API-Key": api_key, "Accept": "application/json"})
    try:
        with urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except HTTPError as e:
        body = e.read().decode() if e.fp else ""
        print(f"  ✗ HTTP {e.code}: {body[:200]}")
        raise
    except URLError as e:
        print(f"  ✗ Network error: {e.reason}")
        raise


def nano_to_ton(nano: str | int) -> float:
    return int(nano) / 1e9


def friendly_address(raw: str) -> str:
    """Return raw address as-is (workchain:hex). toncenter already gives friendly in some fields."""
    return raw


def fetch_all_transactions(base_url: str, address: str, api_key: str, max_txs: int = 0):
    """
    Paginate through getTransactions to collect all (or up to max_txs) transactions.
    toncenter returns newest-first; we page via lt + hash.
    """
    all_txs = []
    last_lt = None
    last_hash = None
    page_size = 50  # max toncenter allows per call
    page = 0

    while True:
        page += 1
        params = {"address": address, "limit": page_size}
        if last_lt is not None:
            params["lt"] = last_lt
            params["hash"] = last_hash

        print(f"  ⟳ Fetching page {page} (lt={last_lt or 'latest'})...")
        data = api_get(base_url, "getTransactions", params, api_key)

        if not data.get("ok"):
            print(f"  ✗ API error: {data.get('error', 'unknown')}")
            break

        txs = data.get("result", [])
        if not txs:
            break

        # If paginating, the first tx of this batch == last tx of prev batch, skip it
        if last_lt is not None and txs and txs[0]["transaction_id"]["lt"] == last_lt:
            txs = txs[1:]

        if not txs:
            break

        all_txs.extend(txs)
        print(f"    got {len(txs)} txs (total: {len(all_txs)})")

        if 0 < max_txs <= len(all_txs):
            all_txs = all_txs[:max_txs]
            break

        # Prepare next page cursor
        last_tx = txs[-1]
        last_lt = last_tx["transaction_id"]["lt"]
        last_hash = last_tx["transaction_id"]["hash"]

        # Rate-limit courtesy
        time.sleep(0.3)

    return all_txs


def extract_sent_addresses(transactions: list, source_address: str) -> dict:
    """
    Walk transactions and find all outgoing messages (messages where the
    source wallet sent TON to another address).

    Returns a dict keyed by destination address with aggregated stats.
    """
    destinations: dict[str, dict] = {}

    for tx in transactions:
        out_msgs = tx.get("out_msgs", [])
        for msg in out_msgs:
            dest = msg.get("destination")
            if not dest:
                continue  # external / deploy messages

            value_nano = int(msg.get("value", "0"))
            if value_nano == 0:
                continue  # skip zero-value messages (e.g. notifications)

            msg_body = msg.get("message", "")
            timestamp = int(msg.get("created_lt", tx.get("utime", 0)))
            utime = tx.get("utime", 0)

            if dest not in destinations:
                destinations[dest] = {
                    "address": dest,
                    "total_sent_nano": 0,
                    "total_sent_ton": 0.0,
                    "tx_count": 0,
                    "first_seen": utime,
                    "last_seen": utime,
                    "messages": [],
                }

            entry = destinations[dest]
            entry["total_sent_nano"] += value_nano
            entry["total_sent_ton"] = round(entry["total_sent_nano"] / 1e9, 9)
            entry["tx_count"] += 1
            entry["first_seen"] = min(entry["first_seen"], utime)
            entry["last_seen"] = max(entry["last_seen"], utime)
            entry["messages"].append({
                "value_nano": value_nano,
                "value_ton": round(value_nano / 1e9, 9),
                "timestamp": utime,
                "date": datetime.fromtimestamp(utime, tz=timezone.utc).isoformat() if utime else None,
                "comment": msg_body if msg_body else None,
            })

    # Convert timestamps to ISO strings for readability
    for entry in destinations.values():
        entry["first_seen_date"] = (
            datetime.fromtimestamp(entry["first_seen"], tz=timezone.utc).isoformat()
            if entry["first_seen"] else None
        )
        entry["last_seen_date"] = (
            datetime.fromtimestamp(entry["last_seen"], tz=timezone.utc).isoformat()
            if entry["last_seen"] else None
        )

    return destinations


def main():
    parser = argparse.ArgumentParser(
        description="Fetch all addresses a TON wallet has sent TON to."
    )
    parser.add_argument("address", help="TON wallet address (friendly or raw)")
    parser.add_argument("--limit", type=int, default=0,
                        help="Max transactions to fetch (0 = all)")
    parser.add_argument("--output", "-o", default=None,
                        help="Output JSON file path (default: sent_<addr>.json)")
    parser.add_argument("--mainnet", action="store_true",
                        help="Use mainnet instead of testnet")
    parser.add_argument("--api-key", default=DEFAULT_API_KEY,
                        help="toncenter API key")
    parser.add_argument("--no-messages", action="store_true",
                        help="Omit individual message details (smaller output)")

    args = parser.parse_args()

    base_url = MAINNET_URL if args.mainnet else TESTNET_URL
    network = "mainnet" if args.mainnet else "testnet"

    print(f"╔══════════════════════════════════════════════════╗")
    print(f"║  TON Sent-Address Collector                     ║")
    print(f"╚══════════════════════════════════════════════════╝")
    print(f"  Network : {network}")
    print(f"  Wallet  : {args.address}")
    print(f"  Limit   : {'all' if args.limit == 0 else args.limit}")
    print()

    # 1. Fetch transactions
    transactions = fetch_all_transactions(base_url, args.address, args.api_key, args.limit)
    print(f"\n  ✓ Fetched {len(transactions)} transactions total.\n")

    if not transactions:
        print("  No transactions found for this wallet.")
        sys.exit(0)

    # 2. Extract outgoing destinations
    destinations = extract_sent_addresses(transactions, args.address)

    if args.no_messages:
        for entry in destinations.values():
            del entry["messages"]

    # Sort by total sent (descending)
    sorted_dests = sorted(destinations.values(), key=lambda d: d["total_sent_nano"], reverse=True)

    # 3. Build output — addresses only
    total_sent_nano = sum(d["total_sent_nano"] for d in sorted_dests)
    address_list = [d["address"] for d in sorted_dests]
    output = {
        "source_wallet": args.address,
        "network": network,
        "unique_destinations": len(address_list),
        "addresses": address_list,
    }

    # 4. Save
    out_path = args.output or f"sent_{args.address[:16].replace(':', '_')}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    # 5. Summary
    print(f"  ┌─────────────────────────────────────────────┐")
    print(f"  │  Results                                    │")
    print(f"  ├─────────────────────────────────────────────┤")
    print(f"  │  Transactions scanned : {len(transactions):>10}          │")
    print(f"  │  Unique destinations  : {len(sorted_dests):>10}          │")
    print(f"  │  Total TON sent       : {output['total_ton_sent']:>14.4f}    │")
    print(f"  └─────────────────────────────────────────────┘")
    print()

    # Top 10 preview
    print(f"  Top destinations:")
    for i, d in enumerate(sorted_dests[:10], 1):
        addr_short = d["address"][:12] + "..." + d["address"][-6:] if len(d["address"]) > 20 else d["address"]
        print(f"    {i:>2}. {addr_short:<22}  {d['total_sent_ton']:>12.4f} TON  ({d['tx_count']} txs)")

    print(f"\n  ✓ Saved to {out_path}")


if __name__ == "__main__":
    main()
