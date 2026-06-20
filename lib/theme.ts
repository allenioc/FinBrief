/** FinBrief design tokens & navigation — inspired by premium editorial news apps (original implementation). */

export const BRAND = {
  name: "FinBrief",
  tagline: "Market intelligence, explained.",
} as const;

export const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/market-brief": "Market Brief",
  "/watchlist": "Watchlist",
  "/about": "About",
  "/sources": "Sources",
  "/privacy": "Privacy",
  "/terms": "Terms",
  "/contact": "Contact",
};

export function pageTitle(pathname: string): string {
  if (pathname.startsWith("/brief/")) return "Article Brief";
  if (pathname.startsWith("/topic/")) return "Topic Brief";
  return PAGE_TITLES[pathname] ?? "FinBrief";
}

export interface NavItem {
  label: string;
  href: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const SIDEBAR_NAV: NavSection[] = [
  {
    label: "Main",
    items: [
      { label: "Dashboard", href: "/" },
      { label: "Market Brief", href: "/market-brief" },
      { label: "Watchlist", href: "/watchlist" },
      { label: "About", href: "/about" },
    ],
  },
  {
    label: "Topics",
    items: [
      { label: "AAPL", href: "/?q=AAPL" },
      { label: "MSFT", href: "/?q=MSFT" },
      { label: "NVDA", href: "/?q=NVDA" },
      { label: "TSLA", href: "/?q=TSLA" },
      { label: "SPY", href: "/?q=SPY" },
      { label: "QQQ", href: "/?q=QQQ" },
      { label: "VTI", href: "/?q=VTI" },
      { label: "DIA", href: "/?q=DIA" },
      { label: "AI", href: "/?q=AI" },
      { label: "Markets", href: "/?q=Markets" },
      { label: "Economy", href: "/?q=Economy" },
      { label: "Banking", href: "/?q=Banking" },
      { label: "Real Estate", href: "/?q=Real%20Estate" },
      { label: "Interest Rates", href: "/?q=Interest%20Rates" },
    ],
  },
];
