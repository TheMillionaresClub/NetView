"use client";

import { useState } from "react";
import TopNavBar from "./components/TopNavBar";
import SideNavBar from "./components/SideNavBar";
import BubbleMap from "./components/BubbleMap";
import BottomBar from "./components/BottomBar";
import TonWalletComp from "./components/TonWalletComp";

export default function Home() {
  // 🆕 NOUVEAU : On stocke la recherche ici au plus haut niveau !
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <>
      <TopNavBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
      <SideNavBar />
      {/* On passe la recherche et la fonction pour la vider à la map */}
      <BubbleMap searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
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