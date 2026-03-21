/* @ts-self-types="./wallet_info.d.ts" */

import * as wasm from "./wallet_info_bg.wasm";
import { __wbg_set_wasm } from "./wallet_info_bg.js";
__wbg_set_wasm(wasm);
wasm.__wbindgen_start();
export {
    analyze_wallet, full_analysis, get_address_information, get_transactions
} from "./wallet_info_bg.js";
