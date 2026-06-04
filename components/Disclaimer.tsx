export function Disclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <p
      className={
        compact
          ? "text-xs leading-relaxed text-fin-subtle"
          : "fin-panel text-xs leading-relaxed text-fin-subtle"
      }
    >
      FinBrief provides educational market context only and is not investment advice.
      We do not recommend buying or selling any security.
    </p>
  );
}
