export function ConfidenceScore({ score }: { score: number }) {
  const color =
    score >= 80
      ? "text-status-positive"
      : score >= 65
        ? "text-fin-brand"
        : "text-status-warning";

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-fin-subtle">Confidence</span>
      <span className={`font-semibold tabular-nums ${color}`}>{score}%</span>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-fin-muted">
        <div
          className={`h-full rounded-full ${score >= 80 ? "bg-status-positive" : score >= 65 ? "bg-fin-brand" : "bg-status-warning"}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
