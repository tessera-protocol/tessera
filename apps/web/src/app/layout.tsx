"use client";

import "./globals.css";
import { DM_Mono, DM_Sans, Fraunces } from "next/font/google";
import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";
import { TesseraProvider } from "@/lib/tessera-context";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-dm-sans",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["300", "600"],
  variable: "--font-fraunces",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isGuardRoute = pathname.startsWith("/guard");

  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${dmMono.variable} ${fraunces.variable}`}
    >
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="theme-color" content="#0F1117" />
        <title>Tessera</title>
      </head>
      <body
        className={`min-h-screen bg-surface-base font-sans text-content-primary ${
          isGuardRoute ? "pb-8" : "pb-20"
        }`}
      >
        {isGuardRoute ? (
          <main className="mx-auto max-w-5xl px-5 pt-4 md:px-8">{children}</main>
        ) : (
          <TesseraProvider>
            <main className="mx-auto max-w-[430px] px-5 pt-3">{children}</main>
            <BottomNav />
          </TesseraProvider>
        )}
      </body>
    </html>
  );
}
