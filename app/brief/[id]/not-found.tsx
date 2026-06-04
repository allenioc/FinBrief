import Link from "next/link";

export default function BriefNotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="text-xl font-bold text-fin-navy">Briefing not found</h1>
      <p className="mt-2 text-sm text-fin-subtle">
        This story may have been removed or the link is incorrect.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block text-sm font-medium text-fin-accent hover:underline"
      >
        Return to dashboard
      </Link>
    </div>
  );
}
