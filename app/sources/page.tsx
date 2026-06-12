import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { BRAND } from "@/lib/theme";

export default function SourcesPage() {
  return (
    <div className="mx-auto max-w-shell px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        eyebrow={BRAND.name}
        title="Sources"
        description="FinBrief summarizes publicly available reporting. Full articles always remain with the original publishers."
      />

      <div className="space-y-6 fin-body max-w-2xl text-sm text-fin-text">
        <section className="fin-panel space-y-3">
          <h2 className="text-lg font-bold text-fin-navy">Original publishers</h2>
          <p>
            Every FinBrief story links to its source article. Headlines, excerpts, and metadata come
            from recognized news publishers and wire services. FinBrief does not republish full
            articles — we explain and contextualize, then send you to the publisher for the complete
            report.
          </p>
        </section>

        <section className="fin-panel space-y-3">
          <h2 className="text-lg font-bold text-fin-navy">Attribution</h2>
          <p>
            Each Article Brief shows the publisher name, publication date, and a direct link labeled
            &ldquo;Read full article at source.&rdquo; When you open a story, use that link for
            quotes, charts, and full reporting.
          </p>
        </section>

        <section className="fin-panel space-y-3">
          <h2 className="text-lg font-bold text-fin-navy">Corrections & updates</h2>
          <p>
            Publishers may update or correct their stories after publication. FinBrief&apos;s daily
            edition reflects the preview available when the edition was prepared. For the latest
            version, always refer to the source link.
          </p>
        </section>

        <p className="text-sm text-fin-subtle">
          Questions about sourcing?{" "}
          <Link href="/contact" className="fin-link">
            Contact us
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
