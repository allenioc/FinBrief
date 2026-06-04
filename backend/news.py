"""Mock news briefing data for FinBrief."""

from __future__ import annotations

from typing import Any


def _content(
    simple: dict[str, Any],
    standard: dict[str, Any],
    analyst: dict[str, Any],
) -> dict[str, dict[str, Any]]:
    def pack(src: dict[str, Any]) -> dict[str, Any]:
        return {
            "whatHappened": src["what"],
            "whyItMatters": src["why"],
            "bullishView": src["bull"],
            "bearishView": src["bear"],
            "keyTerms": src["terms"],
        }

    return {
        "simple": pack(simple),
        "standard": pack(standard),
        "analyst": pack(analyst),
    }


MOCK_BRIEFS: list[dict[str, Any]] = [
    {
        "id": "aapl-earnings-q1",
        "title": "Apple reports stronger-than-expected services revenue",
        "summary": (
            "Apple's latest quarterly report showed services growing faster than hardware, "
            "which many investors watch as a steadier revenue stream."
        ),
        "ticker": "AAPL",
        "topic": "Earnings",
        "publishedAt": "2026-06-03T14:30:00Z",
        "sourceName": "Reuters",
        "sourceUrl": "https://www.reuters.com/markets/",
        "sentiment": "positive",
        "marketImpact": "medium",
        "content": _content(
            {
                "what": "Apple shared its latest business results. Money from apps, cloud, and subscriptions grew more than phone sales.",
                "why": "When services grow, the company may rely less on selling new phones every year. That can make earnings more predictable over time.",
                "bull": "Steady subscription income could support long-term growth even if iPhone upgrades slow down.",
                "bear": "Hardware still drives most revenue. A weak phone cycle could still pressure overall results.",
                "terms": [
                    {"term": "Services revenue", "definition": "Money Apple earns from apps, iCloud, Apple Music, and similar products."},
                    {"term": "Earnings report", "definition": "A regular update where a public company shares financial performance."},
                ],
            },
            {
                "what": "Apple posted quarterly results with services revenue beating analyst estimates while iPhone revenue was roughly in line with expectations.",
                "why": "Investors often track the services mix because it typically carries higher margins and recurring characteristics compared with device sales.",
                "bull": "Expanding high-margin services may improve earnings quality and reduce cyclical exposure to hardware upgrade cycles.",
                "bear": "Device revenue remains the largest segment; macro or replacement-cycle weakness could still weigh on consolidated growth.",
                "terms": [
                    {"term": "Beat", "definition": "Actual results above the consensus estimate from analysts."},
                    {"term": "Margin", "definition": "Profit remaining after costs, often expressed as a percentage of revenue."},
                ],
            },
            {
                "what": "AAPL reported Q results with Services outperformance versus Street models; iPhone revenue broadly tracked consensus.",
                "why": "The revenue mix shift toward Services is relevant for valuation frameworks that assign different multiples to recurring vs transactional revenue.",
                "bull": "Structural mix improvement supports margin expansion narratives and may reduce beta to consumer hardware cycles.",
                "bear": "Hardware concentration and China demand sensitivity remain key downside vectors if replacement rates soften.",
                "terms": [
                    {"term": "Street", "definition": "Collective expectations from sell-side equity research analysts."},
                    {"term": "Beta", "definition": "Sensitivity of a stock's returns to broader market or sector moves."},
                ],
            },
        ),
    },
    {
        "id": "tsla-delivery-update",
        "title": "Tesla vehicle deliveries come in below some forecasts",
        "summary": (
            "Tesla announced quarterly delivery figures that fell short of certain analyst "
            "expectations, renewing discussion about demand and competition."
        ),
        "ticker": "TSLA",
        "topic": "Deliveries",
        "publishedAt": "2026-06-02T09:15:00Z",
        "sourceName": "Bloomberg",
        "sourceUrl": "https://www.bloomberg.com/news/",
        "sentiment": "negative",
        "marketImpact": "high",
        "content": _content(
            {
                "what": "Tesla told investors how many cars it delivered last quarter. The number was lower than some experts predicted.",
                "why": "Delivery counts are a quick way to see demand before full earnings. Misses can move the stock on news days.",
                "bull": "The company may still be expanding production capacity and new models could lift future volumes.",
                "bear": "Slower deliveries may signal tougher competition or softer buyer demand in key markets.",
                "terms": [
                    {"term": "Deliveries", "definition": "Cars handed to customers; often used as a near-term demand indicator."},
                    {"term": "Forecast", "definition": "An estimate of future results, often from analysts or the company."},
                ],
            },
            {
                "what": "Tesla published quarterly delivery data below the high end of analyst ranges, with particular attention on regional mix and pricing actions.",
                "why": "Delivery beats or misses frequently drive near-term volatility because they precede reported revenue and margins.",
                "bull": "Energy storage growth and upcoming product cycles may offset near-term auto volume softness.",
                "bear": "Volume shortfalls alongside price competition could compress margins if cost reductions do not keep pace.",
                "terms": [
                    {"term": "Volume", "definition": "Number of units sold or delivered in a period."},
                    {"term": "Margin compression", "definition": "When profit per unit declines due to costs or pricing."},
                ],
            },
            {
                "what": "TSLA disclosed Q deliveries below bullish consensus tails; market focus on China/Europe run-rates and ASP trajectory.",
                "why": "Delivery prints are a high-frequency KPI for auto OEM narratives and often re-rate near-term revenue estimates.",
                "bull": "Optionality in AI/robotaxi and storage attach rates may support longer-duration thesis despite auto noise.",
                "bear": "Demand elasticity and competitive EV pricing remain headwinds to unit growth and operating leverage.",
                "terms": [
                    {"term": "ASP", "definition": "Average selling price per vehicle or unit."},
                    {"term": "Operating leverage", "definition": "How profits change when revenue scales up or down."},
                ],
            },
        ),
    },
    {
        "id": "spy-fed-commentary",
        "title": "Fed officials signal patience on rate cuts amid sticky inflation data",
        "summary": (
            "Recent remarks from Federal Reserve policymakers suggest markets may need to "
            "wait longer for interest rate reductions."
        ),
        "ticker": "SPY",
        "topic": "Interest rates",
        "publishedAt": "2026-06-01T16:45:00Z",
        "sourceName": "Wall Street Journal",
        "sourceUrl": "https://www.wsj.com/economy/",
        "sentiment": "neutral",
        "marketImpact": "high",
        "content": _content(
            {
                "what": "Leaders at America's central bank said they want more proof that prices are cooling before lowering borrowing costs.",
                "why": "Interest rates affect loans, mortgages, and how expensive stocks look compared with bonds. SPY tracks the broad U.S. market.",
                "bull": "Keeping rates steady could mean the economy is still strong enough to support corporate earnings.",
                "bear": "Higher rates for longer can pressure growth stocks and make bonds more attractive to some investors.",
                "terms": [
                    {"term": "Federal Reserve", "definition": "The U.S. central bank that sets short-term interest rate policy."},
                    {"term": "SPY", "definition": "An ETF that tracks the S&P 500 index of large U.S. companies."},
                ],
            },
            {
                "what": "Fed speakers emphasized data dependence, noting that inflation progress has been uneven, which may delay the timing of policy easing.",
                "why": "Rate expectations influence discount rates in equity valuation models and sector leadership, especially for rate-sensitive equities.",
                "bull": "A soft landing narrative remains plausible if labor markets cool without a sharp rise in unemployment.",
                "bear": "Restrictive policy for an extended period could weigh on multiples for long-duration assets.",
                "terms": [
                    {"term": "Policy easing", "definition": "Central bank actions that lower interest rates or loosen financial conditions."},
                    {"term": "Multiple", "definition": "Price-to-earnings ratio or similar valuation metric applied to earnings."},
                ],
            },
            {
                "what": "FOMC communication skewed hawkish relative to front-end OIS pricing; inflation dispersion cited as rationale for slower easing path.",
                "why": "Shifts in the terminal rate and cut timing affect real yields, equity risk premia, and factor performance (growth vs value).",
                "bull": "Disinflation trend intact on core services ex-housing; growth resilience supports EPS revision stability.",
                "bear": "Higher-for-longer scenario risks duration drawdowns in equities and credit spread volatility.",
                "terms": [
                    {"term": "OIS", "definition": "Overnight index swap rates used to infer market-implied policy expectations."},
                    {"term": "Real yields", "definition": "Bond yields adjusted for inflation expectations."},
                ],
            },
        ),
    },
    {
        "id": "qqq-ai-spending",
        "title": "Major cloud providers raise capex guidance on AI infrastructure",
        "summary": (
            "Leading technology firms increased planned spending on data centers and AI chips, "
            "a trend closely watched by Nasdaq-heavy portfolios."
        ),
        "ticker": "QQQ",
        "topic": "AI spending",
        "publishedAt": "2026-05-31T11:20:00Z",
        "sourceName": "Financial Times",
        "sourceUrl": "https://www.ft.com/technology/",
        "sentiment": "positive",
        "marketImpact": "medium",
        "content": _content(
            {
                "what": "Big tech companies said they will spend more money building AI computer systems and data centers this year.",
                "why": "QQQ holds many of these firms. Higher spending can mean growth today but lower free cash flow in the short run.",
                "bull": "Investment in AI may create new products and revenue streams over the next several years.",
                "bear": "Large bills for equipment could hurt profits if demand does not grow as fast as spending.",
                "terms": [
                    {"term": "Capex", "definition": "Capital expenditure — money spent on long-term assets like buildings and servers."},
                    {"term": "QQQ", "definition": "ETF tracking the Nasdaq-100, heavy in large technology companies."},
                ],
            },
            {
                "what": "Hyperscalers updated forward capex outlooks tied to GPU clusters and data center expansion to support generative AI workloads.",
                "why": "Capex cycles affect near-term FCF yields and supply chain beneficiaries, with implications for QQQ constituents.",
                "bull": "Infrastructure build-out may widen moats and monetization opportunities across cloud and enterprise software.",
                "bear": "ROI uncertainty and utilization rates may cap returns if enterprise AI adoption underwhelms.",
                "terms": [
                    {"term": "Hyperscaler", "definition": "Large cloud platforms such as AWS, Azure, and Google Cloud."},
                    {"term": "FCF", "definition": "Free cash flow — cash generated after operating and capital expenses."},
                ],
            },
            {
                "what": "Mgmt guides raised AI-related capex; supply chain orders for accelerators and networking gear revised higher.",
                "why": "Capex intensity influences sector EPS trajectories and relative performance within mega-cap tech vs rest of market.",
                "bull": "Scarcity rents on compute and platform bundling may support ARPU expansion and ecosystem lock-in.",
                "bear": "Depreciation ramps and power constraints could pressure ROIC if workload growth normalizes.",
                "terms": [
                    {"term": "ROIC", "definition": "Return on invested capital — efficiency of capital deployment."},
                    {"term": "ARPU", "definition": "Average revenue per user or customer account."},
                ],
            },
        ),
    },
    {
        "id": "inflation-cpi-print",
        "title": "Latest CPI report shows inflation cooling slightly month over month",
        "summary": (
            "Consumer price data indicated a modest easing in headline inflation, "
            "a key input for bond yields and rate expectations."
        ),
        "ticker": "—",
        "topic": "Inflation",
        "publishedAt": "2026-05-30T08:00:00Z",
        "sourceName": "Bureau of Labor Statistics",
        "sourceUrl": "https://www.bls.gov/cpi/",
        "sentiment": "positive",
        "marketImpact": "high",
        "content": _content(
            {
                "what": "The government said average prices consumers pay rose a bit less this month than the month before.",
                "why": "Inflation affects how far paychecks go and what the Fed might do with interest rates.",
                "bull": "Cooler inflation can ease pressure on households and open the door to lower rates over time.",
                "bear": "Some prices, like shelter or services, may still be rising faster than policymakers want.",
                "terms": [
                    {"term": "CPI", "definition": "Consumer Price Index — measures average change in prices paid by consumers."},
                    {"term": "Headline inflation", "definition": "Overall price change including food and energy."},
                ],
            },
            {
                "what": "The CPI release showed a softer monthly headline print with core inflation decelerating modestly versus prior trends.",
                "why": "Inflation data feeds directly into Fed reaction functions and front-end rate pricing, impacting cross-asset correlations.",
                "bull": "Disinflation momentum may reinforce expectations for gradual policy normalization later this year.",
                "bear": "Sticky components and base effects could keep policymakers cautious about declaring victory too early.",
                "terms": [
                    {"term": "Core inflation", "definition": "CPI excluding volatile food and energy categories."},
                    {"term": "Base effects", "definition": "Comparisons distorted by unusually high or low readings a year earlier."},
                ],
            },
            {
                "what": "CPI m/m below consensus; core services momentum slowed; market repriced 2026 cut probabilities higher.",
                "why": "Inflation surprises drive breakeven inflation, real rates, and equity style rotations (defensives vs cyclicals).",
                "bull": "Improving inflation breadth supports soft-landing baseline and duration-sensitive asset bids.",
                "bear": "Reacceleration risk remains if labor costs pass through with lag; vigilance on supercore trends.",
                "terms": [
                    {"term": "Breakeven inflation", "definition": "Market-implied inflation expectation from TIPS vs nominal bonds."},
                    {"term": "Supercore", "definition": "Inflation measures excluding housing and used vehicles, closely watched by markets."},
                ],
            },
        ),
    },
]

QUERY_ALIASES: dict[str, list[str]] = {
    "inflation": ["inflation", "cpi"],
    "interest rates": ["interest", "rates", "fed", "spy"],
    "rates": ["interest", "rates", "fed"],
}


def search_briefs(query: str) -> list[dict[str, Any]]:
    q = query.strip().lower()
    if not q:
        return MOCK_BRIEFS

    terms = QUERY_ALIASES.get(q, [q])
    results: list[dict[str, Any]] = []

    for brief in MOCK_BRIEFS:
        haystack = " ".join(
            [
                brief["ticker"],
                brief["topic"],
                brief["title"],
                brief["summary"],
                brief["id"],
            ]
        ).lower()
        if any(term in haystack for term in terms):
            results.append(brief)

    if not results:
        return MOCK_BRIEFS[:3]
    return results


def get_brief_by_id(brief_id: str) -> dict[str, Any] | None:
    for brief in MOCK_BRIEFS:
        if brief["id"] == brief_id:
            return brief
    return None
