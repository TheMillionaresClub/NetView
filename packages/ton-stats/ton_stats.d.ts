/* tslint:disable */
/* eslint-disable */

/**
 * Fetch global TON network stats from all configured sources.
 * Returns a JSON string with GetTonStatsResponse.
 *
 * `request_json` — JSON string matching GetTonStatsRequest shape
 */
export function get_ton_stats(request_json: string): Promise<string>;

/**
 * Returns the crate version.
 */
export function ton_stats_version(): string;
