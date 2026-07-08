import type { Brief, MarketBriefData, MarketSnapshotPayload } from "./types";
import { enrichMarketRisk } from "./market-risk";
import {
  buildInterviewTakeaway,
  buildRiskExposures,
  buildSessionRecapParagraph,
  buildWhyItMovedItems,
  DAILY_BRIEF_TITLE,
} from "./market-brief-narrative";
import { attachDriversToSnapshot } from "./market-snapshot";

export function buildMarketBriefFromBriefs(
  briefs: Brief[],
  snapshot?: MarketSnapshotPayload | null
): MarketBriefData {
  const enriched = briefs.map((brief) => enrichMarketRisk(brief));
  const ordered = [...enriched].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  const marketAssets = snapshot ? attachDriversToSnapshot(snapshot, ordered) : [];
  const whyItMoved = buildWhyItMovedItems(ordered);

  return {
    date: new Date().toISOString().slice(0, 10),
    sessionHeadline: DAILY_BRIEF_TITLE,
    sessionRecap: buildSessionRecapParagraph(ordered, marketAssets),
    interviewTakeaway: buildInterviewTakeaway(ordered, marketAssets),
    keyDrivers: whyItMoved,
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
