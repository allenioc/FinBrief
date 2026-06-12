import { PageHeader } from "@/components/PageHeader";
import { BRAND } from "@/lib/theme";

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-shell px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        eyebrow={BRAND.name}
        title="Contact"
        description="Reach out with questions, feedback, or partnership inquiries."
      />

      <div className="fin-panel max-w-2xl space-y-4 text-sm text-fin-text">
        <p>
          FinBrief is an independent product focused on clear finance news briefings. For general
          inquiries, email{" "}
          <a href="mailto:hello@finbrief.app" className="fin-link">
            hello@finbrief.app
          </a>
          .
        </p>
        <p className="text-fin-subtle">
          For corrections to a specific story, please include the article title and link to the
          original publisher so we can review the summary in context.
        </p>
      </div>
    </div>
  );
}
