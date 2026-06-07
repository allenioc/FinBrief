const PROVIDER_LABELS: Record<string, string> = {
  newsapi: "NewsAPI",
  finnhub: "Finnhub",
  polygon: "Polygon",
  alphavantage: "Alpha Vantage",
  mock: "Mock fallback",
};

export function isLiveProvider(provider?: string | null): boolean {
  return Boolean(provider && provider !== "mock");
}

export function formatProviderLabel(provider?: string | null): string {
  if (!provider) return PROVIDER_LABELS.mock;
  if (provider === "mock") return PROVIDER_LABELS.mock;
  return provider
    .split(",")
    .map((item) => PROVIDER_LABELS[item.trim().toLowerCase()] ?? item.trim())
    .join(" + ");
}

