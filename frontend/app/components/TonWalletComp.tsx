"use client";

import {
  useTonConnectUI,
  useTonConnectModal,
  useTonAddress,
  useIsConnectionRestored,
} from "@tonconnect/ui-react";

export default function TonWalletComp() {
  const [tonConnectUI] = useTonConnectUI();
  const { open } = useTonConnectModal();
  const address = useTonAddress(true); // user-friendly form
  const rawAddress = useTonAddress(false);
  const restored = useIsConnectionRestored();

  const connected = !!rawAddress;

  const truncated = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : null;

  const disconnect = async () => {
    await tonConnectUI.disconnect();
  };

  if (!restored) {
    return (
      <span className="text-[10px] text-secondary font-headline uppercase tracking-widest animate-pulse">
        Restoring…
      </span>
    );
  }

  if (!connected) {
    return (
      <button
        onClick={() => open()}
        className="bg-[#00E5FF] text-[#0B0E11] px-4 py-1.5 text-[10px] font-headline font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
      >
        <span className="material-symbols-outlined text-sm">
          account_balance_wallet
        </span>
        Connect TON
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 bg-[#00E5FF] rounded-full animate-pulse" />
      <span className="text-[10px] text-primary-container font-headline uppercase tracking-widest">
        {truncated}
      </span>
      <button
        onClick={disconnect}
        className="text-error text-[10px] font-headline uppercase tracking-widest hover:underline ml-1"
      >
        ✕
      </button>
    </div>
  );
}
