import { Disclaimer } from "@/components/Disclaimer";
import { TopicHub } from "@/components/TopicHub";
import { UpdateScheduleFooter } from "@/components/UpdateScheduleFooter";
import { getBriefsForTopic } from "@/lib/briefs";
import { getTopicProfile } from "@/lib/topics";
import { notFound } from "next/navigation";

interface TopicPageProps {
  params: Promise<{ slug: string }>;
}

export default async function TopicPage({ params }: TopicPageProps) {
  const { slug } = await params;
  const profile = getTopicProfile(slug);

  if (!profile) {
    notFound();
  }

  const stories = getBriefsForTopic(slug);

  return (
    <div className="mx-auto max-w-shell px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <TopicHub profile={profile} stories={stories} />
      <div className="mt-10">
        <Disclaimer />
      </div>
      <UpdateScheduleFooter />
    </div>
  );
}
