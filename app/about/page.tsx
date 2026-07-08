import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { BRAND } from "@/lib/theme";

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-shell px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        eyebrow={BRAND.name}
        title="About FinBrief"
        description="FinBrief helps you understand market drivers, asset-class moves, and potential risk exposures from saved finance headlines."
      />

      <div className="space-y-6 fin-body max-w-2xl text-sm text-fin-text">
        <section className="fin-panel space-y-3">
          <h2 className="text-lg font-bold text-fin-navy">What we do</h2>
          <p>
            FinBrief turns publicly reported business and finance news into clear, structured
            briefings. Each story includes a plain-language summary, context on why it matters, and
            links back to the original publisher.
          </p>
        </section>

        <section className="fin-panel space-y-3">
          <h2 className="text-lg font-bold text-fin-navy">How editions work</h2>
          <p>
            The Dashboard and Market Brief update once per day as a single edition. FinBrief
            organizes the day&apos;s headlines so you can scan what happened, why it may matter, and
            who could be affected — without refreshing every few minutes.
          </p>
        </section>

        <section className="fin-panel space-y-3">
          <h2 className="text-lg font-bold text-fin-navy">What we are not</h2>
          <p>
            FinBrief is for learning and context only. We do not provide investment advice,
            personalized recommendations, or trading signals. Always read the full article at the
            source before making financial decisions.
          </p>
        </section>

        <section id="sources-and-attribution" className="scroll-mt-8 space-y-4 pt-2">
          <div>
            <h2 className="text-lg font-bold text-fin-navy">Sources & attribution</h2>
            <p className="mt-3 text-sm text-fin-subtle">
              FinBrief summarizes publicly available reporting. Full articles always remain with the
              original publishers.
            </p>
          </div>

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
        </section>
      </div>
    </div>
  );
}
