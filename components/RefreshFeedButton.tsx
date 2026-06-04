"use client";

export function RefreshFeedButton({
  onClick,
  loading,
  loadingMessage = "Refreshing…",
  label = "Refresh briefings",
}: {
  onClick: () => void;
  loading: boolean;
  loadingMessage?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="fin-btn-secondary gap-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <svg
        className={`h-4 w-4 ${loading ? "animate-spin text-fin-brand" : ""}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
      {loading ? loadingMessage : label}
    </button>
  );
}
