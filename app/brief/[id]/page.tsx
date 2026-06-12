import { ArticleBriefClient } from "@/components/ArticleBriefClient";
import { Disclaimer } from "@/components/Disclaimer";
import { findArticleLocally } from "@/lib/article-lookup";

interface BriefPageProps {
  params: Promise<{ id: string }>;
}

export default async function BriefPage({ params }: BriefPageProps) {
  const { id } = await params;
  const article = await findArticleLocally(id);

  return (
    <div className="mx-auto max-w-shell px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <ArticleBriefClient id={id} initialArticle={article} />
      <div className="mt-10">
        <Disclaimer />
      </div>
    </div>
  );
}
