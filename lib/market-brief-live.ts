import type { Brief, MarketBriefData, MarketSnapshotPayload } from "./types";
import { enrichMarketRisk } from "./market-risk";
import {
  buildInterviewTakeaway,
  buildRiskExposures,
  buildSessionHeadline,
  buildSessionRecapParagraph,
} from "./market-brief-narrative";
import { attachDriversToSnapshot } from "./market-snapshot";

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function buildMarketBriefFromBriefs(
  briefs: Brief[],
  snapshot?: MarketSnapshotPayload | null
): MarketBriefData {
  const enriched = briefs.map((brief) => enrichMarketRisk(brief));
  const ordered = [...enriched].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  const marketAssets = snapshot ? attachDriversToSnapshot(snapshot, ordered) : [];

  const keyDrivers = unique(
    ordered
      .filter((brief) => brief.articleType === "macro news" || brief.riskDrivers?.length)
      .map((brief) => brief.headline)
  ).slice(0, 5);

  return {
    date: new Date().toISOString().slice(0, 10),
    sessionHeadline: buildSessionHeadline(marketAssets),
    sessionRecap: buildSessionRecapParagraph(ordered, marketAssets),
    interviewTakeaway: buildInterviewTakeaway(ordered, marketAssets),
    keyDrivers:
      keyDrivers.length > 0
        ? keyDrivers
        : ordered.slice(0, 3).map((brief) => brief.headline),
    riskExposures: buildRiskExposures(ordered),
    topStories: ordered.slice(0, 5).map((story) => ({
      id: story.id,
      title: story.headline,
      source: story.source,
    })),
    marketAssets,
    marketSnapshotFetchedAt: snapshot?.fetchedAt ?? null,
  };
}
