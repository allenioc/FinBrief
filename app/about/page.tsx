import { PageHeader } from "@/components/PageHeader";
import { BRAND } from "@/lib/theme";

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-shell px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        eyebrow={BRAND.name}
        title="About FinBrief"
        description="FinBrief helps you understand business and finance news without wading through jargon or duplicate headlines."
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
      </div>
    </div>
  );
}
