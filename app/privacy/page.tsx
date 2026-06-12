import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { BRAND } from "@/lib/theme";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-shell px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        eyebrow={BRAND.name}
        title="Privacy"
        description="A simple overview of how FinBrief handles information on this site."
      />

      <div className="space-y-4 fin-body max-w-2xl text-sm text-fin-text">
        <section className="fin-panel space-y-3">
          <p>
            FinBrief stores watchlist topics and waitlist email addresses locally in your browser
            when you use those features. We do not require an account to browse the daily edition.
          </p>
          <p>
            If you join the email waitlist, your address is saved on your device until a mailing
            service is connected. We do not sell personal information.
          </p>
          <p>
            Standard hosting providers may collect technical logs (such as IP address and browser
            type) for security and performance. See your host&apos;s policies for details.
          </p>
        </section>
        <p className="text-sm text-fin-subtle">
          Questions? <Link href="/contact" className="fin-link">Contact us</Link>.
        </p>
      </div>
    </div>
  );
}
