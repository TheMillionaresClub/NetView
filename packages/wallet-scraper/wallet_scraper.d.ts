/* tslint:disable */
/* eslint-disable */

/**
 * Scrape a single wallet address for off-chain intelligence.
 * Returns a JSON string with the full WalletProfile.
 *
 * `address`  — TON wallet address (any format)
 * `network`  — "mainnet" or "testnet" (default: mainnet)
 * `tonapi_key` — optional tonapi.io API key for higher rate limits
 */
export function scrape_wallet(address: string, network?: string | null, tonapi_key?: string | null): Promise<string>;

/**
 * Scrape multiple wallet addresses in parallel.
 * Returns a JSON string with GetWalletProfileResponse.
 *
 * `addresses_json` — JSON array of address strings
 * `network`        — "mainnet" or "testnet" (default: mainnet)
 * `tonapi_key`     — optional tonapi.io API key
 */
export function scrape_wallets(addresses_json: string, network?: string | null, tonapi_key?: string | null): Promise<string>;

/**
 * Returns the crate version.
 */
export function wallet_scraper_version(): string;
