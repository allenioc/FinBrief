import type { RelevantRiskMeasureRow } from "@/lib/types";

export function RelevantRiskMeasuresBlock({ rows }: { rows: RelevantRiskMeasureRow[] }) {
  if (rows.length === 0) return null;

  return (
    <ul className="space-y-3 text-sm">
      {rows.map((row) => (
        <li key={row.category}>
          <p className="font-semibold text-fin-navy">{row.category}</p>
          <p className="mt-1 text-fin-text">{row.measures.join(" · ")}</p>
        </li>
      ))}
    </ul>
  );
}
