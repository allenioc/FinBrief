import Link from "next/link";
import { toTopicSlug } from "@/lib/slug";

export function AssetTags({ assets, max = 5 }: { assets: string[]; max?: number }) {
  const shown = assets.slice(0, max);
  const rest = assets.length - shown.length;

  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((asset) => (
        <Link
          key={asset}
          href={`/topic/${toTopicSlug(asset)}`}
          className="rounded-full border border-fin-border bg-fin-surface px-2.5 py-0.5 font-mono text-xs font-medium text-fin-navy transition-colors hover:border-fin-brand hover:bg-fin-brand-soft hover:text-fin-brand"
        >
          {asset}
        </Link>
      ))}
      {rest > 0 && <span className="px-1 py-0.5 text-xs text-fin-subtle">+{rest}</span>}
    </div>
  );
}
