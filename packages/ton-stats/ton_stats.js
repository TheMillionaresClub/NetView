/* @ts-self-types="./ton_stats.d.ts" */

import * as wasm from "./ton_stats_bg.wasm";
import { __wbg_set_wasm } from "./ton_stats_bg.js";
__wbg_set_wasm(wasm);
wasm.__wbindgen_start();
export {
    get_ton_stats, ton_stats_version
} from "./ton_stats_bg.js";
