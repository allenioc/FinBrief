export interface ProviderArticle {
  id: string;
  headline: string;
  source: string;
  author?: string;
  publishedAt: string;
  imageUrl?: string;
  originalUrl: string;
  excerpt: string;
  content?: string;
}

export interface NewsProviderResponse {
  provider: string;
  query: string;
  fetchedAt: string;
  articles: ProviderArticle[];
}

const QUERY_EXPANSIONS: Record<string, string> = {
  aapl: "Apple stock OR Apple earnings",
  tsla: "Tesla stock OR Tesla deliveries",
  spy: "S&P 500 OR SPY ETF",
  qqq: "Nasdaq 100 OR QQQ ETF",
  inflation: "inflation CPI interest rates Fed",
  "interest rates": "interest rates Fed Treasury yields inflation",
};

export function expandNewsQuery(query: string): string {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return "stock market OR federal reserve OR earnings";
  return QUERY_EXPANSIONS[normalized] ?? query;
}

function asId(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function coerceDate(input?: string | number): string {
  if (typeof input === "number") return new Date(input * 1000).toISOString();
  if (!input) return new Date().toISOString();
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function limitArticles(items: ProviderArticle[], limit: number): ProviderArticle[] {
  return items
    .filter((article) => Boolean(article.headline && article.originalUrl))
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, limit);
}

function isTickerLike(query: string): boolean {
  const compact = query.trim().toUpperCase();
  return /^[A-Z]{1,5}$/.test(compact);
}

async function fetchFromNewsApi(query: string, limit: number, apiKey: string): Promise<ProviderArticle[]> {
  const q = encodeURIComponent(expandNewsQuery(query));
  const url = `https://newsapi.org/v2/everything?q=${q}&language=en&sortBy=publishedAt&pageSize=${Math.min(
    50,
    limit
  )}`;
  const response = await fetch(url, {
    headers: { "X-Api-Key": apiKey },
    next: { revalidate: 900 },
  });
  if (!response.ok) throw new Error(`NewsAPI request failed (${response.status})`);
  const payload = (await response.json()) as {
    articles?: Array<{
      title?: string;
      source?: { name?: string };
      author?: string;
      publishedAt?: string;
      url?: string;
      urlToImage?: string;
      description?: string;
      content?: string;
    }>;
  };
  const articles =
    payload.articles?.map((article, index) => ({
      id: `newsapi-${asId(article.url ?? article.title ?? `${index}`)}`,
      headline: article.title ?? "Untitled article",
      source: article.source?.name ?? "News source",
      author: article.author ?? undefined,
      publishedAt: coerceDate(article.publishedAt),
      imageUrl: article.urlToImage ?? undefined,
      originalUrl: article.url ?? "",
      excerpt: article.description ?? article.content ?? "No summary available from provider.",
      content: article.content ?? undefined,
    })) ?? [];
  return limitArticles(articles, limit);
}

async function fetchFromFinnhub(query: string, limit: number, apiKey: string): Promise<ProviderArticle[]> {
  const url = "https://finnhub.io/api/v1/news?category=general";
  const response = await fetch(`${url}&token=${apiKey}`, {
    next: { revalidate: 900 },
  });
  if (!response.ok) throw new Error(`Finnhub request failed (${response.status})`);
  const payload = (await response.json()) as Array<{
    headline?: string;
    source?: string;
    datetime?: number;
    image?: string;
    url?: string;
    summary?: string;
    related?: string;
  }>;

  const expanded = expandNewsQuery(query).toLowerCase().split(/\s+or\s+|\s+/).filter(Boolean);
  const filtered = payload.filter((item) => {
    if (!query.trim()) return true;
    const haystack = `${item.headline ?? ""} ${item.summary ?? ""} ${item.related ?? ""}`.toLowerCase();
    return expanded.some((term) => term.length > 2 && haystack.includes(term.replace(/[^a-z0-9]/g, "")));
  });
  return limitArticles(
    filtered.map((item, index) => ({
      id: `finnhub-${asId(item.url ?? item.headline ?? `${index}`)}`,
      headline: item.headline ?? "Untitled article",
      source: item.source ?? "Finnhub",
      publishedAt: coerceDate(item.datetime),
      imageUrl: item.image ?? undefined,
      originalUrl: item.url ?? "",
      excerpt: item.summary ?? "No summary available from provider.",
    })),
    limit
  );
}

async function fetchFromPolygon(query: string, limit: number, apiKey: string): Promise<ProviderArticle[]> {
  const ticker = isTickerLike(query) ? `&ticker=${encodeURIComponent(query.trim().toUpperCase())}` : "";
  const url = `https://api.polygon.io/v2/reference/news?limit=${Math.min(50, limit)}&order=desc&sort=published_utc${ticker}&apiKey=${apiKey}`;
  const response = await fetch(url, {
    next: { revalidate: 900 },
  });
  if (!response.ok) throw new Error(`Polygon request failed (${response.status})`);
  const payload = (await response.json()) as {
    results?: Array<{
      title?: string;
      author?: string;
      published_utc?: string;
      article_url?: string;
      image_url?: string;
      description?: string;
      publisher?: { name?: string };
    }>;
  };
  return limitArticles(
    (payload.results ?? []).map((item, index) => ({
      id: `polygon-${asId(item.article_url ?? item.title ?? `${index}`)}`,
      headline: item.title ?? "Untitled article",
      source: item.publisher?.name ?? "Polygon",
      author: item.author ?? undefined,
      publishedAt: coerceDate(item.published_utc),
      imageUrl: item.image_url ?? undefined,
      originalUrl: item.article_url ?? "",
      excerpt: item.description ?? "No summary available from provider.",
    })),
    limit
  );
}

async function fetchFromAlphaVantage(query: string, limit: number, apiKey: string): Promise<ProviderArticle[]> {
  const tickerParam = isTickerLike(query) ? `&tickers=${encodeURIComponent(query.trim().toUpperCase())}` : "";
  const keywordParam = !isTickerLike(query) && query.trim() ? `&topics=${encodeURIComponent(query.trim())}` : "";
  const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&apikey=${apiKey}&limit=${Math.min(
    50,
    limit
  )}${tickerParam}${keywordParam}`;
  const response = await fetch(url, {
    next: { revalidate: 900 },
  });
  if (!response.ok) throw new Error(`Alpha Vantage request failed (${response.status})`);
  const payload = (await response.json()) as {
    feed?: Array<{
      title?: string;
      source?: string;
      time_published?: string;
      url?: string;
      banner_image?: string;
      summary?: string;
      authors?: string[];
    }>;
  };
  return limitArticles(
    (payload.feed ?? []).map((item, index) => ({
      id: `alphavantage-${asId(item.url ?? item.title ?? `${index}`)}`,
      headline: item.title ?? "Untitled article",
      source: item.source ?? "Alpha Vantage",
      author: item.authors?.[0],
      publishedAt: coerceDate(item.time_published),
      imageUrl: item.banner_image ?? undefined,
      originalUrl: item.url ?? "",
      excerpt: item.summary ?? "No summary available from provider.",
    })),
    limit
  );
}

function pickProvider() {
  if (process.env.NEWS_API_KEY) return "newsapi" as const;
  if (process.env.FINNHUB_API_KEY) return "finnhub" as const;
  if (process.env.POLYGON_API_KEY) return "polygon" as const;
  if (process.env.ALPHA_VANTAGE_API_KEY) return "alphavantage" as const;
  return null;
}

export async function fetchProviderNews(query: string, limit: number): Promise<NewsProviderResponse | null> {
  const selected = pickProvider();
  if (!selected) return null;

  try {
    let articles: ProviderArticle[] = [];
    if (selected === "newsapi" && process.env.NEWS_API_KEY) {
      articles = await fetchFromNewsApi(query, limit, process.env.NEWS_API_KEY);
    } else if (selected === "finnhub" && process.env.FINNHUB_API_KEY) {
      articles = await fetchFromFinnhub(query, limit, process.env.FINNHUB_API_KEY);
    } else if (selected === "polygon" && process.env.POLYGON_API_KEY) {
      articles = await fetchFromPolygon(query, limit, process.env.POLYGON_API_KEY);
    } else if (selected === "alphavantage" && process.env.ALPHA_VANTAGE_API_KEY) {
      articles = await fetchFromAlphaVantage(query, limit, process.env.ALPHA_VANTAGE_API_KEY);
    }

    return {
      provider: selected,
      query,
      fetchedAt: new Date().toISOString(),
      articles,
    };
  } catch {
    return {
      provider: selected,
      query,
      fetchedAt: new Date().toISOString(),
      articles: [],
    };
  }
}
