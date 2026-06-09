import { ArticleBriefClient } from "@/components/ArticleBriefClient";
import { Disclaimer } from "@/components/Disclaimer";
import { UpdateScheduleFooter } from "@/components/UpdateScheduleFooter";
import { findArticleLocally } from "@/lib/article-lookup";

interface BriefPageProps {
  params: Promise<{ id: string }>;
}

export default async function BriefPage({ params }: BriefPageProps) {
  const { id } = await params;
  // Best-effort server lookup (article index + mock data). When this misses —
  // e.g. a different serverless instance — the client resolves the article
  // from sessionStorage or the API.
  const article = await findArticleLocally(id);

  return (
    <div className="mx-auto max-w-shell px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <ArticleBriefClient id={id} initialArticle={article} />
      <div className="mt-10">
        <Disclaimer />
      </div>
      <UpdateScheduleFooter />
    </div>
  );
}
