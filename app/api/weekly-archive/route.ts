import { NextResponse } from "next/server";
import { diagnoseWeeklyStorage, loadWeeklyArchive } from "@/lib/weekly-archive-store";
import { mirrorRollingBroadEditionToWeek } from "@/lib/weekly-edition-sync";

export const dynamic = "force-dynamic";

/**
 * Serves the current week's archive from saved daily editions only.
 * Never calls live news providers, never uses fresh/nocache, never backfills missing days.
 */
export async function GET() {
  await mirrorRollingBroadEditionToWeek();
  const [archive, storage] = await Promise.all([loadWeeklyArchive(), diagnoseWeeklyStorage()]);
  return NextResponse.json(
    {
      ...archive,
      cacheStatus: archive.storyCount > 0 ? "weekly_archive_hit" : "weekly_archive_empty",
      storage,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
