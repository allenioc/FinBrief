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
  errorMessage?: string;
  providerRunStatuses?: ProviderRunStatus[];
}

export type ProviderTimeRange = "breaking" | "today" | "week";

type ProviderName =
  | "newsapi"
  | "gnews"
  | "thenewsapi"
  | "finnhub"
  | "polygon"
  | "alphavantage";

type ProviderTaskResult = {
  provider: ProviderName;
  query: string;
  articles: ProviderArticle[];
  error: string | null;
  skipped?: string;
};

type RunBatchResult = {
  resolved: ProviderTaskResult[];
  statusByProvider: Map<ProviderName, ProviderRunStatus>;
};

export interface ProviderDebugStatus {
  provider: ProviderName;
  configured: boolean;
  coolingDown: boolean;
  cooldownRemainingMs: number;
  lastError?: string;
}

export interface ProviderRunStatus {
  provider: ProviderName;
  configured: boolean;
  attempted: boolean;
  status: "success" | "error" | "skipped_cooldown" | "not_configured";
  articleCount: number;
  cooldownRemainingMs: number;
  errorMessage?: string;
}

export interface NewsApiDebugResponse {
  provider: "newsapi";
  hasNewsApiKey: boolean;
  query: string;
  expandedQuery: string;
  endpoint: string;
  fromDate: string;
  toDate: string;
  httpStatus?: number;
  newsApiStatus?: string;
  newsApiTotalResults?: number;
  rawArticleCount: number;
  afterValidityCount: number;
  afterRelevanceCount: number;
  afterTimeRangeCount: number;
  firstRawTitles: string[];
  removedReasons: Record<string, number>;
  errorCode?: string;
  errorMessage?: string;
}

export interface MultiProviderDebugResponse {
  query: string;
  timeRange: ProviderTimeRange;
  configured: {
    newsapi: boolean;
    gnews: boolean;
    thenewsapi: boolean;
  };
  providers: ProviderRunStatus[];
  mergedArticleCount: number;
  finalProvider: string;
  finalErrorMessage?: string;
}

const WIDE_BROAD_FALLBACK_QUERY = "business OR finance OR economy";
const PROVIDER_COOLDOWN_MS = 5 * 60 * 1000;
const RATE_LIMIT_COOLDOWN_MS = 15 * 60 * 1000;
const providerCooldownByName = new Map<ProviderName, { until: number; reason: string }>();

function safeProviderErrorMessage(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((entry) => safeProviderErrorMessage(entry)).join(" | ");
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.error === "string") return obj.error;
    if (typeof obj.detail === "string") return obj.detail;
    if (typeof obj.title === "string") return obj.title;
    try {
      return JSON.stringify(obj).slice(0, 300);
    } catch {
      return "Unknown provider error";
    }
  }
  return "Unknown provider error";
}

const QUERY_EXPANSIONS: Record<string, string> = {
  apple: "Apple OR AAPL OR iPhone OR Apple earnings",
  aapl: "Apple stock OR Apple earnings",
  nvidia: "NVIDIA OR NVDA OR AI chips OR data center GPUs",
  nvda: "NVIDIA OR NVDA OR AI chips OR data center GPUs",
  tsla: "Tesla stock OR Tesla deliveries",
  spy: "S&P 500 OR SPY ETF",
  qqq: "Nasdaq 100 OR QQQ ETF",
  markets: "global markets OR stock market OR s&p 500 OR nasdaq",
  economy: "economy OR GDP OR jobs OR inflation OR federal reserve",
  banking: "banking OR banks OR credit OR treasury yields",
  "real estate": "real estate OR housing market OR mortgage rates",
  ai: "artificial intelligence OR AI stocks OR semiconductors",
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

const FOCUSED_QUERY_TERMS: Record<string, string[]> = {
  nvidia: ["nvidia", "nvda"],
  nvda: ["nvidia", "nvda"],
  apple: ["apple", "aapl"],
  aapl: ["apple", "aapl"],
  markets: ["market", "markets", "stocks", "nasdaq", "s&p", "dow"],
  economy: ["economy", "gdp", "jobs", "inflation", "recession"],
  banking: ["bank", "banks", "banking", "credit", "lending"],
  "real estate": ["real estate", "housing", "mortgage", "home sales"],
  ai: ["ai", "artificial intelligence", "machine learning", "semiconductor", "chip"],
};

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
  if (typeof input === "number") {
    const date = new Date(input * 1000);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }
  if (!input) return "";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "";
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

function resolveTimeWindow(timeRange: ProviderTimeRange): { fromDate: string; toDate: string } {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);
  if (timeRange === "today") {
    start.setHours(start.getHours() - 24);
  } else {
    // breaking and week both use a 7-day pull window; breaking is handled by UI/API ordering.
    start.setDate(start.getDate() - 7);
  }
  return {
    fromDate: start.toISOString(),
    toDate: end.toISOString(),
  };
}

function inTimeRange(publishedAt: string | undefined, timeRange: ProviderTimeRange): boolean {
  if (!publishedAt) return true;
  const value = new Date(publishedAt).getTime();
  if (!Number.isFinite(value)) return true;
  const ageMs = Date.now() - value;
  if (ageMs < 0) return true;
  if (timeRange === "today") return ageMs <= 24 * 60 * 60 * 1000;
  return ageMs <= 7 * 24 * 60 * 60 * 1000;
}

function isRateLimitError(message: string): boolean {
  return /ratelimited|too many requests|429|quota|limit exceeded/i.test(message);
}

function getProviderCooldown(provider: ProviderName): { until: number; reason: string } | null {
  const cooldown = providerCooldownByName.get(provider);
  if (!cooldown) return null;
  if (cooldown.until <= Date.now()) {
    providerCooldownByName.delete(provider);
    return null;
  }
  return cooldown;
}

function setProviderCooldown(provider: ProviderName, error: string): void {
  const ms = isRateLimitError(error) ? RATE_LIMIT_COOLDOWN_MS : PROVIDER_COOLDOWN_MS;
  providerCooldownByName.set(provider, {
    until: Date.now() + ms,
    reason: error,
  });
}

async function fetchFromNewsApi(
  query: string,
  limit: number,
  page: number,
  apiKey: string,
  timeRange: ProviderTimeRange
): Promise<ProviderArticle[]> {
  const expandedQuery = expandNewsQuery(query);
  const q = encodeURIComponent(expandedQuery);
  const { fromDate, toDate } = resolveTimeWindow(timeRange);
  const url = `https://newsapi.org/v2/everything?q=${q}&language=en&sortBy=publishedAt&from=${encodeURIComponent(
    fromDate
  )}&to=${encodeURIComponent(toDate)}&pageSize=${Math.min(
    50,
    limit
  )}&page=${Math.max(1, page)}`;
  const response = await fetch(url, {
    headers: { "X-Api-Key": apiKey },
    next: { revalidate: 900 },
  });
  const payload = (await response.json()) as {
    status?: string;
    code?: string;
    message?: string;
    totalResults?: number;
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
  if (!response.ok || payload.status === "error") {
    const safeMessage = safeProviderErrorMessage(payload.message) || `NewsAPI request failed (${response.status})`;
    const safeCode = payload.code || "newsapi_error";
    throw new Error(`${safeCode}: ${safeMessage}`);
  }
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

async function fetchFromGNews(
  query: string,
  limit: number,
  page: number,
  apiKey: string,
  timeRange: ProviderTimeRange
): Promise<ProviderArticle[]> {
  const expandedQuery = expandNewsQuery(query);
  const { fromDate, toDate } = resolveTimeWindow(timeRange);
  const endpoint = `https://gnews.io/api/v4/search?q=${encodeURIComponent(
    expandedQuery
  )}&lang=en&sortby=publishedAt&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(
    toDate
  )}&max=${Math.min(50, Math.max(1, limit))}&page=${Math.max(1, page)}&apikey=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    next: { revalidate: 900 },
  });
  const payload = (await response.json()) as {
    errors?: string[];
    articles?: Array<{
      title?: string;
      description?: string;
      content?: string;
      url?: string;
      image?: string;
      publishedAt?: string;
      source?: { name?: string };
    }>;
  };
  if (!response.ok || (payload.errors && payload.errors.length > 0)) {
    const msg = safeProviderErrorMessage(payload.errors?.[0]) || `GNews request failed (${response.status})`;
    throw new Error(`gnews_error: ${msg}`);
  }
  const articles =
    payload.articles?.map((article, index) => ({
      id: `gnews-${asId(article.url ?? article.title ?? `${index}`)}`,
      headline: article.title ?? "Untitled article",
      source: article.source?.name ?? "GNews",
      publishedAt: coerceDate(article.publishedAt),
      imageUrl: article.image ?? undefined,
      originalUrl: article.url ?? "",
      excerpt: article.description ?? article.content ?? "No summary available from provider.",
      content: article.content ?? undefined,
    })) ?? [];
  return limitArticles(articles, limit);
}

async function fetchFromTheNewsApi(
  query: string,
  limit: number,
  page: number,
  apiKey: string,
  timeRange: ProviderTimeRange
): Promise<ProviderArticle[]> {
  const expandedQuery = expandNewsQuery(query);
  const { fromDate, toDate } = resolveTimeWindow(timeRange);
  const endpoint = `https://api.thenewsapi.com/v1/news/all?api_token=${encodeURIComponent(
    apiKey
  )}&search=${encodeURIComponent(expandedQuery)}&language=en&sort=published_at&published_after=${encodeURIComponent(
    fromDate
  )}&published_before=${encodeURIComponent(toDate)}&limit=${Math.min(
    50,
    Math.max(1, limit)
  )}&page=${Math.max(1, page)}`;
  const response = await fetch(endpoint, {
    next: { revalidate: 900 },
  });
  const payload = (await response.json()) as {
    message?: string;
    error?: string;
    data?: Array<{
      title?: string;
      description?: string;
      snippet?: string;
      source?: string;
      url?: string;
      image_url?: string;
      published_at?: string;
    }>;
  };
  if (!response.ok || payload.error || payload.message) {
    const msg =
      safeProviderErrorMessage(payload.error) ||
      safeProviderErrorMessage(payload.message) ||
      `TheNewsAPI request failed (${response.status})`;
    throw new Error(`thenewsapi_error: ${msg}`);
  }
  const articles =
    payload.data?.map((article, index) => ({
      id: `thenewsapi-${asId(article.url ?? article.title ?? `${index}`)}`,
      headline: article.title ?? "Untitled article",
      source: article.source ?? "TheNewsAPI",
      publishedAt: coerceDate(article.published_at),
      imageUrl: article.image_url ?? undefined,
      originalUrl: article.url ?? "",
      excerpt: article.description ?? article.snippet ?? "No summary available from provider.",
      content: article.snippet ?? undefined,
    })) ?? [];
  return limitArticles(articles, limit);
}

export async function debugNewsApiQuery(params: {
  query: string;
  limit: number;
  page: number;
  timeRange: ProviderTimeRange;
}): Promise<NewsApiDebugResponse> {
  const apiKey = process.env.NEWS_API_KEY;
  const query = params.query.trim() || "business";
  const expandedQuery = expandNewsQuery(query);
  const { fromDate, toDate } = resolveTimeWindow(params.timeRange);
  const endpoint = `https://newsapi.org/v2/everything?q=${encodeURIComponent(
    expandedQuery
  )}&language=en&sortBy=publishedAt&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(
    toDate
  )}&pageSize=${Math.min(50, params.limit)}&page=${Math.max(1, params.page)}`;

  if (!apiKey) {
    return {
      provider: "newsapi",
      hasNewsApiKey: false,
      query,
      expandedQuery,
      endpoint,
      fromDate,
      toDate,
      rawArticleCount: 0,
      afterValidityCount: 0,
      afterRelevanceCount: 0,
      afterTimeRangeCount: 0,
      firstRawTitles: [],
      removedReasons: { missing_news_api_key: 1 },
      errorCode: "missing_api_key",
      errorMessage: "NEWS_API_KEY is not configured.",
    };
  }

  const response = await fetch(endpoint, {
    headers: { "X-Api-Key": apiKey },
    cache: "no-store",
  });
  const payload = (await response.json()) as {
    status?: string;
    code?: string;
    message?: string;
    totalResults?: number;
    articles?: Array<{
      title?: string;
      source?: { name?: string };
      publishedAt?: string;
      url?: string;
      description?: string;
      author?: string;
      urlToImage?: string;
      content?: string;
    }>;
  };

  const rawArticles = payload.articles ?? [];
  const removedReasons: Record<string, number> = {};
  const addReason = (reason: string) => {
    removedReasons[reason] = (removedReasons[reason] ?? 0) + 1;
  };

  const validityPassed: ProviderArticle[] = [];
  for (const item of rawArticles) {
    if (!item.title?.trim()) {
      addReason("missing_title");
      continue;
    }
    if (!item.url?.trim()) {
      addReason("missing_url");
      continue;
    }
    if (!item.source?.name?.trim()) {
      addReason("missing_source");
      continue;
    }
    validityPassed.push({
      id: `newsapi-${asId(item.url ?? item.title ?? "unknown")}`,
      headline: item.title,
      source: item.source.name,
      author: item.author ?? undefined,
      publishedAt: coerceDate(item.publishedAt),
      imageUrl: item.urlToImage ?? undefined,
      originalUrl: item.url,
      excerpt: item.description ?? item.content ?? "No summary available from provider.",
      content: item.content ?? undefined,
    });
  }

  const relevancePassed = validityPassed.filter((article) => isFinanceRelevant(article, query));
  const afterRelevanceCount = relevancePassed.length;
  if (afterRelevanceCount < validityPassed.length) {
    addReason("filtered_non_finance_relevance");
  }
  const timeRangePassed = relevancePassed.filter((article) =>
    inTimeRange(article.publishedAt, params.timeRange)
  );
  if (timeRangePassed.length < relevancePassed.length) {
    addReason("filtered_outside_time_range");
  }

  return {
    provider: "newsapi",
    hasNewsApiKey: true,
    query,
    expandedQuery,
    endpoint,
    fromDate,
    toDate,
    httpStatus: response.status,
    newsApiStatus: payload.status,
    newsApiTotalResults: payload.totalResults,
    rawArticleCount: rawArticles.length,
    afterValidityCount: validityPassed.length,
    afterRelevanceCount,
    afterTimeRangeCount: timeRangePassed.length,
    firstRawTitles: rawArticles.slice(0, 3).map((item) => item.title ?? "Untitled"),
    removedReasons,
    errorCode: payload.code,
    errorMessage: payload.status === "error" ? payload.message : undefined,
  };
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
  const providers: ProviderName[] = [];
  if (process.env.NEWS_API_KEY) providers.push("newsapi");
  if (process.env.GNEWS_API_KEY) providers.push("gnews");
  if (process.env.THENEWSAPI_KEY) providers.push("thenewsapi");
  if (process.env.FINNHUB_API_KEY) providers.push("finnhub");
  if (process.env.POLYGON_API_KEY) providers.push("polygon");
  if (process.env.ALPHA_VANTAGE_API_KEY) providers.push("alphavantage");
  return providers;
}

export function getProviderDebugStatuses(): ProviderDebugStatus[] {
  const allProviders: ProviderName[] = [
    "newsapi",
    "gnews",
    "thenewsapi",
    "finnhub",
    "polygon",
    "alphavantage",
  ];
  const configured = new Set(configuredProviders());
  return allProviders.map((provider) => {
    const cooldown = getProviderCooldown(provider);
    return {
      provider,
      configured: configured.has(provider),
      coolingDown: Boolean(cooldown),
      cooldownRemainingMs: cooldown ? Math.max(0, cooldown.until - Date.now()) : 0,
      lastError: cooldown?.reason,
    };
  });
}

function resolveQueryBatch(query: string, page: number, batchSize = 4): string[] {
  const perPage = batchSize;
  const normalized = query.trim().toLowerCase();
  if (normalized && normalized !== BROAD_NEWS_QUERY) {
    const directByPhrase = new Set<string>();
    const direct = new Set<string>();
    for (const candidate of BROAD_FINANCE_QUERIES) {
      if (normalized.includes(candidate.toLowerCase())) {
        directByPhrase.add(candidate);
        direct.add(candidate);
      }
    }
    const tokenized = normalized.split(/[\s,;/]+/).filter(Boolean);
    for (const token of tokenized) {
      for (const candidate of BROAD_FINANCE_QUERIES) {
        if (candidate.toLowerCase().includes(token)) {
          direct.add(candidate);
        }
      }
    }
    const exactBroadIndex = BROAD_FINANCE_QUERIES.findIndex(
      (candidate) => candidate.toLowerCase() === normalized
    );
    if (exactBroadIndex >= 0) {
      // A single broad keyword query (e.g. "business") should stay a single API request.
      return [query];
    }
    // If a user enters a broad phrase (e.g. "business finance markets"),
    // fan out to multiple broad queries instead of one strict full-string query.
    if (direct.size >= 2) {
      const selected = [...directByPhrase];
      let cursor = ((Math.max(1, page) - 1) * perPage) % BROAD_FINANCE_QUERIES.length;
      while (selected.length < perPage) {
        const candidate = BROAD_FINANCE_QUERIES[cursor];
        if (!selected.includes(candidate)) selected.push(candidate);
        cursor = (cursor + 1) % BROAD_FINANCE_QUERIES.length;
      }
      return selected.slice(0, perPage);
    }
    return [query];
  }

  // Keep request volume bounded while still rotating broad themes over pages.
  const start = ((Math.max(1, page) - 1) * perPage) % BROAD_FINANCE_QUERIES.length;
  const selected: string[] = [];
  for (let i = 0; i < perPage; i += 1) {
    selected.push(BROAD_FINANCE_QUERIES[(start + i) % BROAD_FINANCE_QUERIES.length]);
  }
  return selected;
}

function isFinanceRelevant(article: ProviderArticle, query: string): boolean {
  const haystack = `${article.headline} ${article.excerpt} ${article.source}`.toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();
  const broadQueryTerms = expandNewsQuery(query)
    .toLowerCase()
    .split(/\s+or\s+|\s+/)
    .filter((term) => term.length > 1)
    .map((term) => term.replace(/[^a-z0-9]/g, ""));
  const termMatch = FINANCE_RELEVANCE_TERMS.some((term) => haystack.includes(term));
  const broadQueryMatch =
    broadQueryTerms.length === 0 ||
    broadQueryTerms.some((term) => haystack.includes(term) || haystack.includes(term.toUpperCase()));

  if (!normalizedQuery || normalizedQuery === BROAD_NEWS_QUERY) {
    return termMatch || broadQueryMatch;
  }

  const focusedTerms =
    FOCUSED_QUERY_TERMS[normalizedQuery] ??
    [normalizedQuery]
      .flatMap((term) => term.split(/\s+/))
      .filter((term) => term.length > 1);
  const focusedQueryMatch = focusedTerms.some((term) => haystack.includes(term));

  return focusedQueryMatch && (termMatch || isTickerLike(query));
}

function dedupeArticles(items: ProviderArticle[]): ProviderArticle[] {
  const byKey = new Map<string, ProviderArticle>();
  for (const article of items) {
    const urlKey = article.originalUrl.trim().toLowerCase();
    const titleKey = article.headline.trim().toLowerCase().replace(/\s+/g, " ");
    const key = urlKey || titleKey;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, article);
      continue;
    }
    const existingTime = new Date(existing.publishedAt).getTime();
    const nextTime = new Date(article.publishedAt).getTime();
    const safeExisting = Number.isFinite(existingTime) ? existingTime : 0;
    const safeNext = Number.isFinite(nextTime) ? nextTime : 0;
    if (safeNext > safeExisting) {
      byKey.set(key, article);
    }
  }
  return [...byKey.values()].sort((a, b) => {
    const at = new Date(a.publishedAt).getTime();
    const bt = new Date(b.publishedAt).getTime();
    const safeA = Number.isFinite(at) ? at : 0;
    const safeB = Number.isFinite(bt) ? bt : 0;
    return safeB - safeA;
  });
}

export async function fetchProviderNews(
  query: string,
  limit: number,
  page: number,
  timeRange: ProviderTimeRange = "week",
  options?: { providerFilter?: ProviderName; editionFetch?: boolean }
): Promise<NewsProviderResponse | null> {
  const providers = configuredProviders().filter(
    (provider) => !options?.providerFilter || provider === options.providerFilter
  );
  if (providers.length === 0) return null;
  const normalizedQuery = query.trim().toLowerCase();
  const isBroadEditionFetch =
    Boolean(options?.editionFetch) &&
    page === 1 &&
    (!normalizedQuery || normalizedQuery === BROAD_NEWS_QUERY);
  const queryBatch = resolveQueryBatch(query, page, isBroadEditionFetch ? 8 : 4);
  const perQueryLimit = Math.max(
    4,
    Math.ceil(((isBroadEditionFetch ? limit * 4 : limit * 1.5) / Math.max(1, queryBatch.length)))
  );
  const runBatch = async (batch: string[]): Promise<RunBatchResult> => {
    const statusByProvider = new Map<ProviderName, ProviderRunStatus>();
    for (const provider of providers) {
      statusByProvider.set(provider, {
        provider,
        configured: true,
        attempted: false,
        status: "not_configured",
        articleCount: 0,
        cooldownRemainingMs: 0,
      });
    }
    const resolved = await Promise.all(
      providers.flatMap((provider) =>
        batch.map(async (singleQuery) => {
          const cooldown = getProviderCooldown(provider);
          if (cooldown) {
            const existing = statusByProvider.get(provider);
            statusByProvider.set(provider, {
              provider,
              configured: true,
              attempted: false,
              status: "skipped_cooldown",
              articleCount: existing?.articleCount ?? 0,
              cooldownRemainingMs: Math.max(0, cooldown.until - Date.now()),
              errorMessage: cooldown.reason,
            });
            return {
              provider,
              query: singleQuery,
              articles: [] as ProviderArticle[],
              error: null as string | null,
              skipped: "cooldown",
            } satisfies ProviderTaskResult;
          }
          try {
            let articles: ProviderArticle[] = [];
            if (provider === "newsapi" && process.env.NEWS_API_KEY) {
              articles = await fetchFromNewsApi(singleQuery, perQueryLimit, 1, process.env.NEWS_API_KEY, timeRange);
            } else if (provider === "gnews" && process.env.GNEWS_API_KEY) {
              articles = await fetchFromGNews(singleQuery, perQueryLimit, 1, process.env.GNEWS_API_KEY, timeRange);
            } else if (provider === "thenewsapi" && process.env.THENEWSAPI_KEY) {
              articles = await fetchFromTheNewsApi(
                singleQuery,
                perQueryLimit,
                1,
                process.env.THENEWSAPI_KEY,
                timeRange
              );
            } else if (provider === "finnhub" && process.env.FINNHUB_API_KEY) {
              articles = await fetchFromFinnhub(singleQuery, perQueryLimit, 1, process.env.FINNHUB_API_KEY);
            } else if (provider === "polygon" && process.env.POLYGON_API_KEY) {
              articles = await fetchFromPolygon(singleQuery, perQueryLimit, 1, process.env.POLYGON_API_KEY);
            } else if (provider === "alphavantage" && process.env.ALPHA_VANTAGE_API_KEY) {
              articles = await fetchFromAlphaVantage(singleQuery, perQueryLimit, 1, process.env.ALPHA_VANTAGE_API_KEY);
            }
            const existing = statusByProvider.get(provider);
            statusByProvider.set(provider, {
              provider,
              configured: true,
              attempted: true,
              status: "success",
              articleCount: (existing?.articleCount ?? 0) + articles.length,
              cooldownRemainingMs: 0,
            });
            return {
              provider,
              query: singleQuery,
              articles,
              error: null as string | null,
            } satisfies ProviderTaskResult;
          } catch (error) {
            const reason = error instanceof Error ? error.message : "Provider request failed";
            setProviderCooldown(provider, reason);
            const existing = statusByProvider.get(provider);
            statusByProvider.set(provider, {
              provider,
              configured: true,
              attempted: true,
              status: "error",
              articleCount: existing?.articleCount ?? 0,
              cooldownRemainingMs: Math.max(
                0,
                (getProviderCooldown(provider)?.until ?? 0) - Date.now()
              ),
              errorMessage: reason,
            });
            return {
              provider,
              query: singleQuery,
              articles: [] as ProviderArticle[],
              error: reason,
            } satisfies ProviderTaskResult;
          }
        })
      )
    );
    return { resolved, statusByProvider };
  };

  const primaryBatch = await runBatch(queryBatch);
  const primaryResolved = primaryBatch.resolved;
  let merged = dedupeArticles(primaryResolved.flatMap((entry) => entry.articles)).filter((article) =>
    isFinanceRelevant(article, queryBatch.join(" "))
  );
  let resolved = primaryResolved;
  const providerStatus = primaryBatch.statusByProvider;

  if (merged.length === 0) {
    const fallbackBatch = await runBatch([WIDE_BROAD_FALLBACK_QUERY]);
    const fallbackResolved = fallbackBatch.resolved;
    const fallbackMerged = dedupeArticles(fallbackResolved.flatMap((entry) => entry.articles)).filter((article) =>
      isFinanceRelevant(article, WIDE_BROAD_FALLBACK_QUERY)
    );
    for (const [provider, status] of fallbackBatch.statusByProvider.entries()) {
      providerStatus.set(provider, status);
    }
    if (fallbackMerged.length > 0) {
      merged = fallbackMerged;
      resolved = [...primaryResolved, ...fallbackResolved];
    }
  }

  const providerStats = Array.from(providerStatus.values()).map((entry) => ({
    provider: entry.provider,
    count: entry.articleCount,
  }));
  const errors = resolved
    .map((entry) => entry.error)
    .filter((entry): entry is string => Boolean(entry));
  const skippedCooldownReasons = resolved
    .filter((entry) => entry.skipped === "cooldown")
    .map((entry) => getProviderCooldown(entry.provider)?.reason ?? "");
  if (merged.length === 0 && (errors.length > 0 || skippedCooldownReasons.length > 0)) {
    const failureReasons = [...errors, ...skippedCooldownReasons].filter(Boolean);
    const allRateLimited =
      failureReasons.length > 0 && failureReasons.every((reason) => isRateLimitError(reason));
    return {
      provider: "error",
      query,
      fetchedAt: new Date().toISOString(),
      articles: [],
      totalAvailable: 0,
      providerStats,
      providerRunStatuses: Array.from(providerStatus.values()),
      errorMessage: allRateLimited
        ? "News provider rate limit reached. Try again later."
        : "Live provider request failed. Please retry later.",
    };
  }
  const start = (Math.max(1, page) - 1) * limit;
  const paginated = merged.slice(start, start + limit);

  return {
    provider: providers.join(",") || "none",
    query,
    fetchedAt: new Date().toISOString(),
    articles: paginated,
    totalAvailable: merged.length,
    providerStats,
    providerRunStatuses: Array.from(providerStatus.values()),
  };
}
