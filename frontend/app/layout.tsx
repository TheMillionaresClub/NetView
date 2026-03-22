import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "NetView - Kinetic Ledger",
  description: "Blockchain network visualization and wallet analytics",
  icons: {
    icon: "/image.png",
    apple: "/image.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html className="dark" lang="en">
      <head>
        {/* Must be blocking (no defer) so window.Telegram.WebApp exists before React hydrates.
             TonConnect checks isInTMA() during init — if Telegram isn't ready it treats
             the embedded browser as a regular desktop browser and the modal freezes. */}
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-surface-container-lowest text-on-surface font-body overflow-hidden">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
