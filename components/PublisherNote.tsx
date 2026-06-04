export function PublisherNote({ compact = false }: { compact?: boolean }) {
  return (
    <p
      className={
        compact
          ? "text-xs leading-relaxed text-fin-subtle"
          : "rounded-lg border border-fin-border bg-fin-muted/50 px-4 py-3 text-xs leading-relaxed text-fin-subtle"
      }
    >
      FinBrief summarizes and explains publicly available financial news. Full articles
      remain with the original publishers.
    </p>
  );
}
