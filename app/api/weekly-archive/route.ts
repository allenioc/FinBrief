import { NextResponse } from "next/server";
import { loadWeeklyArchive } from "@/lib/weekly-archive-store";

/**
 * Serves the current week's archive from saved daily editions only.
 * Never calls live news providers.
 */
export async function GET() {
  const archive = await loadWeeklyArchive();
  return NextResponse.json({
    ...archive,
    cacheStatus: archive.storyCount > 0 ? "weekly_archive_hit" : "weekly_archive_empty",
  });
}
