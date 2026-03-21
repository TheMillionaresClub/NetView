import { Core } from "@walletconnect/core";
import { WalletKit } from "@reown/walletkit";

const core = new Core({
  projectId: process.env.PROJECT_ID,
});

const walletKit = await WalletKit.init({
  core, // <- pass the shared `core` instance
  metadata: {
    name: "NetView",
    description: "NetView Client as Wallet/Peer",
    url: "https://netview.app/walletkit",
    icons: [],
  },
});