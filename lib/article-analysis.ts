import type { Brief, MarketImpact, Sentiment } from "./types";
import { isSecuritiesLegalNotice } from "./story-dedup";

const POSITIVE_WORDS = [
  "beat",
  "growth",
  "strong",
  "surge",
  "gain",
  "upgraded",
  "improved",
  "rally",
  "outperform",
  "cooling",
  "easing",
];

const NEGATIVE_WORDS = [
  "miss",
  "decline",
  "drop",
  "down",
  "cut",
  "warning",
  "risk",
  "concern",
  "lawsuit",
  "downgrade",
  "pressure",
  "sticky",
];

const HIGH_IMPACT_TERMS = [
  "federal reserve",
  "fed",
  "cpi",
  "inflation",
  "interest rates",
  "jobs report",
  "gdp",
  "nasdaq",
  "s&p 500",
  "earnings",
];

const MEDIUM_IMPACT_TERMS = [
  "guidance",
  "delivery",
  "etf",
  "sector",
  "forecast",
  "outlook",
  "policy",
  "bond yields",
];

const KEY_TERM_DEFINITIONS: Record<string, string> = {
  earnings: "A company's profit results reported for a quarter or year.",
  inflation: "The rate at which prices rise across the economy.",
  cpi: "Consumer Price Index, a common measure of inflation.",
  fed: "The U.S. Federal Reserve, which sets monetary policy.",
  guidance: "Management's outlook for future performance.",
  valuation: "How expensive an asset looks relative to earnings or growth.",
  etf: "Exchange-traded fund, a basket of assets traded like a stock.",
  "interest rates": "The cost of borrowing money, heavily influenced by central banks.",
  "bond yields": "Returns investors earn from bonds; they move with rates and inflation expectations.",
  revenue: "Total sales generated before subtracting expenses.",
  "market cap": "Total market value of a company (share price x shares outstanding).",
};

const DEFAULT_KEY_TERMS = ["earnings", "guidance", "valuation", "inflation", "interest rates"];

function scoreText(text: string, words: string[]): number {
  const lower = text.toLowerCase();
  return words.reduce((sum, word) => sum + (lower.includes(word) ? 1 : 0), 0);
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function stripQuotes(text: string): string {
  return text.replace(/^["'""]+|["'""]+$/g, "").trim();
}

function firstSentence(text: string): string {
  const cleaned = normalizeWhitespace(text);
  const match = cleaned.match(/^[^.!?]+[.!?]?/);
  return match ? normalizeWhitespace(match[0]) : cleaned;
}

function isWeakTopic(value: string): boolean {
  const topic = normalizeWhitespace(value);
  if (topic.length < 2) return true;
  if (/\.{2,}/.test(topic) || /["']/.test(topic)) return true;
  const words = topic.split(/\s+/);
  if (words.length <= 2) {
    const first = words[0]?.toLowerCase() ?? "";
    if (/^(the|a|an|of|in|on|at|to|for|with|from|confident|new|how|why|what|watch|live|breaking|update|just)$/i.test(first)) {
      return true;
    }
  }
  return false;
}

function combinedText(headline: string, excerpt: string): string {
  return normalizeWhitespace(`${headline} ${excerpt}`);
}

function splitSentences(text: string): string[] {
  return normalizeWhitespace(text)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => normalizeWhitespace(sentence))
    .filter((sentence) => sentence.length > 12);
}

function isLimitedPreview(excerpt: string): boolean {
  const cleaned = normalizeWhitespace(excerpt);
  return (
    !cleaned ||
    cleaned.length < 80 ||
    cleaned === "No summary available from provider."
  );
}

function formatPublishedContext(publishedAt?: string): string {
  if (!publishedAt) return "";
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return "";
  return ` on ${date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

function headlineCore(headline: string): string {
  return stripQuotes(normalizeWhitespace(headline.replace(/\.$/, "")));
}

function normalizeForCompare(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function overlapsHeadline(text: string, headline: string): boolean {
  const normalizedText = normalizeForCompare(text);
  const normalizedHeadline = normalizeForCompare(headline);
  if (!normalizedText || !normalizedHeadline) return false;
  if (normalizedText === normalizedHeadline) return true;
  const headlineStart = normalizedHeadline.slice(0, Math.min(40, normalizedHeadline.length));
  return normalizedText.startsWith(headlineStart);
}

function isNearDuplicate(candidate: string, existing: string[]): boolean {
  const normalized = normalizeForCompare(candidate);
  return existing.some((sentence) => {
    const other = normalizeForCompare(sentence);
    return other === normalized || other.includes(normalized) || normalized.includes(other);
  });
}

function cleanBullet(text: string, max = 140): string {
  let value = normalizeWhitespace(text.replace(/\.{3,}/g, "").replace(/\.\.\.$/, ""));
  if (value.length <= max) return value.endsWith(".") ? value : `${value}.`;
  value = value.slice(0, max).replace(/\s+\S*$/, "").trim();
  return value.endsWith(".") ? value : `${value}.`;
}

function formatSubjectList(subjects: string[]): string {
  if (subjects.length === 0) return "";
  if (subjects.length === 1) return subjects[0];
  if (subjects.length === 2) return `${subjects[0]} and ${subjects[1]}`;
  return `${subjects.slice(0, -1).join(", ")}, and ${subjects[subjects.length - 1]}`;
}

function extractMentionedSubjects(headline: string, excerpt: string): string[] {
  const text = `${headline} ${excerpt}`;
  const subjects = new Set<string>();
  const knownNames = [
    "Apple",
    "Microsoft",
    "NVIDIA",
    "Tesla",
    "Amazon",
    "Alphabet",
    "Google",
    "Meta",
    "Netflix",
    "Intel",
    "AMD",
    "JPMorgan",
    "Goldman Sachs",
    "Federal Reserve",
    "S&P 500",
    "Nasdaq",
  ];
  for (const name of knownNames) {
    if (new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text)) {
      subjects.add(name);
    }
  }
  const tickerMatches = text.match(/\b[A-Z]{2,5}\b/g) ?? [];
  const tickerBlocklist = new Set([
    "CEO",
    "CFO",
    "ETF",
    "GDP",
    "CPI",
    "FED",
    "USA",
    "USD",
    "AI",
    "NEW",
    "YORK",
    "LAW",
    "FIRM",
    "LLP",
    "INC",
    "LLC",
    "LTD",
    "PLC",
    "THE",
    "FOR",
    "AND",
    "PR",
    "WHY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
    "NASDAQ",
    "NYSE",
    "CLASS",
    "LEAD",
    "HAVE",
    "WITH",
    "FROM",
  ]);
  for (const ticker of tickerMatches) {
    if (!tickerBlocklist.has(ticker)) {
      subjects.add(ticker);
    }
  }
  const properNounMatches = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g) ?? [];
  for (const match of properNounMatches) {
    if (!["The", "This", "That", "Read", "Watch", "Breaking", "Update"].includes(match.split(" ")[0])) {
      subjects.add(match);
    }
  }
  return [...subjects].slice(0, 4);
}

type StoryTheme =
  | "earnings"
  | "rates"
  | "trade"
  | "merger"
  | "market"
  | "regulation"
  | "product"
  | "general";

function detectThemes(text: string): StoryTheme[] {
  const lower = text.toLowerCase();
  const themes: StoryTheme[] = [];
  if (/\bearnings|revenue|profit|guidance|quarter|results\b/.test(lower)) themes.push("earnings");
  if (/\bfed|interest rate|cpi|inflation|treasury|jobs report|monetary policy\b/.test(lower)) themes.push("rates");
  if (/\btariff|trade war|sanction|import|export\b/.test(lower)) themes.push("trade");
  if (/\bmerger|acquisition|takeover|buyout|deal\b/.test(lower)) themes.push("merger");
  if (/\bstock|shares|market|index|nasdaq|s&p|wall street\b/.test(lower)) themes.push("market");
  if (/\bregulat|lawsuit|antitrust|sec\b/.test(lower)) themes.push("regulation");
  if (/\blaunch|product|platform|service|chip|software\b/.test(lower)) themes.push("product");
  if (themes.length === 0) themes.push("general");
  return themes;
}

interface ArticlePreviewContext {
  headline: string;
  excerpt: string;
  source: string;
  publishedAt?: string;
  sentences: string[];
  limited: boolean;
  subjects: string[];
  themes: StoryTheme[];
}

function stripWireDateline(text: string): string {
  return normalizeWhitespace(
    text
      .replace(/^[A-Z\s]+,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}\s*\/PRNewswire\/\s*--\s*/i, "")
      .replace(/^Why:\s*/i, "")
  );
}

function buildArticlePreviewContext(
  headline: string,
  excerpt: string,
  source = "",
  publishedAt?: string
): ArticlePreviewContext {
  const cleanedHeadline = headlineCore(headline);
  const cleanedExcerpt = stripWireDateline(normalizeWhitespace(excerpt));
  const sentences = splitSentences(cleanedExcerpt);
  const text = combinedText(cleanedHeadline, cleanedExcerpt);
  return {
    headline: cleanedHeadline,
    excerpt: cleanedExcerpt,
    source: normalizeWhitespace(source),
    publishedAt,
    sentences,
    limited: isLimitedPreview(cleanedExcerpt),
    subjects: extractMentionedSubjects(cleanedHeadline, cleanedExcerpt),
    themes: detectThemes(text),
  };
}

function describeStoryFocus(ctx: ArticlePreviewContext): string {
  if (ctx.subjects.length > 0) {
    return `The available preview frames the story around ${formatSubjectList(ctx.subjects)} and the development described in the excerpt.`;
  }
  if (ctx.themes.includes("earnings")) {
    return "The preview appears to focus on company financial results and how the reported numbers compare with expectations.";
  }
  if (ctx.themes.includes("rates")) {
    return "The preview appears to focus on macro or policy developments that could influence borrowing costs and financial conditions.";
  }
  if (ctx.themes.includes("merger")) {
    return "The preview appears to focus on a corporate deal and how the parties involved may be repositioned.";
  }
  return "The preview suggests a business or finance development that readers can evaluate more fully in the linked source article.";
}

function pickEventSentence(ctx: ArticlePreviewContext): string {
  const candidate =
    ctx.sentences.find((sentence) => !overlapsHeadline(sentence, ctx.headline)) ??
    ctx.sentences[0];
  if (candidate && !overlapsHeadline(candidate, ctx.headline)) return candidate;
  if (ctx.sentences[0]) {
    return `The source preview describes the development as follows: ${ctx.sentences[0]}`;
  }
  return `Based on the available source preview, this story appears to cover ${ctx.headline.toLowerCase()}.`;
}

function buildWatchBullet(ctx: ArticlePreviewContext): string {
  const lower = ctx.excerpt.toLowerCase();
  if (/\bguidance|outlook|forecast|expects|expected\b/.test(lower)) {
    return "Watch whether management guidance or analyst expectations change after the full report is published.";
  }
  if (/\bquarter|results|earnings|revenue\b/.test(lower)) {
    return "Watch for the next official filing, earnings call, or follow-up report on the same topic.";
  }
  if (/\bfed|rate|inflation|cpi\b/.test(lower)) {
    return "Watch for the next policy statement, economic release, or market reaction tied to the same theme.";
  }
  if (/\bdeal|merger|acquisition|takeover\b/.test(lower)) {
    return "Watch for regulatory filings, counteroffers, or updates on whether the deal progresses.";
  }
  if (ctx.subjects.length > 0) {
    return `Watch for follow-up reporting on ${formatSubjectList(ctx.subjects)} from ${ctx.source || "the publisher"}.`;
  }
  return "Watch for follow-up reporting that adds detail beyond the current preview.";
}

export function estimateSentiment(text: string): {
  sentiment: Sentiment;
  confidence: number;
} {
  const positive = scoreText(text, POSITIVE_WORDS);
  const negative = scoreText(text, NEGATIVE_WORDS);
  const delta = positive - negative;
  if (positive > 0 && negative > 0 && Math.abs(delta) <= 1) {
    return { sentiment: "mixed", confidence: 68 };
  }
  if (delta >= 2) return { sentiment: "positive", confidence: Math.min(90, 70 + delta * 4) };
  if (delta <= -2) return { sentiment: "negative", confidence: Math.min(90, 70 + Math.abs(delta) * 4) };
  return { sentiment: "neutral", confidence: 64 };
}

export function estimateMarketImpact(text: string): MarketImpact {
  const lower = text.toLowerCase();
  const highScore = scoreText(lower, HIGH_IMPACT_TERMS);
  if (highScore >= 2) return "high";
  const mediumScore = scoreText(lower, MEDIUM_IMPACT_TERMS);
  if (highScore >= 1 || mediumScore >= 2) return "medium";
  return "low";
}

export function inferArticleType(text: string): "company" | "market" | "macro" | "etf" | "sector" {
  const lower = text.toLowerCase();
  if (/\b(etf|index|nasdaq|s&p 500|dow jones|qqq|spy|dia|vti)\b/.test(lower)) return "etf";
  if (/\b(cpi|inflation|federal reserve|fed|interest rates|macro|treasury|jobs)\b/.test(lower))
    return "macro";
  if (/\b(sector|industrials|energy|technology|financials|health care)\b/.test(lower))
    return "sector";
  if (/\b(markets|stocks|futures|wall street)\b/.test(lower)) return "market";
  return "company";
}

export function inferDisplayTopic(
  query: string,
  headline: string,
  articleType: ReturnType<typeof inferArticleType>
): string {
  const q = query.trim();
  if (q && !isWeakTopic(q)) {
    return q.toUpperCase() === q ? q : q;
  }

  const lower = headline.toLowerCase();
  if (/\bnvda|nvidia\b/.test(lower)) return "NVIDIA";
  if (/\baapl|apple\b/.test(lower)) return "Apple";
  if (/\bmsft|microsoft\b/.test(lower)) return "Microsoft";
  if (/\btsla|tesla\b/.test(lower)) return "Tesla";
  if (/\bamzn|amazon\b/.test(lower)) return "Amazon";
  if (/\bmeta|facebook\b/.test(lower)) return "Meta";
  if (/\bgoog|alphabet\b/.test(lower)) return "Alphabet";
  if (/\bspy|s&p 500\b/.test(lower)) return "S&P 500";
  if (/\bqqq|nasdaq\b/.test(lower)) return "Nasdaq";
  if (/\binflation|cpi\b/.test(lower)) return "Inflation";
  if (/\bfed|interest rates\b/.test(lower)) return "Interest rates";

  if (articleType === "macro") return "Macro";
  if (articleType === "etf") return "Index ETFs";
  if (articleType === "sector") return "Sector news";
  if (articleType === "market") return "Markets";
  return "Markets";
}

export function extractKeyTerms(text: string): { term: string; definition: string }[] {
  const lower = text.toLowerCase();
  const found = Object.entries(KEY_TERM_DEFINITIONS)
    .filter(([term]) => lower.includes(term))
    .slice(0, 5)
    .map(([term, definition]) => ({ term, definition }));

  if (found.length > 0) return found;
  return DEFAULT_KEY_TERMS.slice(0, 4).map((term) => ({
    term,
    definition: KEY_TERM_DEFINITIONS[term],
  }));
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function trimSummaryToWordTarget(paragraphs: string[], minWords: number, maxWords: number): string {
  let body = paragraphs.map((part) => normalizeWhitespace(part)).filter(Boolean).join(" ");

  if (countWords(body) < minWords) {
    const filler =
      "Follow-up reporting may add detail that is not visible in the initial preview, so readers should treat this summary as orientation rather than a final conclusion.";
    while (countWords(body) < minWords) {
      body = `${body} ${filler}`;
    }
  }

  if (countWords(body) > maxWords) {
    const words = body.split(/\s+/).slice(0, maxWords);
    body = words.join(" ");
    const lastPeriod = body.lastIndexOf(".");
    body = lastPeriod > 0 ? body.slice(0, lastPeriod + 1) : `${body}.`;
  }

  return body;
}

function buildThemeDeepDive(ctx: ArticlePreviewContext): string[] {
  const paragraphs: string[] = [];

  if (ctx.themes.includes("earnings")) {
    paragraphs.push(
      "Earnings-related headlines usually connect to three investor questions: whether revenue and profit beat or missed expectations, whether management updated its outlook, and whether the market had already priced in the result before the release. A beat can still lead to a selloff if guidance softens, while a miss can rally if the bad news was already expected. That is why the headline alone rarely tells the full earnings story."
    );
    paragraphs.push(
      "For fundamental investors, the most durable part of an earnings report is often the commentary about demand trends, margins, and capital allocation rather than a single quarterly figure. For passive holders of broad index funds, the story still matters because large index constituents can move SPY, QQQ, and sector ETFs when their results shift the aggregate earnings picture."
    );
  }

  if (ctx.themes.includes("rates")) {
    paragraphs.push(
      "Macro and interest-rate stories matter because they change the discount rate investors use to value future corporate cash flows. When inflation, jobs, or central-bank communication shifts expectations for policy, bond yields often move first and equities second. Rate-sensitive sectors such as real estate, utilities, and long-duration growth stocks frequently react more sharply than the broad market."
    );
    paragraphs.push(
      "Readers watching this theme should distinguish between the headline release and the trend. One CPI or jobs print rarely defines the entire cycle; markets care about whether data confirm or break a pattern the Fed has been emphasizing. That makes follow-up releases and official meeting statements as important as the initial report."
    );
  }

  if (ctx.themes.includes("trade")) {
    paragraphs.push(
      "Trade-policy news can affect companies through multiple channels: direct tariffs on goods, restrictions on technology exports, supply-chain rerouting costs, and uncertainty that delays business investment. Even firms without direct international sales can feel indirect effects through input costs and customer demand."
    );
  }

  if (ctx.themes.includes("merger")) {
    paragraphs.push(
      "Merger and acquisition headlines introduce event-driven uncertainty. Target companies often trade toward the proposed deal price, while acquirers can fall if investors question the strategic logic or financing. Regulatory review, shareholder votes, and financing conditions can take months to resolve, so the first announcement is usually only the opening chapter."
    );
  }

  if (ctx.themes.includes("regulation")) {
    paragraphs.push(
      "Regulatory and legal developments can reshape compliance costs, product timelines, and competitive dynamics. Markets sometimes treat litigation headlines as noise until a court ruling, settlement, or agency action makes the financial impact quantifiable. That is especially true for class-action notices and investor-deadline advertisements that precede any finding of wrongdoing."
    );
  }

  if (ctx.themes.includes("product")) {
    paragraphs.push(
      "Product and strategy announcements matter when they change a company's growth algorithm—new platforms, pricing models, major partnerships, or capacity investments. Investors typically ask whether the update expands the addressable market, protects existing share, or simply catches up to competitors who moved earlier."
    );
  }

  if (ctx.themes.includes("market")) {
    paragraphs.push(
      "Broad market stories often describe index-level moves, volatility shifts, or cross-asset reactions rather than a single company catalyst. These reports can help explain the environment in which individual stock headlines land— for example, a strong earnings report may get less credit during a risk-off session driven by macro fears."
    );
  }

  if (paragraphs.length === 0) {
    paragraphs.push(
      "Business headlines like this one usually fit into a wider mosaic of company performance, sector trends, and macro conditions. Even when the immediate market reaction seems modest, the topic can still be relevant for watchlists, sector exposure, and understanding which narratives investors are prioritizing this week."
    );
    paragraphs.push(describeStoryFocus(ctx));
  }

  return paragraphs;
}

/** FinBrief summary: long-form editorial overview (~500–700 words). */
export function buildFinBriefSummary(
  headline: string,
  excerpt: string,
  source = "",
  publishedAt?: string
): string {
  const ctx = buildArticlePreviewContext(headline, excerpt, source, publishedAt);
  const articleType = inferArticleType(combinedText(headline, excerpt));
  const why = buildWhyItMatters(headline, excerpt, articleType, source, publishedAt);
  const who = buildWhoIsAffected(headline, excerpt, articleType, source, publishedAt);

  const paragraphs: string[] = [];

  paragraphs.push(
    `This FinBrief summary examines "${ctx.headline}," a report ${ctx.source ? `published by ${ctx.source}` : "from a financial publisher"}${formatPublishedContext(publishedAt)}. The goal is to explain what the available source material says, why investors might care, and what context helps interpret the headline without replacing the original reporting.`
  );

  paragraphs.push(pickEventSentence(ctx));

  if (ctx.subjects.length > 0) {
    paragraphs.push(
      `The story centers on ${formatSubjectList(ctx.subjects)}. When a development names specific companies, indexes, or policy themes this directly, markets often reprice those assets first and then look for spillover effects across suppliers, competitors, and related sectors.`
    );
  }

  for (const sentence of ctx.sentences) {
    if (paragraphs.length >= 8) break;
    if (isNearDuplicate(sentence, paragraphs) || overlapsHeadline(sentence, ctx.headline)) continue;
    paragraphs.push(sentence);
  }

  if (ctx.limited) {
    paragraphs.push(
      "The publisher preview available to FinBrief is short, which means this summary relies heavily on the headline framing and the excerpt that was supplied. That limitation is common with wire services, syndicated feeds, and paywalled articles where only the opening lines are visible before clicking through."
    );
    paragraphs.push(describeStoryFocus(ctx));
  }

  paragraphs.push(why);
  paragraphs.push(who);

  paragraphs.push(...buildThemeDeepDive(ctx));

  paragraphs.push(
    `From a market-process perspective, the first reaction to stories like this is often headline-driven. Traders may reposition quickly based on the direction implied by the title, while longer-horizon investors usually wait for confirmation in filings, management commentary, or follow-up coverage. That gap between initial price action and later validation is one reason FinBrief separates a quick headline read from a fuller summary like this one.`
  );

  paragraphs.push(
    buildNeutralView() +
      " In practice, that means treating the publisher's full article, any official company or government release, and subsequent data points as the confirmation layer rather than assuming the first summary captures the entire story."
  );

  paragraphs.push(
    `Readers should also note what this summary cannot do. FinBrief does not reproduce the complete ${ctx.source || "publisher"} article, direct quotes beyond the excerpt, proprietary charts, or any paywalled analysis. When the underlying piece contains nuance—such as one-time charges, revised guidance, legal disclaimers, or methodological details in an economic report—those details may only appear in the source link.`
  );

  paragraphs.push(
    `If you are building a view on ${ctx.subjects.length > 0 ? formatSubjectList(ctx.subjects) : "this topic"}, a practical next step is to read the original story, then compare it with adjacent coverage from other reputable outlets. Look for agreement on the core fact pattern and disagreement on interpretation; that difference often marks where genuine uncertainty remains. ${buildWatchBullet(ctx)}`
  );

  if (ctx.source) {
    paragraphs.push(
      `${ctx.source} remains the primary citation for the underlying reporting${formatPublishedContext(publishedAt)}. FinBrief organizes the preview into a longer educational narrative so you can decide whether the full article is worth your time, but the publisher should always be treated as the authoritative record of what was reported.`
    );
  }

  return trimSummaryToWordTarget(paragraphs, 500, 700);
}

/** Three useful bullets: what happened, why it matters, what to watch. */
export function buildThirtySecondVersion(
  headline: string,
  excerpt: string,
  source = "",
  publishedAt?: string
): string {
  const ctx = buildArticlePreviewContext(headline, excerpt, source, publishedAt);
  const why = buildWhyItMatters(headline, excerpt, inferArticleType(combinedText(headline, excerpt)), source, publishedAt);

  const eventBullet = cleanBullet(pickEventSentence(ctx));
  const impactBullet = cleanBullet(firstSentence(why));
  const watchBullet = cleanBullet(buildWatchBullet(ctx));

  return [`• ${eventBullet}`, `• ${impactBullet}`, `• ${watchBullet}`].join("\n");
}

export function parseThirtySecondBullets(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.replace(/^[\s•\-*]+/, "").trim())
    .filter(Boolean);
}

export function buildWhyItMatters(
  headline: string,
  excerpt: string,
  articleType: ReturnType<typeof inferArticleType>,
  source = "",
  publishedAt?: string
): string {
  void articleType;
  const ctx = buildArticlePreviewContext(headline, excerpt, source, publishedAt);

  if (ctx.limited) {
    return [
      "Based on the available source preview, the full significance of this story is not yet clear from the excerpt alone.",
      ctx.subjects.length > 0
        ? `It may matter to readers following ${formatSubjectList(ctx.subjects)} once the complete article is available.`
        : "It may matter to readers tracking the topic named in the headline once the complete article is available.",
    ].join(" ");
  }

  const parts: string[] = [];
  const significanceSentence = ctx.sentences.find((sentence) =>
    /\bbecause|amid|after|could|may|expected|plan|announced|warn|cut|raise|deal|growth|decline|profit|loss\b/i.test(
      sentence
    )
  );

  if (significanceSentence && !overlapsHeadline(significanceSentence, ctx.headline)) {
    parts.push(significanceSentence);
  } else if (ctx.sentences[1] && !overlapsHeadline(ctx.sentences[1], ctx.headline)) {
    parts.push(`The preview adds that ${ctx.sentences[1].charAt(0).toLowerCase()}${ctx.sentences[1].slice(1)}`);
  }

  if (ctx.themes.includes("earnings")) {
    parts.push(
      "Earnings-related updates can change how investors judge recent business performance and near-term expectations."
    );
  } else if (ctx.themes.includes("rates")) {
    parts.push("Macro and policy updates can influence borrowing costs, bond yields, and rate-sensitive parts of the economy.");
  } else if (ctx.themes.includes("trade")) {
    parts.push("Trade-policy developments can affect companies with cross-border supply chains or overseas sales exposure.");
  } else if (ctx.themes.includes("merger")) {
    parts.push("Deal news can shift expectations for the companies involved and for similar assets in the same industry.");
  } else if (ctx.themes.includes("regulation")) {
    parts.push("Regulatory or legal developments can change compliance costs and strategic options for the parties involved.");
  } else if (ctx.themes.includes("product")) {
    parts.push("Product and strategy updates can matter when they change how a company competes or grows.");
  } else if (ctx.themes.includes("market")) {
    parts.push("Market-focused reports can matter when they change how investors interpret recent price action or index direction.");
  }

  if (ctx.subjects.length > 0 && parts.length < 4) {
    parts.push(
      `For readers following ${formatSubjectList(ctx.subjects)}, the preview offers an early look at a development reported by ${ctx.source || "the publisher"}.`
    );
  } else if (parts.length < 2) {
    parts.push(describeStoryFocus(ctx));
  }

  return parts.slice(0, 4).join(" ");
}

export function buildWhoIsAffected(
  headline: string,
  excerpt: string,
  articleType: ReturnType<typeof inferArticleType>,
  source = "",
  publishedAt?: string
): string {
  void articleType;
  const ctx = buildArticlePreviewContext(headline, excerpt, source, publishedAt);

  if (ctx.limited) {
    return [
      "Based on the available source preview, the parties most directly involved are those named in the headline.",
      ctx.subjects.length > 0
        ? `That includes ${formatSubjectList(ctx.subjects)}, although broader effects depend on details in the full article.`
        : "Broader effects depend on details that are not included in the preview.",
    ].join(" ");
  }

  const parts: string[] = [];

  if (ctx.subjects.length > 0) {
    parts.push(`The preview directly references ${formatSubjectList(ctx.subjects)}, making them the clearest audience for the update.`);
  }

  if (ctx.themes.includes("earnings") && ctx.subjects.length > 0) {
    parts.push(
      `Investors, analysts, and employees with exposure to ${formatSubjectList(ctx.subjects)} may reassess expectations after the reported update.`
    );
  } else if (ctx.themes.includes("rates")) {
    parts.push("Borrowers, savers, and institutions sensitive to interest-rate changes may feel downstream effects if the development shifts rate expectations.");
  } else if (ctx.themes.includes("trade")) {
    parts.push("Importers, exporters, and companies with international supply chains may be affected when trade-policy news changes cost or demand assumptions.");
  } else if (ctx.themes.includes("merger")) {
    parts.push("Employees, customers, and rival firms connected to the companies named in the report may be affected by deal progress or failure.");
  } else if (ctx.themes.includes("regulation")) {
    parts.push("Compliance teams, legal stakeholders, and competing firms in the same market may need to respond if the reported development changes the rules of the industry.");
  } else if (ctx.sentences[1]) {
    parts.push(`The excerpt also suggests relevance for readers tracking the same business context described by ${ctx.source || "the publisher"}.`);
  }

  if (parts.length < 2) {
    parts.push(`Readers researching the topic covered in ${ctx.source || "the source"} preview may use the story as an initial reference point.`);
  }

  return parts.slice(0, 4).join(" ");
}

export function buildBullCase(headline: string, excerpt: string, sentiment: Sentiment): string {
  const text = combinedText(headline, excerpt).toLowerCase();
  if (sentiment === "negative") {
    return "If conditions stabilize or the report proves less severe than feared, related assets could recover part of any initial selloff.";
  }
  if (text.includes("beat") || text.includes("growth") || text.includes("strong")) {
    return "Stronger-than-expected results or demand could support further gains if follow-up data confirms the trend.";
  }
  return "If later updates reinforce the headline, sentiment in related assets could improve.";
}

export function buildBearCase(headline: string, excerpt: string, sentiment: Sentiment): string {
  const text = combinedText(headline, excerpt).toLowerCase();
  if (sentiment === "positive") {
    return "If follow-up reports show weaker data or guidance, the initial optimism may fade and prices could give back gains.";
  }
  if (text.includes("miss") || text.includes("cut") || text.includes("warning")) {
    return "Weaker follow-through or downgraded outlooks could extend pressure on related stocks and sectors.";
  }
  return "If confirming data disappoints, risk appetite around related assets may weaken.";
}

export function buildNeutralView(): string {
  return "Headlines can move markets before the full picture is clear. Treat early reports as one input and look for confirmation in official data or company statements.";
}

export function buildEducationalSummary(headline: string, excerpt: string, query: string): string {
  void query;
  return buildFinBriefSummary(headline, excerpt);
}

/** @deprecated Use buildFinBriefSummary — kept for compatibility. */
export function buildLongSummary(headline: string, excerpt: string, query: string): string {
  void query;
  return buildFinBriefSummary(headline, excerpt);
}

export interface SecuritiesNoticeDetails {
  company: string;
  tickers: string[];
  lawFirm: string;
  actionLabel: string;
}

export function parseSecuritiesLegalNotice(headline: string, excerpt: string): SecuritiesNoticeDetails {
  const combined = `${headline} ${excerpt}`;
  const tickers = new Set<string>();

  for (const match of combined.matchAll(/\((?:NASDAQ|NYSE|AMEX):\s*([A-Z]{1,5})\)/gi)) {
    tickers.add(match[1].toUpperCase());
  }
  const deadlineTicker = headline.match(/\b([A-Z]{2,5})\s+Deadline:/i);
  if (deadlineTicker?.[1]) tickers.add(deadlineTicker[1].toUpperCase());

  let company = "";
  const companyPatterns = [
    /Lead\s+(.+?)\s+Securities/i,
    /Investors.*?Lead\s+(.+?)(?:\s+Securities|\.|$)/i,
    /(?:stock of|shares of)\s+([A-Z][A-Za-z0-9&,.\s-]{2,60}?)(?:\s+\(|\.|,|$)/i,
    /reminds\s+(?:purchasers|sellers|investors)[^,.]{0,80}?\s+([A-Z][A-Za-z0-9&,.\s-]{2,60}?)(?:\s+\(|\.|,|$)/i,
  ];
  for (const pattern of companyPatterns) {
    const match = combined.match(pattern);
    if (match?.[1]) {
      company = normalizeWhitespace(match[1].replace(/\.$/, ""));
      break;
    }
  }

  const lawFirm = /rosen\s*law/i.test(combined) ? "Rosen Law Firm" : "A law firm";
  const actionLabel = /lead plaintiff|class action|securities fraud|investor deadline/i.test(combined)
    ? "securities class action notice"
    : "investor legal notice";

  return {
    company:
      company ||
      (tickers.size > 0 ? `the company (${[...tickers].join(", ")})` : "the company named in the release"),
    tickers: [...tickers],
    lawFirm,
    actionLabel,
  };
}

function buildSecuritiesLegalSummary(
  details: SecuritiesNoticeDetails,
  source: string,
  publishedAt?: string
): string {
  const tickerNote =
    details.tickers.length > 0 ? ` (${details.tickers.join(", ")})` : "";
  const paragraphs = [
    `${details.lawFirm} published a ${details.actionLabel} on ${source || "a newswire"} regarding ${details.company}${tickerNote}. FinBrief flags this item because wire releases of this type appear frequently in finance feeds, but they are promotional legal notices rather than independent journalism.`,
    "A securities class action notice is typically issued by a plaintiff-side law firm seeking shareholders who purchased shares during a defined period and allegedly suffered losses. The notice invites investors to contact the firm before a lead-plaintiff deadline. It does not mean a court has ruled that the company did anything wrong, and it does not guarantee that any recovery will occur.",
    `For holders of ${details.company}${tickerNote}, the practical meaning is procedural: you may receive more mail, see additional headlines, and need to decide whether to ignore the notice, monitor court dockets, or consult your own legal or financial advisors. FinBrief does not provide legal advice and cannot determine eligibility from the preview alone.`,
    "These releases often follow sharp stock declines because law firms market their services after volatility attracts attention. That timing can make the notices feel like major news even when the underlying business fundamentals have not changed overnight. Separating market narrative from legal process is important for long-term investors who do not want to react to every press release in their feed.",
    "Lead-plaintiff status matters in U.S. class actions because the lead investor or group helps select counsel and influences litigation strategy. Competing firms sometimes publish similar notices about the same company around the same time, which is one reason readers may see multiple near-identical headlines with different deadlines or slightly different wording.",
    "From a portfolio perspective, a legal notice is not the same as an earnings miss, a guidance cut, or a regulatory enforcement action with immediate financial consequences. Until a complaint survives dismissal, discovery proceeds, or a settlement is approved, the direct economic impact on the business can remain uncertain. Traders may still react to headline risk, but that reaction can fade if no new factual allegations emerge.",
    "If you own the stock directly, consider whether the notice adds information beyond what you already knew from price action and prior disclosures. If you own the name only through a broad ETF, the exposure is indirect and usually small unless the company is a top holding. Either way, the authoritative documents are the court filings and company SEC disclosures, not the advertisement on the newswire.",
    "FinBrief summarizes this notice so you can recognize the format quickly: who issued it, which company it references, and why it is not equivalent to investigative reporting. Read the original release for deadline dates, purchase-period definitions, and contact instructions if you believe you may be affected.",
    `${details.lawFirm} remains the publisher of the underlying notice${formatPublishedContext(publishedAt)}. Treat this long summary as educational context only and rely on the source link plus qualified professionals for decisions about participation in any legal action.`,
  ];

  return trimSummaryToWordTarget(paragraphs, 500, 700);
}

function buildSecuritiesLegalThirtySecond(details: SecuritiesNoticeDetails): string {
  const tickerNote = details.tickers.length > 0 ? ` (${details.tickers.join(", ")})` : "";
  return [
    `• ${details.lawFirm} advertised a ${details.actionLabel} related to ${details.company}${tickerNote}.`,
    "• These notices often follow stock price drops; they do not mean a lawsuit has already succeeded.",
    "• Check the original PRNewswire release for lead-plaintiff deadlines and whether you may be affected.",
  ].join("\n");
}

function buildSecuritiesLegalWhyItMatters(details: SecuritiesNoticeDetails): string {
  return [
    `Investors holding ${details.company}${details.tickers.length > 0 ? ` (${details.tickers.join(", ")})` : ""} may want to know about the advertised legal notice, but it is not the same as a court ruling or settlement.`,
    "Securities lawsuit notices can create headline noise without immediately changing company fundamentals.",
    "Treat this as legal marketing content until confirmed by court filings or independent reporting.",
  ].join(" ");
}

function buildSecuritiesLegalExcerpt(details: SecuritiesNoticeDetails, source: string): string {
  const tickerNote = details.tickers.length > 0 ? ` (${details.tickers.join(", ")})` : "";
  return `${details.lawFirm} issued a ${details.actionLabel} on ${source || "PRNewswire"} about ${details.company}${tickerNote}. Open the source link for the full legal notice.`;
}

/** Rewrite boilerplate legal-notice copy and refresh long-form summaries for display. */
export function enrichArticleCopy(brief: Brief): Brief {
  if (isSecuritiesLegalNotice(brief)) {
    const details = parseSecuritiesLegalNotice(brief.headline, brief.excerpt);
    return {
      ...brief,
      excerpt: buildSecuritiesLegalExcerpt(details, brief.source),
      summary: buildSecuritiesLegalSummary(details, brief.source, brief.publishedAt),
      thirtySecondVersion: buildSecuritiesLegalThirtySecond(details),
      whatHappened: buildSecuritiesLegalExcerpt(details, brief.source),
      whyItMatters: buildSecuritiesLegalWhyItMatters(details),
    };
  }

  return {
    ...brief,
    summary: buildFinBriefSummary(brief.headline, brief.excerpt, brief.source, brief.publishedAt),
  };
}
