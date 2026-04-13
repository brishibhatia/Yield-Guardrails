import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Yield Guardrails — Policy-Based Stablecoin Treasury",
  description:
    "Define treasury rules, discover LI.FI Earn vaults, detect policy violations, and repair your portfolio with one-click compliant deposits.",
  keywords: ["DeFi", "Treasury", "USDC", "LI.FI", "Stablecoin", "Yield", "Risk Management"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
