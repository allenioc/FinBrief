import { fromTopicSlug } from "@/lib/slug";
import { redirect } from "next/navigation";

interface TopicPageProps {
  params: Promise<{ slug: string }>;
}

export default async function TopicPage({ params }: TopicPageProps) {
  const { slug } = await params;
  const query = fromTopicSlug(slug);
  redirect(`/?q=${encodeURIComponent(query)}`);
}
