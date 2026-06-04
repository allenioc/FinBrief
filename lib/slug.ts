export function toTopicSlug(symbol: string): string {
  return symbol
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export function fromTopicSlug(slug: string): string {
  const special: Record<string, string> = {
    "interest-rates": "Interest Rates",
    "ai-stocks": "AI Stocks",
    semiconductors: "Semiconductors",
    inflation: "Inflation",
  };
  if (special[slug]) return special[slug];
  return slug.toUpperCase();
}
