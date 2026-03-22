/* tslint:disable */
/* eslint-disable */

/**
 * Find connection (no progress callback — simple version).
 */
export function find_wallet_connection(request: any): Promise<any>;

/**
 * Find connection with a progress callback for live updates.
 * `on_progress(info)` is called after each node expansion.
 * If `on_progress` returns `false`, the search is cancelled.
 */
export function find_wallet_connection_streaming(request: any, on_progress: Function): Promise<any>;
