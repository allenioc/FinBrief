import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { TopBar } from "@/components/TopBar";
import { WatchlistProvider } from "@/components/WatchlistProvider";
import { DailyEditionProvider } from "@/components/DailyEditionProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "optional",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "FinBrief — AI Finance News Briefings",
  description:
    "Understand finance news with quick, educational briefings for stocks, ETFs, and macro topics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased">
        <WatchlistProvider>
          <DailyEditionProvider>
            <AppShell>
              <TopBar />
              <main className="flex-1">{children}</main>
            </AppShell>
          </DailyEditionProvider>
        </WatchlistProvider>
      </body>
    </html>
  );
}
