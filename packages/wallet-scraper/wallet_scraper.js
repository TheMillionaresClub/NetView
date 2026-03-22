/* @ts-self-types="./wallet_scraper.d.ts" */

import * as wasm from "./wallet_scraper_bg.wasm";
import { __wbg_set_wasm } from "./wallet_scraper_bg.js";
__wbg_set_wasm(wasm);
wasm.__wbindgen_start();
export {
    scrape_wallet, scrape_wallets, wallet_scraper_version
} from "./wallet_scraper_bg.js";
