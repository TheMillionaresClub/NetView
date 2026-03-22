/**
 * Ask the API server to normalize a TON address to its canonical bounceable
 * form (EQ… for mainnet). Returns the original address if the call fails.
 */
export async function normalizeToBounceable(address: string): Promise<string> {
  if (!address) return address;
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api/normalize-address?address=${encodeURIComponent(address)}`
    );
    if (!res.ok) return address;
    const data = await res.json();
    return data.ok && data.address ? data.address : address;
  } catch {
    return address;
  }
}
