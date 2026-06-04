import { MOCK_DATA_NOTICE, UPDATE_SCHEDULE } from "@/lib/update-schedule";

export function UpdateScheduleFooter() {
  return (
    <footer className="mt-12 border-t border-fin-border pt-10">
      <h2 className="fin-section-title">How FinBrief updates</h2>
      <p className="mt-2 max-w-2xl text-sm text-fin-subtle">{MOCK_DATA_NOTICE}</p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {UPDATE_SCHEDULE.map((item) => (
          <li key={item.feed} className="fin-card p-5">
            <p className="font-bold text-fin-navy">{item.title}</p>
            <p className="mt-2 text-sm text-fin-subtle">{item.cadence}</p>
            <p className="mt-2 text-xs text-fin-subtle">{item.productionNote}</p>
          </li>
        ))}
      </ul>
    </footer>
  );
}
