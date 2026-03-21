"use client";

import { useState } from "react";

const LS_KEY = "bubblemap-state";

export default function BottomBar() {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) {
        alert("Nothing to share yet — unlock some wallets first!");
        return;
      }

      // Compress with CompressionStream (gzip), then base64url-encode
      const bytes = new TextEncoder().encode(raw);
      const cs = new CompressionStream("gzip");
      const writer = cs.writable.getWriter();
      writer.write(bytes);
      writer.close();
      const compressed = await new Response(cs.readable).arrayBuffer();

      // base64url (no padding) for URL safety
      const b64 = btoa(String.fromCharCode(...new Uint8Array(compressed)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const url = `${window.location.origin}${window.location.pathname}?view=${b64}`;

      // Try native share first, fall back to clipboard
      if (navigator.share && url.length < 4000) {
        await navigator.share({ title: "NetView — Shared Graph", url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch (err) {
      console.error("Share failed:", err);
      // Fallback: just copy the page URL
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <footer className="fixed bottom-0 left-0 w-full z-50 px-6 pb-8 pointer-events-none">
      <div className="max-w-screen-xl mx-auto flex justify-center">
        <button
          onClick={handleShare}
          className="bg-[#00E5FF] text-[#0B0E11] w-full max-w-md py-4 flex items-center justify-center gap-2 pointer-events-auto font-headline font-bold shadow-[0_-8px_24px_rgba(0,229,255,0.2)] uppercase tracking-widest active:scale-[0.99] transition-all hover:brightness-110"
        >
          <span className="material-symbols-outlined">
            {copied ? "check" : "share"}
          </span>
          {copied ? "Link Copied!" : "Share View"}
        </button>
      </div>
    </footer>
  );
}
