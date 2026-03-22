/**
 * Ask the API server to normalize a TON address to its canonical bounceable
 * form (EQ… for mainnet). Returns the original address if the call fails.
 */
import { API_BASE } from "./api";

export async function normalizeToBounceable(address: string): Promise<string> {
  if (!address) return address;
  try {
    const res = await fetch(
      `${API_BASE}/api/normalize-address?address=${encodeURIComponent(address)}`
    );
    if (!res.ok) return address;
    const data = await res.json();
    return data.ok && data.address ? data.address : address;
  } catch {
    return address;
  }
}
