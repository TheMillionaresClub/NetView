import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NetView",
  description: "NetView frontend",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div id="app">{children}</div>
      </body>
    </html>
  );
}
