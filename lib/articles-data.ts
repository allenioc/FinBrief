import type { Brief, RecommendedItem } from "./types";
import { ARTICLE_IMAGES } from "./article-images";
import { toTopicSlug } from "./slug";

function rec(
  items: { label: string; kind: RecommendedItem["kind"]; slug?: string; briefId?: string }[]
): RecommendedItem[] {
  return items.map((i) => ({
    label: i.label,
    kind: i.kind,
    href: i.briefId ? `/brief/${i.briefId}` : `/topic/${i.slug ?? toTopicSlug(i.label)}`,
  }));
}

export const MOCK_BRIEFS: Brief[] = [
  {
    id: "aapl-earnings-q1",
    headline: "Apple reports stronger-than-expected services revenue",
    source: "Reuters",
    author: "Reuters Markets Staff",
    publishedAt: "2026-06-03T14:30:00Z",
    imageUrl: ARTICLE_IMAGES.aapl.url,
    imageAlt: ARTICLE_IMAGES.aapl.alt,
    originalUrl: "https://www.reuters.com/markets/",
    excerpt:
      "Apple Inc posted quarterly results on Thursday, with its services business outperforming expectations as iPhone revenue held steady...",
    summary:
      "Apple's latest quarter highlighted continued strength in services — apps, cloud, and subscriptions — while iPhone revenue landed near expectations. Investors often view this mix shift as a move toward more recurring, higher-margin revenue. The report does not eliminate hardware cyclicality but reinforces Apple's ecosystem monetization story. FinBrief explains the results in plain language without reproducing the full publisher article.",
    thirtySecondVersion:
      "Apple beat on services, iPhone was in line, and investors are focused on whether subscription growth can keep smoothing hardware cycles.",
    whatHappened:
      "Apple released quarterly earnings showing services revenue above analyst estimates. iPhone and Mac revenue were broadly in line with consensus, and management emphasized growth in the installed base of active devices.",
    whyItMatters:
      "Services carry higher margins and repeat each month, which can make earnings more predictable than one-off device upgrades. A stronger services mix may influence how investors value the stock relative to pure hardware peers.",
    whoIsAffected:
      "Apple shareholders, mega-cap tech ETFs (especially QQQ), semiconductor and supply-chain names tied to iPhone builds, and competitors in cloud and app marketplaces.",
    ticker: "AAPL",
    topic: "Earnings",
    sentiment: "positive",
    sentimentConfidence: 82,
    marketImpact: "medium",
    articleType: "company news",
    keyAffectedAssets: ["AAPL", "QQQ", "XLK", "MSFT", "GOOGL"],
    relatedAssets: [
      { symbol: "AAPL", name: "Apple Inc.", type: "stock" },
      { symbol: "QQQ", name: "Nasdaq-100 ETF", type: "etf" },
      { symbol: "XLK", name: "Technology Select Sector", type: "sector" },
    ],
    keyTerms: [
      { term: "Revenue", definition: "Total money a company earns from sales and services before expenses." },
      { term: "Earnings", definition: "Profit after costs; often reported per share for public companies." },
      { term: "Guidance", definition: "Management's outlook for future quarters — investors compare it to their own models." },
      { term: "Valuation", definition: "How expensive a stock looks relative to earnings, growth, or peers." },
      { term: "Market cap", definition: "Total market value of a company's shares (price × shares outstanding)." },
    ],
    bullCase:
      "Services growth may lift margins and reduce reliance on annual iPhone upgrade waves. A large installed base can support long-term subscription revenue.",
    bearCase:
      "Hardware still drives the majority of sales. Weak phone demand or China headwinds could offset services strength in total results.",
    neutralView:
      "The quarter was solid but not transformative — investors may wait for clearer evidence that services growth accelerates faster than hardware slows.",
    risks: [
      "Regulatory pressure on app store fees",
      "Slower consumer upgrades in a weak macro environment",
      "Foreign exchange moves affecting international revenue",
    ],
    thingsToWatch: [
      "Next quarter iPhone unit commentary",
      "Services gross margin trends",
      "China demand updates on the earnings call",
    ],
    dataSnapshot: {
      kind: "stock",
      price: "$198.42",
      dailyChange: "+$2.18",
      dailyChangePercent: 1.11,
      marketCap: "$3.05T",
      peRatio: "31.2x",
      volume: "48.2M",
      sector: "Technology",
      earningsDate: "Next report: Jul 2026 (est.)",
    },
    recommendedNext: rec([
      { label: "QQQ", kind: "etf", slug: "qqq" },
      { label: "MSFT", kind: "ticker", slug: "msft" },
      { label: "Consumer tech", kind: "sector", slug: "ai-stocks" },
      { label: "Earnings", kind: "topic", slug: "aapl" },
      { label: "China sales", kind: "topic", slug: "aapl" },
      { label: "QQQ AI spending story", kind: "story", briefId: "qqq-ai-spending" },
    ]),
    sourceLinks: [
      { name: "Reuters", url: "https://www.reuters.com/markets/" },
      { name: "Apple Investor Relations", url: "https://investor.apple.com/" },
    ],
  },
  {
    id: "tsla-delivery-update",
    headline: "Tesla vehicle deliveries come in below some forecasts",
    source: "Bloomberg",
    author: "Dana Hull",
    publishedAt: "2026-06-02T09:15:00Z",
    imageUrl: ARTICLE_IMAGES.tsla.url,
    imageAlt: ARTICLE_IMAGES.tsla.alt,
    originalUrl: "https://www.bloomberg.com/news/",
    excerpt:
      "Tesla Inc handed over fewer vehicles last quarter than some analysts projected, according to figures released Tuesday...",
    summary:
      "Tesla's quarterly delivery count missed the high end of Wall Street expectations, reigniting questions about EV demand and pricing competition. The shortfall was most visible in certain international markets, while U.S. volumes were mixed. Delivery data arrives before full financial results, so markets often react quickly. This FinBrief summary is educational and links to the original Bloomberg reporting.",
    thirtySecondVersion:
      "Tesla delivered fewer cars than some analysts expected — investors are watching demand, pricing, and margins ahead of earnings.",
    whatHappened:
      "Tesla published Q2 delivery figures below the top end of analyst ranges. Regional data pointed to softer Europe volumes versus some forecasts.",
    whyItMatters:
      "Deliveries are a leading indicator of automotive revenue and factory utilization. Misses can trigger estimate cuts before official earnings.",
    whoIsAffected:
      "Tesla investors, EV competitors, battery and auto suppliers, and growth-heavy indices with large TSLA weighting.",
    ticker: "TSLA",
    topic: "Deliveries",
    sentiment: "negative",
    sentimentConfidence: 78,
    marketImpact: "high",
    articleType: "company news",
    keyAffectedAssets: ["TSLA", "RIVN", "LCID", "QQQ", "Auto sector"],
    relatedAssets: [
      { symbol: "TSLA", name: "Tesla Inc.", type: "stock" },
      { symbol: "QQQ", name: "Nasdaq-100 ETF", type: "etf" },
    ],
    keyTerms: [
      { term: "Deliveries", definition: "Vehicles transferred to customers — used as a near-term demand signal." },
      { term: "Guidance", definition: "Forward-looking comments from management about expected business trends." },
      { term: "Valuation", definition: "Market price relative to earnings or growth — high valuations need strong growth to justify." },
      { term: "Market cap", definition: "Total value of all Tesla shares in the market." },
    ],
    bullCase:
      "New models, price cuts stimulating demand, and energy storage growth could support a rebound in volumes.",
    bearCase:
      "Competitive pricing and softer demand may compress margins if costs do not fall as fast as prices.",
    neutralView:
      "One delivery quarter rarely defines a multi-year trend — investors may need two to three prints to confirm direction.",
    risks: ["Aggressive price competition", "Regulatory changes to EV incentives", "Supply chain bottlenecks"],
    thingsToWatch: ["Next earnings call margin commentary", "China weekly insurance registrations", "Cybertruck ramp data"],
    dataSnapshot: {
      kind: "stock",
      price: "$178.65",
      dailyChange: "-$6.42",
      dailyChangePercent: -3.47,
      marketCap: "$568B",
      peRatio: "62.8x",
      volume: "112.4M",
      sector: "Consumer Discretionary",
      earningsDate: "Next report: Jul 2026 (est.)",
    },
    recommendedNext: rec([
      { label: "Semiconductors", kind: "sector", slug: "semiconductors" },
      { label: "QQQ", kind: "etf", slug: "qqq" },
      { label: "Auto sector", kind: "sector", slug: "tsla" },
      { label: "AAPL earnings", kind: "story", briefId: "aapl-earnings-q1" },
    ]),
    sourceLinks: [
      { name: "Bloomberg", url: "https://www.bloomberg.com/news/" },
      { name: "Tesla IR", url: "https://ir.tesla.com/" },
    ],
  },
  {
    id: "spy-fed-commentary",
    headline: "Fed officials signal patience on rate cuts amid sticky inflation data",
    source: "Wall Street Journal",
    author: "Nick Timiraos",
    publishedAt: "2026-06-01T16:45:00Z",
    imageUrl: ARTICLE_IMAGES.fed.url,
    imageAlt: ARTICLE_IMAGES.fed.alt,
    originalUrl: "https://www.wsj.com/economy/",
    excerpt:
      "Federal Reserve policymakers indicated they are in no rush to lower interest rates, citing uneven progress on inflation...",
    summary:
      "Fed speakers this week leaned cautious on near-term rate cuts, emphasizing data dependence and uneven disinflation. Markets had priced some easing later this year; commentary pushed investors to reconsider timing. Higher-for-longer rates affect stocks, bonds, and housing differently. FinBrief summarizes public remarks — read the full WSJ piece at the source link.",
    thirtySecondVersion:
      "The Fed sounds patient on rate cuts until inflation cools more convincingly — bonds and stocks are recalibrating.",
    whatHappened:
      "Multiple Fed officials said policy would stay restrictive until inflation shows durable improvement, especially in services.",
    whyItMatters:
      "Interest rates influence mortgage costs, corporate borrowing, and the discount rate investors use to value stocks.",
    whoIsAffected:
      "Broad equity indexes (SPY, VTI), rate-sensitive growth stocks, banks, real estate, and bond investors.",
    ticker: "SPY",
    topic: "Interest rates",
    sentiment: "neutral",
    sentimentConfidence: 85,
    marketImpact: "high",
    articleType: "macro news",
    keyAffectedAssets: ["SPY", "TLT", "QQQ", "XLF", "Bonds"],
    relatedAssets: [
      { symbol: "SPY", name: "S&P 500 ETF", type: "etf" },
      { symbol: "TLT", name: "Long-Term Treasury ETF", type: "etf" },
    ],
    keyTerms: [
      { term: "Interest rates", definition: "The cost of borrowing money — set by the Fed for short-term policy." },
      { term: "Inflation", definition: "Rising average prices over time — erodes purchasing power." },
      { term: "Bond yields", definition: "Return investors earn on government and corporate debt — move opposite to prices." },
      { term: "ETF", definition: "Exchange-traded fund — a basket of assets you can buy like a stock." },
      { term: "Index fund", definition: "Fund designed to track a market index such as the S&P 500." },
    ],
    bullCase:
      "A steady economy with controlled inflation could support earnings without a deep recession.",
    bearCase:
      "Restrictive policy for longer may pressure valuations for growth and housing-linked assets.",
    neutralView:
      "Markets may chop sideways until CPI and jobs data clarify whether cuts arrive in late 2026 or later.",
    risks: ["Inflation reacceleration", "Labor market surprise strength", "Fiscal policy shifts"],
    thingsToWatch: ["Next CPI and jobs reports", "Fed minutes", "10-year Treasury yield moves"],
    dataSnapshot: {
      kind: "etf",
      tracks: "S&P 500 Index",
      topHoldings: ["AAPL", "MSFT", "NVDA", "AMZN", "META"],
      expenseRatio: "0.09%",
      dailyChange: "+$1.12",
      dailyChangePercent: 0.24,
      relatedSectors: ["Technology", "Financials", "Health Care"],
      macroFactors: ["Fed policy path", "Inflation", "Labor market"],
    },
    recommendedNext: rec([
      { label: "QQQ", kind: "etf", slug: "qqq" },
      { label: "DIA", kind: "etf", slug: "dia" },
      { label: "VTI", kind: "etf", slug: "vti" },
      { label: "Interest Rates", kind: "topic", slug: "interest-rates" },
      { label: "Inflation", kind: "topic", slug: "inflation" },
      { label: "CPI story", kind: "story", briefId: "inflation-cpi-print" },
    ]),
    sourceLinks: [
      { name: "Wall Street Journal", url: "https://www.wsj.com/economy/" },
      { name: "Federal Reserve", url: "https://www.federalreserve.gov/" },
    ],
  },
  {
    id: "qqq-ai-spending",
    headline: "Major cloud providers raise capex guidance on AI infrastructure",
    source: "Financial Times",
    author: "Madhumita Murgia",
    publishedAt: "2026-05-31T11:20:00Z",
    imageUrl: ARTICLE_IMAGES.aiChips.url,
    imageAlt: ARTICLE_IMAGES.aiChips.alt,
    originalUrl: "https://www.ft.com/technology/",
    excerpt:
      "Leading technology groups told investors they plan to spend more on data centres and AI chips this year than previously forecast...",
    summary:
      "Hyperscale cloud companies raised capital expenditure guidance tied to AI servers, networking, and data centers. Investors are weighing long-term growth against near-term free cash flow pressure. The trend matters for Nasdaq-heavy portfolios and chip supply chains. FinBrief provides an original educational summary — not a copy of FT's full article.",
    thirtySecondVersion:
      "Big tech is spending more on AI infrastructure — good for growth narratives, but investors watch cash flow.",
    whatHappened:
      "Several cloud giants increased forward capex outlooks for GPU clusters and data center expansion.",
    whyItMatters:
      "QQQ and technology sector ETFs hold many of these companies; capex cycles move estimates for semiconductors and networking.",
    whoIsAffected:
      "Mega-cap tech holders, semiconductor ETFs, enterprise software, and power/infrastructure suppliers.",
    ticker: "QQQ",
    topic: "AI spending",
    sentiment: "positive",
    sentimentConfidence: 80,
    marketImpact: "medium",
    articleType: "ETF/index news",
    keyAffectedAssets: ["QQQ", "SMH", "NVDA", "MSFT", "GOOGL"],
    relatedAssets: [
      { symbol: "QQQ", name: "Nasdaq-100 ETF", type: "etf" },
      { symbol: "SMH", name: "Semiconductor ETF", type: "etf" },
    ],
    keyTerms: [
      { term: "ETF", definition: "Exchange-traded fund tracking a basket of stocks — trades on an exchange." },
      { term: "Index fund", definition: "Passive fund matching an index like the Nasdaq-100." },
      { term: "Valuation", definition: "How the market prices future growth versus current earnings." },
      { term: "Market cap", definition: "Size of companies inside an index influences ETF performance." },
    ],
    bullCase:
      "AI infrastructure may unlock new enterprise workloads and platform revenues over several years.",
    bearCase:
      "Heavy spending can reduce free cash flow if monetization lags utilization.",
    neutralView:
      "Returns depend on ROI timelines — investors may differentiate winners vs over-spenders over time.",
    risks: ["ROI below expectations", "Power and land constraints", "Regulatory scrutiny on AI"],
    thingsToWatch: ["Next hyperscaler earnings", "GPU supply commentary", "Enterprise AI adoption surveys"],
    dataSnapshot: {
      kind: "etf",
      tracks: "Nasdaq-100 Index",
      topHoldings: ["AAPL", "MSFT", "NVDA", "AMZN", "AVGO"],
      expenseRatio: "0.20%",
      dailyChange: "+$2.45",
      dailyChangePercent: 0.58,
      relatedSectors: ["Technology", "Communication Services"],
      macroFactors: ["AI investment cycle", "Interest rates", "IT budgets"],
    },
    recommendedNext: rec([
      { label: "NVDA", kind: "ticker", slug: "nvda" },
      { label: "Semiconductors", kind: "sector", slug: "semiconductors" },
      { label: "AI Stocks", kind: "sector", slug: "ai-stocks" },
      { label: "Data centers", kind: "topic", slug: "qqq" },
      { label: "AAPL earnings", kind: "story", briefId: "aapl-earnings-q1" },
    ]),
    sourceLinks: [
      { name: "Financial Times", url: "https://www.ft.com/technology/" },
    ],
  },
  {
    id: "inflation-cpi-print",
    headline: "Latest CPI report shows inflation cooling slightly month over month",
    source: "Bureau of Labor Statistics",
    author: "BLS Economic News Release",
    publishedAt: "2026-05-30T08:00:00Z",
    imageUrl: ARTICLE_IMAGES.inflation.url,
    imageAlt: ARTICLE_IMAGES.inflation.alt,
    originalUrl: "https://www.bls.gov/cpi/",
    excerpt:
      "The Consumer Price Index for All Urban Consumers rose 0.2 percent in May on a seasonally adjusted basis...",
    summary:
      "The latest CPI release showed a modest easing in month-over-month headline inflation, with core measures decelerating in several services categories. Shelter costs remain elevated and continue to draw policy attention. Bond markets moved yields lower while equities reacted positively to implied rate-cut odds. FinBrief explains the release using public data — not a reproduction of the full BLS report.",
    thirtySecondVersion:
      "Inflation cooled slightly last month — markets care because it influences Fed rate decisions.",
    whatHappened:
      "BLS published May CPI with a softer monthly headline print and slower core services momentum versus prior trends.",
    whyItMatters:
      "Inflation directly feeds the Fed's policy path, which affects stocks, bonds, and consumer budgets.",
    whoIsAffected:
      "Households, bond investors, real estate, rate-sensitive equities, and broad index funds (SPY, VTI).",
    ticker: "—",
    topic: "Inflation",
    sentiment: "positive",
    sentimentConfidence: 88,
    marketImpact: "high",
    articleType: "macro news",
    keyAffectedAssets: ["SPY", "QQQ", "TLT", "XLRE", "Bonds"],
    relatedAssets: [
      { symbol: "SPY", name: "S&P 500 ETF", type: "index" },
      { symbol: "TLT", name: "Treasury ETF", type: "etf" },
    ],
    keyTerms: [
      { term: "Inflation", definition: "General rise in prices — measured by indexes like CPI." },
      { term: "Interest rates", definition: "Borrowing costs influenced by Fed policy when inflation changes." },
      { term: "Bond yields", definition: "Move with inflation expectations and Fed outlook." },
      { term: "Index fund", definition: "Funds tracking SPY/VTI react to macro shifts in discount rates." },
    ],
    bullCase:
      "Disinflation could open the door to gradual rate cuts and support risk assets if labor markets stay stable.",
    bearCase:
      "Sticky shelter inflation may keep the Fed cautious and limit near-term easing.",
    neutralView:
      "One month does not make a trend — policymakers often want several months of improvement.",
    risks: ["Inflation reacceleration", "Oil price spikes", "Wage growth pass-through"],
    thingsToWatch: ["Next CPI and PCE", "Fed speeches", "Breakeven inflation rates"],
    dataSnapshot: {
      kind: "macro",
      relatedIndicators: ["CPI", "Core CPI", "PCE", "Breakeven inflation"],
      affectedSectors: ["Real Estate", "Utilities", "Consumer Discretionary"],
      affectedIndexes: ["SPY", "QQQ", "DIA", "VTI"],
      marketSensitivity: "high",
    },
    recommendedNext: rec([
      { label: "Interest Rates", kind: "topic", slug: "interest-rates" },
      { label: "SPY", kind: "etf", slug: "spy" },
      { label: "Fed commentary", kind: "story", briefId: "spy-fed-commentary" },
      { label: "VTI", kind: "etf", slug: "vti" },
    ]),
    sourceLinks: [
      { name: "Bureau of Labor Statistics", url: "https://www.bls.gov/cpi/" },
      { name: "Federal Reserve", url: "https://www.federalreserve.gov/" },
    ],
  },
  {
    id: "xlk-sector-rotation",
    headline: "Technology sector sees rotation as investors balance AI winners and laggards",
    source: "MarketWatch",
    author: "MarketWatch Staff",
    publishedAt: "2026-05-29T13:00:00Z",
    imageUrl: ARTICLE_IMAGES.techSector.url,
    imageAlt: ARTICLE_IMAGES.techSector.alt,
    originalUrl: "https://www.marketwatch.com/",
    excerpt:
      "Technology stocks were mixed Monday as money rotated from mature software names into AI infrastructure plays...",
    summary:
      "Technology stocks diverged as investors rotated from slower-growth software toward AI infrastructure beneficiaries. Index-level moves masked wide dispersion under the surface. Sector ETFs like XLK remain concentrated in mega-caps. FinBrief highlights the trend for learners — see MarketWatch for the full story.",
    thirtySecondVersion:
      "Tech isn't moving as one block — AI infra is up, some software names lag.",
    whatHappened:
      "Flows favored semiconductors and cloud capex winners while select software stocks underperformed the sector.",
    whyItMatters:
      "Sector ETF performance can hide stock-level risk — diversification within tech still matters.",
    whoIsAffected:
      "XLK and QQQ holders, software investors, and semiconductor supply chain names.",
    ticker: "XLK",
    topic: "Sector rotation",
    sentiment: "neutral",
    sentimentConfidence: 74,
    marketImpact: "medium",
    articleType: "sector news",
    keyAffectedAssets: ["XLK", "QQQ", "IGV", "SMH"],
    relatedAssets: [
      { symbol: "XLK", name: "Technology Sector ETF", type: "etf" },
      { symbol: "QQQ", name: "Nasdaq-100 ETF", type: "etf" },
    ],
    keyTerms: [
      { term: "ETF", definition: "Basket of stocks trading as one ticker — XLK tracks tech sector." },
      { term: "Valuation", definition: "Software vs hardware can trade at very different earnings multiples." },
      { term: "Index fund", definition: "Passive exposure to a sector index." },
    ],
    bullCase:
      "AI spending cycle may lift sector earnings aggregates even if laggards trail.",
    bearCase:
      "Multiple compression in software could drag ETF returns despite chip strength.",
    neutralView:
      "Rotation is normal in large sectors — leadership may shift quarter to quarter.",
    risks: ["Concentration in mega-caps", "Earnings misses in software", "Rate volatility"],
    thingsToWatch: ["Upcoming tech earnings", "Semiconductor guidance", "QQQ breadth indicators"],
    dataSnapshot: {
      kind: "etf",
      tracks: "Technology Select Sector Index",
      topHoldings: ["AAPL", "MSFT", "NVDA", "AVGO", "CRM"],
      expenseRatio: "0.09%",
      dailyChange: "+$0.88",
      dailyChangePercent: 0.41,
      relatedSectors: ["Semiconductors", "Software"],
      macroFactors: ["AI capex", "Rates", "Earnings season"],
    },
    recommendedNext: rec([
      { label: "NVDA", kind: "ticker", slug: "nvda" },
      { label: "AI Stocks", kind: "sector", slug: "ai-stocks" },
      { label: "QQQ", kind: "etf", slug: "qqq" },
      { label: "AI capex story", kind: "story", briefId: "qqq-ai-spending" },
    ]),
    sourceLinks: [{ name: "MarketWatch", url: "https://www.marketwatch.com/" }],
  },
];
