import { BROAD_FINANCE_QUERIES, BROAD_NEWS_QUERY } from "./news-constants";

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
  totalAvailable: number;
  providerStats: Array<{ provider: string; count: number }>;
}

const QUERY_EXPANSIONS: Record<string, string> = {
  aapl: "Apple stock OR Apple earnings",
  tsla: "Tesla stock OR Tesla deliveries",
  spy: "S&P 500 OR SPY ETF",
  qqq: "Nasdaq 100 OR QQQ ETF",
  inflation: "inflation CPI interest rates Fed",
  "interest rates": "interest rates Fed Treasury yields inflation",
};

const FINANCE_RELEVANCE_TERMS = [
  "stock",
  "stocks",
  "market",
  "markets",
  "earnings",
  "revenue",
  "guidance",
  "federal reserve",
  "fed",
  "inflation",
  "interest rates",
  "bond",
  "treasury",
  "etf",
  "index",
  "nasdaq",
  "s&p",
  "dow",
  "business",
  "economy",
  "economics",
  "ipo",
  "acquisition",
  "merger",
  "bank",
  "banking",
];

export function expandNewsQuery(query: string): string {
  const normalized = query.trim().toLowerCase();
  if (!normalized || normalized === BROAD_NEWS_QUERY) {
    return "global markets OR business economy OR inflation OR interest rates OR corporate earnings";
  }
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

async function fetchFromNewsApi(
  query: string,
  limit: number,
  page: number,
  apiKey: string
): Promise<ProviderArticle[]> {
  const q = encodeURIComponent(expandNewsQuery(query));
  const url = `https://newsapi.org/v2/everything?q=${q}&language=en&sortBy=publishedAt&pageSize=${Math.min(
    50,
    limit
  )}&page=${Math.max(1, page)}`;
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

async function fetchFromFinnhub(
  query: string,
  limit: number,
  page: number,
  apiKey: string
): Promise<ProviderArticle[]> {
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
  const normalized = filtered.map((item, index) => ({
      id: `finnhub-${asId(item.url ?? item.headline ?? `${index}`)}`,
      headline: item.headline ?? "Untitled article",
      source: item.source ?? "Finnhub",
      publishedAt: coerceDate(item.datetime),
      imageUrl: item.image ?? undefined,
      originalUrl: item.url ?? "",
      excerpt: item.summary ?? "No summary available from provider.",
    }));
  const start = (Math.max(1, page) - 1) * limit;
  return limitArticles(normalized, start + limit).slice(start, start + limit);
}

async function fetchFromPolygon(
  query: string,
  limit: number,
  page: number,
  apiKey: string
): Promise<ProviderArticle[]> {
  const ticker = isTickerLike(query) ? `&ticker=${encodeURIComponent(query.trim().toUpperCase())}` : "";
  const overfetch = Math.min(50, Math.max(limit * page, limit));
  const url = `https://api.polygon.io/v2/reference/news?limit=${overfetch}&order=desc&sort=published_utc${ticker}&apiKey=${apiKey}`;
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
  const normalized = (payload.results ?? []).map((item, index) => ({
      id: `polygon-${asId(item.article_url ?? item.title ?? `${index}`)}`,
      headline: item.title ?? "Untitled article",
      source: item.publisher?.name ?? "Polygon",
      author: item.author ?? undefined,
      publishedAt: coerceDate(item.published_utc),
      imageUrl: item.image_url ?? undefined,
      originalUrl: item.article_url ?? "",
      excerpt: item.description ?? "No summary available from provider.",
    }));
  const start = (Math.max(1, page) - 1) * limit;
  return limitArticles(normalized, start + limit).slice(start, start + limit);
}

async function fetchFromAlphaVantage(
  query: string,
  limit: number,
  page: number,
  apiKey: string
): Promise<ProviderArticle[]> {
  const tickerParam = isTickerLike(query) ? `&tickers=${encodeURIComponent(query.trim().toUpperCase())}` : "";
  const keywordParam = !isTickerLike(query) && query.trim() ? `&topics=${encodeURIComponent(query.trim())}` : "";
  const overfetch = Math.min(50, Math.max(limit * page, limit));
  const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&apikey=${apiKey}&limit=${Math.min(
    50,
    overfetch
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
  const normalized = (payload.feed ?? []).map((item, index) => ({
      id: `alphavantage-${asId(item.url ?? item.title ?? `${index}`)}`,
      headline: item.title ?? "Untitled article",
      source: item.source ?? "Alpha Vantage",
      author: item.authors?.[0],
      publishedAt: coerceDate(item.time_published),
      imageUrl: item.banner_image ?? undefined,
      originalUrl: item.url ?? "",
      excerpt: item.summary ?? "No summary available from provider.",
    }));
  const start = (Math.max(1, page) - 1) * limit;
  return limitArticles(normalized, start + limit).slice(start, start + limit);
}

function configuredProviders() {
  const providers: Array<"newsapi" | "finnhub" | "polygon" | "alphavantage"> = [];
  if (process.env.NEWS_API_KEY) providers.push("newsapi");
  if (process.env.FINNHUB_API_KEY) providers.push("finnhub");
  if (process.env.POLYGON_API_KEY) providers.push("polygon");
  if (process.env.ALPHA_VANTAGE_API_KEY) providers.push("alphavantage");
  return providers;
}

function resolveQueryBatch(query: string, page: number): string[] {
  const normalized = query.trim().toLowerCase();
  if (normalized && normalized !== BROAD_NEWS_QUERY) return [query];

  // Keep request volume bounded while still rotating broad themes over pages.
  const perPage = 8;
  const start = ((Math.max(1, page) - 1) * perPage) % BROAD_FINANCE_QUERIES.length;
  const selected: string[] = [];
  for (let i = 0; i < perPage; i += 1) {
    selected.push(BROAD_FINANCE_QUERIES[(start + i) % BROAD_FINANCE_QUERIES.length]);
  }
  return selected;
}

function isFinanceRelevant(article: ProviderArticle, query: string): boolean {
  const haystack = `${article.headline} ${article.excerpt} ${article.source}`.toLowerCase();
  const queryTerms = expandNewsQuery(query)
    .toLowerCase()
    .split(/\s+or\s+|\s+/)
    .filter((term) => term.length > 2)
    .map((term) => term.replace(/[^a-z0-9]/g, ""));
  const termMatch = FINANCE_RELEVANCE_TERMS.some((term) => haystack.includes(term));
  const queryMatch =
    queryTerms.length === 0 ||
    queryTerms.some((term) => haystack.includes(term) || haystack.includes(term.toUpperCase()));
  return termMatch || queryMatch;
}

function dedupeArticles(items: ProviderArticle[]): ProviderArticle[] {
  const byKey = new Map<string, ProviderArticle>();
  for (const article of items) {
    const urlKey = article.originalUrl.trim().toLowerCase();
    const titleKey = `${article.source}-${article.headline}`.toLowerCase();
    const key = urlKey || titleKey;
    if (!byKey.has(key)) byKey.set(key, article);
  }
  return [...byKey.values()].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

export async function fetchProviderNews(
  query: string,
  limit: number,
  page: number
): Promise<NewsProviderResponse | null> {
  const providers = configuredProviders();
  if (providers.length === 0) return null;
  const queryBatch = resolveQueryBatch(query, page);
  const perQueryLimit = Math.max(8, Math.ceil((limit * 2) / queryBatch.length));

  const tasks = providers.flatMap((provider) =>
    queryBatch.map(async (singleQuery) => {
    try {
      if (provider === "newsapi" && process.env.NEWS_API_KEY) {
        const articles = await fetchFromNewsApi(singleQuery, perQueryLimit, 1, process.env.NEWS_API_KEY);
        return { provider, articles };
      }
      if (provider === "finnhub" && process.env.FINNHUB_API_KEY) {
        const articles = await fetchFromFinnhub(singleQuery, perQueryLimit, 1, process.env.FINNHUB_API_KEY);
        return { provider, articles };
      }
      if (provider === "polygon" && process.env.POLYGON_API_KEY) {
        const articles = await fetchFromPolygon(singleQuery, perQueryLimit, 1, process.env.POLYGON_API_KEY);
        return { provider, articles };
      }
      if (provider === "alphavantage" && process.env.ALPHA_VANTAGE_API_KEY) {
        const articles = await fetchFromAlphaVantage(singleQuery, perQueryLimit, 1, process.env.ALPHA_VANTAGE_API_KEY);
        return { provider, articles };
      }
      return { provider, articles: [] as ProviderArticle[] };
    } catch {
      return { provider, articles: [] as ProviderArticle[] };
    }
  })
  );

  const resolved = await Promise.all(tasks);
  const providerStats = resolved.map((entry) => ({
    provider: entry.provider,
    count: entry.articles.length,
  }));
  const merged = dedupeArticles(resolved.flatMap((entry) => entry.articles)).filter((article) =>
    isFinanceRelevant(article, queryBatch.join(" "))
  );
  const start = (Math.max(1, page) - 1) * limit;
  const paginated = merged.slice(start, start + limit);

  return {
    provider: providers.join(","),
    query,
    fetchedAt: new Date().toISOString(),
    articles: paginated,
    totalAvailable: merged.length,
    providerStats,
  };
}
