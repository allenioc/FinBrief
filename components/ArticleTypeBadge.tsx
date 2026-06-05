import type { ArticleType } from "@/lib/types";
import { ANALYSIS_LABEL_TOOLTIPS } from "@/lib/analysis-tooltips";
import { Tooltip } from "./Tooltip";

const labels: Record<ArticleType, string> = {
  "company news": "Company",
  "market news": "Market",
  "macro news": "Macro",
  "ETF/index news": "ETF / Index",
  "sector news": "Sector",
};

export function ArticleTypeBadge({ type }: { type: ArticleType }) {
  return (
    <Tooltip
      label="Article type explanation"
      content={ANALYSIS_LABEL_TOOLTIPS.articleType}
      triggerClassName="rounded-full"
    >
      <span className="inline-flex items-center rounded-full border border-fin-border bg-fin-muted px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-fin-subtle">
        {labels[type]}
      </span>
    </Tooltip>
  );
}
