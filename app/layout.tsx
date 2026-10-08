import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Literata } from "next/font/google";
import "./globals.css";

const literata = Literata({ subsets: ["latin"], variable: "--font-literata", display: "swap" });
const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken", display: "swap" });

export const metadata: Metadata = {
  title: "Calm Registry",
  description: "A baby registry that builds itself from a short chat, with real products from Amazon, Target, and Walmart.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#222b3a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${literata.variable} ${hanken.variable}`}>
      <body className="min-h-dvh font-sans antialiased">
        <div className="mx-auto min-h-dvh max-w-7xl px-4 pb-16 sm:px-6 lg:px-10 2xl:max-w-[1440px]">{children}</div>
      </body>
    </html>
  );
}
