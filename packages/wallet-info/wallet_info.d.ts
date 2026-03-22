/* tslint:disable */
/* eslint-disable */

/**
 * Fetch a full wallet profile: identity, balance, tokens, NFTs, DNS,
 * recent transactions (100), interacted wallet balances, and classification.
 * Returns a JSON string — serde_wasm_bindgen produces circular refs in Node.js.
 * `network` — `"mainnet"` or `"testnet"` (default: testnet)
 */
export function analyze_wallet(address: string, network?: string | null, api_key?: string | null): Promise<string>;

/**
 * Alias for `analyze_wallet` — `WalletProfile` already includes
 * `interacted_wallets` (counterparty balances).
 */
export function full_analysis(address: string, network?: string | null, api_key?: string | null): Promise<string>;

/**
 * Fetch the balance for an address.
 * `network` — `"mainnet"` or `"testnet"` (default: testnet)
 */
export function get_address_information(address: string, network?: string | null): Promise<string>;

/**
 * Fetch one page of transactions (max 100).
 *
 * Pass `lt` + `hash` from the previous call's `next_lt` / `next_hash` to
 * continue from where you left off.  When `next_lt` is `null` in the
 * response there are no more pages.
 * `network` — `"mainnet"` or `"testnet"` (default: testnet)
 */
export function get_transactions(address: string, limit: number, lt?: string | null, hash?: string | null, api_key?: string | null, network?: string | null): Promise<any>;

/**
 * Convert any user-friendly TON address (bounceable, non-bounceable, testnet)
 * to its canonical bounceable form (EQ… for mainnet, kQ… for testnet).
 */
export function normalize_address(address: string): string;
