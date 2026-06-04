export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-8">
      {eyebrow && <p className="fin-label text-fin-brand">{eyebrow}</p>}
      <h2 className="fin-page-title mt-2 text-balance">{title}</h2>
      {description && (
        <p className="mt-3 max-w-2xl fin-body text-fin-subtle">{description}</p>
      )}
      {children && <div className="mt-6">{children}</div>}
    </header>
  );
}
