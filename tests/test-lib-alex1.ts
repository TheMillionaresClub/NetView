import { get_address_information } from "wallet-info";

async function main() {
  const address = "0QD6a-uyjiAX8gRmtPi2ztdeBEliw6GrBa6dQBeM8wlQfJ5K";

  const info = await get_address_information(address);
  // info is a JSON string — parse it
  const parsed = JSON.parse(info);
  console.log("Balance:", parsed.balance, "Status:", parsed.status);
  console.log("Full response:", JSON.stringify(parsed, null, 2));
}

main().catch(console.error);