"use client";

import { useWatchlist } from "./WatchlistProvider";
import type { WatchlistItem } from "@/lib/types";

export function FollowToggleButton({
  item,
  className,
}: {
  item: WatchlistItem;
  className?: string;
}) {
  const { isFollowing, toggleFollow } = useWatchlist();
  const following = isFollowing(item.symbol);

  return (
    <button
      type="button"
      className={
        className ??
        `rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
          following
            ? "border border-status-negative/30 bg-status-negative-bg text-status-negative hover:opacity-90"
            : "border border-fin-border bg-fin-muted text-fin-navy hover:border-fin-brand hover:bg-fin-brand-soft"
        }`
      }
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleFollow(item);
      }}
      aria-pressed={following}
      aria-label={`${following ? "Unfollow" : "Follow"} ${item.symbol}`}
    >
      {following ? "Unfollow" : "Follow"}
    </button>
  );
}
