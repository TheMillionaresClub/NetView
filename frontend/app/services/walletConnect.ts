import { Core } from "@walletconnect/core";
import { WalletKit, type IWalletKit } from "@reown/walletkit";
import { populateAuthPayload, buildAuthObject } from "@walletconnect/utils";

// ── Supported EVM chains & methods ──────────────────────────────
const supportedChains = ["eip155:1", "eip155:2", "eip155:137"];
const supportedMethods = [
  "personal_sign",
  "eth_sendTransaction",
  "eth_signTypedData",
];

// ── Lazy singleton ──────────────────────────────────────────────
let walletKit: IWalletKit | null = null;

export async function getWalletKit(): Promise<IWalletKit> {
  if (walletKit) return walletKit;

  const core = new Core({
    projectId: process.env.NEXT_PUBLIC_PROJECT_ID,
  });

  walletKit = await WalletKit.init({
    core,
    metadata: {
      name: "NetView",
      description: "NetView Client as Wallet/Peer",
      url: "https://netview.app/walletkit",
      icons: ["/image.png"],
    },
  });

  return walletKit;
}

// ── Wallet abstraction the caller must supply ───────────────────
export interface CryptoWallet {
  address: string;
  signMessage(message: string, privateKey?: string): Promise<string>;
}

// ── Session authentication ──────────────────────────────────────
export async function approveSession(
  payload: { id: number; params: { authPayload: any } },
  cryptoWallet: CryptoWallet,
  privateKey?: string,
) {
  const kit = await getWalletKit();

  const authPayload = populateAuthPayload({
    authPayload: payload.params.authPayload,
    chains: supportedChains,
    methods: supportedMethods,
  });

  const auths = [];

  for (const chain of authPayload.chains) {
    const iss = `${chain}:${cryptoWallet.address}`;

    const message = kit.formatAuthMessage({
      request: authPayload,
      iss,
    });

    const signature = await cryptoWallet.signMessage(message, privateKey);

    const auth = buildAuthObject(
      authPayload,
      {
        t: "eip191",
        s: signature,
      },
      iss,
    );

    auths.push(auth);
  }

  await kit.approveSessionAuthenticate({
    id: payload.id,
    auths,
  });
}

export default getWalletKit;