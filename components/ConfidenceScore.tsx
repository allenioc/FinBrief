import { ANALYSIS_LABEL_TOOLTIPS } from "@/lib/analysis-tooltips";
import { Tooltip, TooltipLabel } from "./Tooltip";

export function ConfidenceScore({ score }: { score: number }) {
  const color =
    score >= 80
      ? "text-status-positive"
      : score >= 65
        ? "text-fin-brand"
        : "text-status-warning";

  return (
    <div className="flex items-center gap-2 text-xs">
      <TooltipLabel label="Confidence" content={ANALYSIS_LABEL_TOOLTIPS.confidence} />
      <Tooltip
        label="Confidence percentage explanation"
        content={ANALYSIS_LABEL_TOOLTIPS.confidence}
        triggerClassName="rounded-md px-0.5"
      >
        <span className={`font-semibold tabular-nums ${color}`}>{score}%</span>
      </Tooltip>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-fin-muted">
        <div
          className={`h-full rounded-full ${score >= 80 ? "bg-status-positive" : score >= 65 ? "bg-fin-brand" : "bg-status-warning"}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
