import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { BRAND } from "@/lib/theme";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-shell px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        eyebrow={BRAND.name}
        title="Terms of use"
        description="By using FinBrief, you agree to the following terms."
      />

      <div className="space-y-4 fin-body max-w-2xl text-sm text-fin-text">
        <section className="fin-panel space-y-3">
          <p>
            FinBrief provides educational summaries of publicly reported news. Content is for
            general information only and is not investment, legal, or tax advice.
          </p>
          <p>
            Summaries may be incomplete or outdated relative to the source article. Always verify
            important facts with the original publisher before acting on them.
          </p>
          <p>
            FinBrief and its operators are not liable for decisions made based on summaries on this
            site. Use at your own discretion.
          </p>
        </section>
        <p className="text-sm text-fin-subtle">
          Questions? <Link href="/contact" className="fin-link">Contact us</Link>.
        </p>
      </div>
    </div>
  );
}
