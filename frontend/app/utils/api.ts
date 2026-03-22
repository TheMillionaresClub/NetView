/**
 * Central API server configuration.
 * Change this single value when switching between local dev and ngrok/production.
 */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "https://ayesha-acrotic-gingerly.ngrok-free.dev";
