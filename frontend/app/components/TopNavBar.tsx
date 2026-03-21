import Image from "next/image";
import TonWalletComp from "./TonWalletComp";

export default function TopNavBar() {
  return (
    <header className="fixed top-0 w-full z-50 flex justify-between items-center px-4 h-14 bg-[#111417] border-none">
      <div className="flex items-center gap-2">
        <Image src="/image.png" alt="NetView" width={28} height={28} className="object-contain" />
        <span className="text-xl font-bold text-[#00E5FF] font-headline uppercase tracking-tighter">
          NetView
        </span>
      </div>
      <div className="flex items-center gap-4">
        <TonWalletComp />
        <div className="bg-surface-container-low px-3 py-1.5 flex items-center gap-2">
          <span className="material-symbols-outlined text-sm text-outline">
            search
          </span>
          <input
            className="bg-transparent border-none text-xs font-headline tracking-widest focus:ring-0 w-32 md:w-64 uppercase text-on-surface-variant placeholder:text-on-surface-variant/50 outline-none"
            placeholder="SEARCH WALLET..."
            type="text"
          />
        </div>
        <button className="text-[#94a3b8] hover:bg-[#272A2E] transition-colors duration-150 ease-linear p-2">
          <span className="material-symbols-outlined">search</span>
        </button>
      </div>
    </header>
  );
}
