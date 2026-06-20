export const BROAD_NEWS_QUERY = "broad-business-finance";

/** Target number of articles stored in the once-daily broad dashboard edition. */
export const DAILY_EDITION_ARTICLE_LIMIT = 20;

/** Minimum articles to persist when the daily fetch returns enough unique stories. */
export const DAILY_EDITION_ARTICLE_MIN = 15;

/** Dashboard Top Stories targets (client-side layout only). */
export const DASHBOARD_TOP_STORIES_MIN = 11;
export const DASHBOARD_TOP_STORIES_MAX = 15;

/** Stories shown per topic view from the saved daily edition. */
export const TOPIC_STORIES_MAX = 3;

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

