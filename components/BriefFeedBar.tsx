"use client";

import { getInitialArticleFeedMeta } from "@/lib/mock-refresh";
import { UPDATE_SCHEDULE } from "@/lib/update-schedule";
import { FeedStatusBar } from "./FeedStatusBar";

const deepDiveNote = UPDATE_SCHEDULE.find((s) => s.feed === "deep-dive");

export function BriefFeedBar() {
  const meta = getInitialArticleFeedMeta();

  return (
    <div className="mb-6 space-y-2">
      <FeedStatusBar lastUpdatedAt={meta.lastUpdatedAt} />
      {deepDiveNote && (
        <p className="text-xs text-fin-subtle">
          Deep Dive: {deepDiveNote.cadence} {deepDiveNote.productionNote}
        </p>
      )}
    </div>
  );
}
