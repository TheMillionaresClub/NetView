import TopNavBar from "./components/TopNavBar";
import SideNavBar from "./components/SideNavBar";
import BubbleMap from "./components/BubbleMap";
import DetailsPanel from "./components/DetailsPanel";
import BottomBar from "./components/BottomBar";
import TonWalletComp from "./components/TonWalletComp";

export default function Home() {
  return (
    <>
      <TopNavBar />
      <SideNavBar />
      <BubbleMap />
      <DetailsPanel />
      <BottomBar />
      {/* TON Wallet floating widget */}
      <div className="fixed top-16 left-24 z-50">
        <TonWalletComp />
      </div>
      {/* Atmosphere Overlay */}
      <div className="fixed inset-0 pointer-events-none border-[20px] border-surface-container-lowest/20 z-[60]" />
    </>
  );
}
