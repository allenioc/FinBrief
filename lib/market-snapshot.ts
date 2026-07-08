import type { MarketBriefAssetRow, MarketDirection, MarketSnapshotPayload } from "./types";
import type { Brief, RiskDriverTag } from "./types";

const CACHE_TTL_MS = 20 * 60 * 1000;
const CACHE_KEY = "market-snapshot-v1";

type QuoteFormat = "index" | "yield" | "fx" | "commodity" | "volatility";

type AssetDefinition = {
  id: string;
  name: string;
  symbol: string;
  format: QuoteFormat;
  driverTags: RiskDriverTag[];
};

const MARKET_ASSETS: AssetDefinition[] = [
  {
    id: "sp500",
    name: "S&P 500",
    symbol: "^GSPC",
    format: "index",
    driverTags: ["Equities", "Earnings", "AI / Technology"],
  },
  {
    id: "nasdaq",
    name: "Nasdaq",
    symbol: "^IXIC",
    format: "index",
    driverTags: ["Equities", "Earnings", "AI / Technology"],
  },
  {
    id: "tsx",
    name: "TSX",
    symbol: "^GSPTSE",
    format: "index",
    driverTags: ["Equities", "Earnings"],
  },
  {
    id: "us10y",
    name: "U.S. 10Y yield",
    symbol: "^TNX",
    format: "yield",
    driverTags: ["Rates", "Inflation", "Central Banks"],
  },
  {
    id: "ca10y",
    name: "Canada 10Y yield",
    symbol: "CA10Y=X",
    format: "yield",
    driverTags: ["Rates", "Inflation", "Central Banks"],
  },
  {
    id: "usdcad",
    name: "USD/CAD",
    symbol: "USDCAD=X",
    format: "fx",
    driverTags: ["FX"],
  },
  {
    id: "wti",
    name: "WTI oil",
    symbol: "CL=F",
    format: "commodity",
    driverTags: ["Commodities", "Geopolitical Risk"],
  },
  {
    id: "gold",
    name: "Gold",
    symbol: "GC=F",
    format: "commodity",
    driverTags: ["Commodities"],
  },
  {
    id: "vix",
    name: "VIX",
    symbol: "^VIX",
    format: "volatility",
    driverTags: ["Volatility"],
  },
];

type MemoryCache = {
  payload: MarketSnapshotPayload;
  expiresAt: number;
};

let memoryCache: MemoryCache | null = null;

type YahooMeta = {
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  previousClose?: number;
};

function directionFromChange(changePercent: number, format: QuoteFormat): MarketDirection {
  const flatThreshold =
    format === "yield" ? 0.5 : format === "fx" ? 0.05 : format === "volatility" ? 0.8 : 0.12;
  if (Math.abs(changePercent) < flatThreshold) return "Flat";
  return changePercent > 0 ? "Up" : "Down";
}

function formatLevel(value: number, format: QuoteFormat): string {
  if (format === "yield") return `${value.toFixed(2)}%`;
  if (format === "fx") return value.toFixed(4);
  if (format === "commodity" && value >= 1000) return value.toFixed(2);
  if (format === "volatility") return value.toFixed(2);
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatChange(
  current: number,
  previous: number,
  format: QuoteFormat
): { changeAmount: string; changeLabel: string; changePercent: number } {
  const delta = current - previous;
  if (format === "yield") {
    const bps = Math.round(delta * 100);
    const sign = bps > 0 ? "+" : "";
    return {
      changeAmount: `${sign}${bps} bps`,
      changeLabel: `${sign}${bps} bps`,
      changePercent: previous !== 0 ? (delta / previous) * 100 : 0,
    };
  }
  const pct = previous !== 0 ? (delta / previous) * 100 : 0;
  const sign = pct > 0 ? "+" : "";
  const amount =
    format === "fx"
      ? `${delta > 0 ? "+" : ""}${delta.toFixed(4)}`
      : `${delta > 0 ? "+" : ""}${delta.toFixed(2)}`;
  return {
    changeAmount: amount,
    changeLabel: `${sign}${pct.toFixed(2)}%`,
    changePercent: pct,
  };
}

async function fetchYahooQuote(def: AssetDefinition): Promise<MarketBriefAssetRow | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(def.symbol)}?interval=1d&range=5d`;
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FinBrief/1.0)" },
      cache: "no-store",
    });
    if (!response.ok) return null;

    const body = (await response.json()) as {
      chart?: { result?: Array<{ meta?: YahooMeta }> };
    };
    const meta = body.chart?.result?.[0]?.meta;
    const current = meta?.regularMarketPrice;
    const previous = meta?.chartPreviousClose ?? meta?.previousClose;
    if (current == null || previous == null || !Number.isFinite(current) || !Number.isFinite(previous)) {
      return null;
    }

    const { changeAmount, changeLabel, changePercent } = formatChange(current, previous, def.format);
    return {
      id: def.id,
      name: def.name,
      currentLevel: formatLevel(current, def.format),
      changeAmount,
      changeLabel,
      direction: directionFromChange(changePercent, def.format),
      available: true,
      mainDrivers: [],
    };
  } catch {
    return null;
  }
}

export async function fetchMarketSnapshot(): Promise<MarketSnapshotPayload> {
  const results = await Promise.all(MARKET_ASSETS.map((def) => fetchYahooQuote(def)));
  const quotes = results.filter((row): row is MarketBriefAssetRow => row != null);

  return {
    fetchedAt: new Date().toISOString(),
    source: "yahoo-finance-chart",
    quotes,
  };
}

export async function getMarketSnapshot(): Promise<MarketSnapshotPayload> {
  if (memoryCache && memoryCache.expiresAt > Date.now()) {
    return memoryCache.payload;
  }

  const payload = await fetchMarketSnapshot();
  memoryCache = {
    payload,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };
  return payload;
}

export function attachDriversToSnapshot(
  snapshot: MarketSnapshotPayload,
  briefs: Brief[]
): MarketBriefAssetRow[] {
  const tagCounts = new Map<RiskDriverTag, number>();
  for (const brief of briefs) {
    for (const tag of brief.riskDrivers ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const rankedDrivers = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);

  return snapshot.quotes.map((quote) => {
    const def = MARKET_ASSETS.find((asset) => asset.id === quote.id);
    const matched = def?.driverTags.filter((tag) => rankedDrivers.includes(tag)) ?? [];
    const mainDrivers =
      matched.length > 0 ? matched.slice(0, 3) : rankedDrivers.slice(0, 2);

    return {
      ...quote,
      mainDrivers,
    };
  });
}

export { CACHE_KEY, CACHE_TTL_MS, MARKET_ASSETS };
