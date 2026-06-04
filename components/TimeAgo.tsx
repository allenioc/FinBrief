"use client";

import { useEffect, useState } from "react";
import { formatLastUpdated } from "@/lib/date-format";

/** Relative feed time without hydration mismatch (client-only label). */
export function TimeAgo({ iso, className = "text-fin-subtle" }: { iso: string; className?: string }) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const update = () =>
      setText(formatLastUpdated(iso).replace(/^Updated /, ""));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [iso]);

  return (
    <time className={className} dateTime={iso} suppressHydrationWarning>
      {text ?? "—"}
    </time>
  );
}
