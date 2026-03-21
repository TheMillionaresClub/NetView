import init, { get_address_information_json } from "ton_explorer_core";

async function main() {
  // First, ensure WASM is initialized (some bundlers call default export automatically; if not, call init())
  await init();

  const address = "EQC...";
  const apiKey = "e251fe96771c8fe3e7c93798924a1b12c600aecfcc25d4b9fa9178ca15a9050d";

  const info = await get_address_information_json(address, apiKey);
  // info is a JS object matching AddressInformation
  console.log(info.balance, info.status);
}