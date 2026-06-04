import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleDetail } from "@/components/ArticleDetail";
import { BriefFeedBar } from "@/components/BriefFeedBar";
import { Disclaimer } from "@/components/Disclaimer";
import { UpdateScheduleFooter } from "@/components/UpdateScheduleFooter";
import { getBriefById } from "@/lib/briefs";
import { toTopicSlug } from "@/lib/slug";

interface BriefPageProps {
  params: Promise<{ id: string }>;
}

export default async function BriefPage({ params }: BriefPageProps) {
  const { id } = await params;
  const article = getBriefById(id);

  if (!article) {
    notFound();
  }

  const backHref =
    article.ticker !== "—" ? `/topic/${toTopicSlug(article.ticker)}` : "/";

  return (
    <div className="mx-auto max-w-shell px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <Link href={backHref} className="fin-link text-sm">
        ← Back
      </Link>
      <div className="mt-6">
        <BriefFeedBar />
        <ArticleDetail article={article} />
      </div>
      <div className="mt-10">
        <Disclaimer />
      </div>
      <UpdateScheduleFooter />
    </div>
  );
}
