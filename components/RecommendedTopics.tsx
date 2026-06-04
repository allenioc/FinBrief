import Link from "next/link";

const topics = [
  { label: "AAPL", href: "/topic/aapl" },
  { label: "NVDA", href: "/topic/nvda" },
  { label: "SPY", href: "/topic/spy" },
  { label: "QQQ", href: "/topic/qqq" },
  { label: "Inflation", href: "/topic/inflation" },
  { label: "Interest Rates", href: "/topic/interest-rates" },
  { label: "AI Stocks", href: "/topic/ai-stocks" },
  { label: "Semiconductors", href: "/topic/semiconductors" },
];

export function RecommendedTopics() {
  return (
    <section className="mb-10">
      <h2 className="fin-section-title mb-4">Recommended for you</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-4">
        {topics.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="fin-card fin-card-hover px-4 py-3 text-center text-sm font-semibold text-fin-navy hover:text-fin-brand"
          >
            {t.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
