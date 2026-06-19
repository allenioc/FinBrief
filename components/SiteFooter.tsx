import Link from "next/link";
import { BRAND } from "@/lib/theme";

const FOOTER_LINKS = [
  { label: "About", href: "/about" },
  { label: "Sources", href: "/about#sources-and-attribution" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Contact", href: "/contact" },
] as const;

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-fin-border bg-fin-surface">
      <div className="mx-auto max-w-shell px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-sm">
            <p className="text-lg font-bold text-fin-navy">{BRAND.name}</p>
            <p className="mt-1 text-sm text-fin-subtle">{BRAND.tagline}</p>
            <p className="mt-4 text-sm text-fin-subtle">
              Clear, educational summaries of business and finance news — with full stories always at
              the original publisher.
            </p>
          </div>
          <nav
            className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-fin-navy"
            aria-label="Footer"
          >
            {FOOTER_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-fin-brand">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-8 space-y-1 border-t border-fin-border pt-6 text-xs text-fin-subtle">
          <p>Educational summaries only. Not investment advice.</p>
          <p>© {year} FinBrief. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
