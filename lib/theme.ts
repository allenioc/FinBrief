/** FinBrief design tokens & navigation — inspired by premium editorial news apps (original implementation). */

export const BRAND = {
  name: "FinBrief",
  tagline: "Market intelligence, explained.",
} as const;

export const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/market-brief": "Market Brief",
  "/watchlist": "Watchlist",
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
      { label: "Search", href: "/?focus=search" },
    ],
  },
  {
    label: "Markets",
    items: [
      { label: "Stocks", href: "/topic/aapl" },
      { label: "ETFs", href: "/topic/spy" },
      { label: "Indexes", href: "/topic/dia" },
      { label: "Sectors", href: "/topic/xlk" },
      { label: "Macro", href: "/topic/inflation" },
    ],
  },
  {
    label: "Following",
    items: [
      { label: "AAPL", href: "/topic/aapl" },
      { label: "NVDA", href: "/topic/nvda" },
      { label: "TSLA", href: "/topic/tsla" },
      { label: "SPY", href: "/topic/spy" },
      { label: "QQQ", href: "/topic/qqq" },
      { label: "Inflation", href: "/topic/inflation" },
      { label: "Interest Rates", href: "/topic/interest-rates" },
    ],
  },
  {
    label: "Library",
    items: [
      { label: "Saved Briefs", href: "/watchlist" },
      { label: "History", href: "/" },
      { label: "Sources", href: "/market-brief" },
    ],
  },
];
