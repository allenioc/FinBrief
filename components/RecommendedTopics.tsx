import Link from "next/link";

const topics = [
  { label: "AAPL", href: "/?q=AAPL" },
  { label: "MSFT", href: "/?q=MSFT" },
  { label: "NVDA", href: "/?q=NVDA" },
  { label: "TSLA", href: "/?q=TSLA" },
  { label: "SPY", href: "/?q=SPY" },
  { label: "QQQ", href: "/?q=QQQ" },
  { label: "VTI", href: "/?q=VTI" },
  { label: "DIA", href: "/?q=DIA" },
  { label: "AI", href: "/?q=AI" },
  { label: "Markets", href: "/?q=Markets" },
  { label: "Economy", href: "/?q=Economy" },
  { label: "Banking", href: "/?q=Banking" },
  { label: "Real Estate", href: "/?q=Real%20Estate" },
  { label: "Interest Rates", href: "/?q=Interest%20Rates" },
];

export function RecommendedTopics() {
  return (
    <section className="mb-10">
      <h2 className="fin-section-title mb-4">Browse topics</h2>
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
