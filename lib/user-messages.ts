/** User-facing copy for feed and edition states (no backend/debug wording). */

export function friendlyEditionError(message: string | null | undefined): string | null {
  if (!message) return null;
  const lower = message.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("unavailable") || lower.includes("saved edition")) {
    return "Showing the most recent saved edition while today's update catches up.";
  }
  return "Some stories may be temporarily unavailable. The daily edition refreshes once per day.";
}
