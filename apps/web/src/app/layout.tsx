"use client";

import "./globals.css";
import { DM_Mono, DM_Sans, Fraunces } from "next/font/google";
import { BottomNav } from "@/components/bottom-nav";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-dm-sans",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["300", "600"],
  variable: "--font-fraunces",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${fraunces.variable} ${dmMono.variable}`}
    >
      <body className="min-h-screen bg-[#0F1117] text-[#e0e0e8]">
        <div className="mx-auto flex min-h-screen max-w-md flex-col bg-[#0F1117]">
          <main className="flex-1 px-5 pb-28 pt-8">{children}</main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
