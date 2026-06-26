import { NextResponse } from "next/server";
import { loadWeeklyArchive } from "@/lib/weekly-archive-store";
import { mirrorRollingBroadEditionToWeek } from "@/lib/weekly-edition-sync";

/**
 * Serves the current week's archive from saved daily editions only.
 * Never calls live news providers, never uses fresh/nocache, never backfills missing days.
 */
export async function GET() {
  await mirrorRollingBroadEditionToWeek();
  const archive = await loadWeeklyArchive();
  return NextResponse.json({
    ...archive,
    cacheStatus: archive.storyCount > 0 ? "weekly_archive_hit" : "weekly_archive_empty",
  });
}
