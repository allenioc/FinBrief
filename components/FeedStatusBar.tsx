import { FEED_STATUS } from "@/lib/update-schedule";
import { LastUpdatedLabel } from "./LastUpdatedLabel";

export function FeedStatusBar({
  lastUpdatedAt,
  showRefreshHint = false,
}: {
  lastUpdatedAt: string;
  showRefreshHint?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-full border border-fin-border bg-fin-muted/60 px-4 py-2">
      <span className="inline-flex items-center gap-2 text-xs font-semibold text-fin-navy">
        <span className="relative flex h-2 w-2" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-positive opacity-40" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-status-positive" />
        </span>
        {FEED_STATUS.shortLabel}
      </span>
      <LastUpdatedLabel iso={lastUpdatedAt} className="text-xs text-fin-subtle" />
      <span className="text-xs text-fin-subtle">{FEED_STATUS.label}</span>
      {showRefreshHint && (
        <span className="text-xs text-fin-subtle">· Demo refresh available</span>
      )}
    </div>
  );
}
