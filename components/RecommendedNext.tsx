import Link from "next/link";
import type { RecommendedItem } from "@/lib/types";

const kindLabels: Record<RecommendedItem["kind"], string> = {
  ticker: "Stock",
  etf: "ETF",
  sector: "Sector",
  topic: "Topic",
  story: "Story",
};

/** Recommended stories & related assets — editorial pill grid */
export function RecommendedNext({
  items,
  title = "Recommended next",
}: {
  items: RecommendedItem[];
  title?: string;
}) {
  if (items.length === 0) return null;

  return (
    <section className="fin-panel">
      <h2 className="fin-section-title mb-4">{title}</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <Link
            key={item.href + item.label}
            href={item.href}
            className="group flex items-center justify-between rounded-2xl border border-fin-border bg-fin-muted/50 px-4 py-3 transition-colors hover:border-fin-brand hover:bg-fin-brand-soft"
          >
            <span className="font-medium text-fin-navy group-hover:text-fin-brand">
              {item.label}
            </span>
            <span className="text-xs font-medium text-fin-subtle">{kindLabels[item.kind]}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export const RecommendedSection = RecommendedNext;
