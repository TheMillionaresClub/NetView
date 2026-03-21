"use client";

import { useState } from "react";
import { toPng } from "html-to-image";

export default function BottomBar() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const handleShare = async () => {
    setBusy(true);
    try {
      // Grab the ReactFlow viewport element
      const el = document.querySelector<HTMLElement>(".react-flow");
      if (!el) {
        alert("Nothing to capture — open the map first!");
        return;
      }

      // Render to PNG blob
      const dataUrl = await toPng(el, {
        backgroundColor: "#080d14",
        pixelRatio: 2, // retina-quality
        skipFonts: true, // avoid CORS errors from cross-origin Google Fonts
        filter: (node) => {
          // Skip the ReactFlow controls/minimap chrome from the screenshot
          const cls = node.classList?.toString() ?? "";
          if (cls.includes("react-flow__controls")) return false;
          if (cls.includes("react-flow__minimap")) return false;
          return true;
        },
      });

      // Convert data-URL → Blob
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], "netview-graph.png", { type: "image/png" });

      // Try native share (mobile / PWA) with the image file
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: "NetView — Network Graph",
          files: [file],
        });
      } else {
        // Fallback: download the image
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = "netview-graph.png";
        a.click();
      }

      setDone(true);
      setTimeout(() => setDone(false), 2500);
    } catch (err: any) {
      // User cancelled share dialog — not an error
      if (err?.name !== "AbortError") {
        console.error("Share failed:", err);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <footer className="fixed bottom-0 left-0 w-full z-50 px-6 pb-8 pointer-events-none">
      <div className="max-w-screen-xl mx-auto flex justify-center">
        <button
          onClick={handleShare}
          disabled={busy}
          className="bg-[#00E5FF] text-[#0B0E11] w-full max-w-md py-4 flex items-center justify-center gap-2 pointer-events-auto font-headline font-bold shadow-[0_-8px_24px_rgba(0,229,255,0.2)] uppercase tracking-widest active:scale-[0.99] transition-all hover:brightness-110 disabled:opacity-60"
        >
          <span className="material-symbols-outlined">
            {busy ? "progress_activity" : done ? "check" : "share"}
          </span>
          {busy ? "Capturing…" : done ? "Saved!" : "Share View"}
        </button>
      </div>
    </footer>
  );
}
