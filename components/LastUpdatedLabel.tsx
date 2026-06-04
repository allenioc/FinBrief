"use client";

import { useEffect, useState } from "react";
import { formatLastUpdated } from "@/lib/date-format";

export function LastUpdatedLabel({
  iso,
  prefix = "Last updated",
  className = "text-sm text-fin-subtle",
}: {
  iso: string;
  prefix?: string;
  className?: string;
}) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setLabel(formatLastUpdated(iso));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [iso]);

  const timeText = label?.replace(/^Updated /, "") ?? "…";

  return (
    <span className={className} suppressHydrationWarning>
      {prefix}: {timeText}
    </span>
  );
}
