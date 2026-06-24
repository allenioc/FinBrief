export const BROAD_NEWS_QUERY = "broad-business-finance";

/** Target number of articles stored in the once-daily broad dashboard edition. */
export const DAILY_EDITION_ARTICLE_LIMIT = 20;

/** Minimum articles to persist when the daily fetch returns enough unique stories. */
export const DAILY_EDITION_ARTICLE_MIN = 15;

/** Minimum usable stories before a live fetch may replace an existing daily edition. */
export const DAILY_EDITION_REPLACEMENT_MIN = 12;

/** Dashboard Top Stories targets (client-side layout only). */
export const DASHBOARD_TOP_STORIES_MIN = 11;
export const DASHBOARD_TOP_STORIES_MAX = 15;

/** Stories shown per topic view from the saved daily edition. */
export const TOPIC_STORIES_MAX = 3;

/** Minimum wait between successful live provider fetches for the daily edition. */
export const SUCCESS_FETCH_COOLDOWN_MS = 2 * 60 * 60 * 1000;

/** After a failed live fetch, wait before retrying providers. */
export const FAILURE_RETRY_COOLDOWN_MS = 30 * 60 * 1000;

export const BROAD_FINANCE_QUERIES = [
  "business",
  "finance",
  "markets",
  "economy",
  "stock market",
  "banking",
  "technology business",
  "real estate",
  "inflation",
  "interest rates",
  "jobs",
  "startups",
  "mergers and acquisitions",
  "earnings",
  "global markets",
  "consumer spending",
  "corporate news",
  "energy markets",
  "retail business",
  "trade",
  "central banks",
] as const;

