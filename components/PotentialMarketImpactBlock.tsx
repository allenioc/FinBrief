import type { PotentialMarketImpact } from "@/lib/types";

const IMPACT_ROWS: { key: keyof PotentialMarketImpact; label: string }[] = [
  { key: "equities", label: "Equities" },
  { key: "ratesBonds", label: "Rates/Bonds" },
  { key: "fx", label: "FX" },
  { key: "commodities", label: "Commodities" },
  { key: "volatility", label: "Volatility" },
  { key: "creditBanking", label: "Credit/Banking" },
];

function formatAssessment(value: string): string {
  if (value === "not directly affected") return "Not directly affected";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function PotentialMarketImpactBlock({ impact }: { impact: PotentialMarketImpact }) {
  const rows = IMPACT_ROWS.filter(({ key }) => impact[key] != null);
  if (rows.length === 0) return null;

  return (
    <ul className="space-y-2 text-sm">
      {rows.map(({ key, label }) => (
        <li key={key} className="flex gap-2">
          <span className="min-w-[8.5rem] font-semibold text-fin-navy">{label}:</span>
          <span className="text-fin-text">{formatAssessment(impact[key]!)}</span>
        </li>
      ))}
    </ul>
  );
}
