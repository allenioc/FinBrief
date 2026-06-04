/**
 * Date/time formatting for feed "last updated" labels.
 * Pass an explicit `now` in tests; defaults to current time in the browser.
 */

export function formatLastUpdated(iso: string, now: Date = new Date()): string {
  const updated = new Date(iso);
  const diffMs = Math.max(0, now.getTime() - updated.getTime());
  const diffMin = Math.floor(diffMs / (1000 * 60));

  if (diffMin < 1) return "Updated just now";
  if (diffMin < 60) return `Updated ${diffMin} min ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24 && isSameCalendarDay(updated, now)) {
    return `Updated today at ${formatTimeOfDay(updated)}`;
  }

  if (diffHours < 48 && isYesterday(updated, now)) {
    return `Updated yesterday at ${formatTimeOfDay(updated)}`;
  }

  return `Updated ${updated.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export function formatTimeOfDay(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTodayAt(time: Date): string {
  return `Updated today at ${formatTimeOfDay(time)}`;
}

export function formatMinutesAgo(minutes: number): string {
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isYesterday(date: Date, now: Date): boolean {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameCalendarDay(date, yesterday);
}

/** ISO timestamp offset from now (for mock feed seeds). */
export function minutesAgoIso(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

/** Morning market brief mock publish time (today 9:30 AM local). */
export function todayMorningBriefIso(): string {
  const d = new Date();
  d.setHours(9, 30, 0, 0);
  if (d.getTime() > Date.now()) {
    d.setDate(d.getDate() - 1);
  }
  return d.toISOString();
}
