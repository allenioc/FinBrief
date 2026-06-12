"use client";

import { FormEvent, useEffect, useState } from "react";

const STORAGE_KEY = "finbrief-waitlist-email";

export function NewsletterWaitlist() {
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setEmail(saved);
        setJoined(true);
      }
    } catch {
      // Ignore storage errors.
    }
  }, []);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@") || !trimmed.includes(".")) {
      setError("Enter a valid email address.");
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, trimmed);
      setJoined(true);
    } catch {
      setError("Could not save your email on this device. Please try again.");
    }
  }

  return (
    <section className="fin-panel border-l-4 border-l-fin-brand">
      <p className="fin-label text-fin-brand">Stay in the loop</p>
      <h2 className="mt-2 text-xl font-bold text-fin-navy">Get the daily briefing by email</h2>
      <p className="mt-2 max-w-2xl text-sm text-fin-subtle">
        Join the waitlist for FinBrief&apos;s morning edition — a calm, readable snapshot of the
        day&apos;s business and finance headlines.
      </p>
      {joined ? (
        <p className="mt-5 text-sm font-medium text-status-positive" role="status">
          You&apos;re on the list. We&apos;ll reach out when the daily email launches.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="flex-1 rounded-full border border-fin-border bg-fin-muted px-4 py-2.5 text-sm focus:border-fin-brand focus:outline-none focus:ring-2 focus:ring-fin-brand/20"
            aria-label="Email address"
          />
          <button type="submit" className="fin-btn-primary shrink-0">
            Join waitlist
          </button>
        </form>
      )}
      {error && (
        <p className="mt-3 text-sm text-status-warning" role="alert">
          {error}
        </p>
      )}
      <p className="mt-3 text-xs text-fin-subtle">
        No account required. One email when we launch — unsubscribe anytime.
      </p>
    </section>
  );
}
