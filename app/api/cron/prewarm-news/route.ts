import { NextRequest, NextResponse } from "next/server";
import { BROAD_NEWS_QUERY, BROAD_FINANCE_QUERIES } from "@/lib/news-constants";

const PREWARM_QUERIES = [
  BROAD_NEWS_QUERY,
  ...BROAD_FINANCE_QUERIES.slice(0, 8),
];

function resolveBaseUrl(request: NextRequest): string {
  const envBase =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (envBase) return envBase;
  const origin = request.nextUrl.origin;
  if (origin) return origin;
  return "http://localhost:3000";
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  const baseUrl = resolveBaseUrl(request);
  const results: Array<{ query: string; ok: boolean; status: number }> = [];

  // Cron prewarms broad news searches so the first user request can hit warm cache.
  // This is useful before we introduce persistent storage.
  for (const query of PREWARM_QUERIES) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    params.set("limit", "24");
    params.set("page", "1");
    const response = await fetch(`${baseUrl}/api/news?${params.toString()}`, {
      cache: "no-store",
      headers: secret ? { authorization: `Bearer ${secret}` } : undefined,
    });
    results.push({
      query: query || BROAD_NEWS_QUERY,
      ok: response.ok,
      status: response.status,
    });
  }

  return NextResponse.json({
    ok: true,
    warmedAt: new Date().toISOString(),
    totalQueries: PREWARM_QUERIES.length,
    results,
  });
}
