import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MN Garments — Master Apparel Distributor, Ranchi",
  description:
    "MN Garments — Master Distributor for Van Heusen Athleisure, Twills, Brizzle, Status Quo & Mudo Jeans. Wholesale, ready stock, Ranchi (Jharkhand).",
  icons: { icon: "/favicon.png", apple: "/favicon.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-brand-slate">
        {children}
      </body>
    </html>
  );
}
