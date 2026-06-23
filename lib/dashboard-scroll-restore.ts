export const DASHBOARD_SCROLL_KEY = "finbrief-dashboard-scroll";

export type DashboardScrollState = {
  path: string;
  scrollY: number;
};

export function saveDashboardScroll(): void {
  if (typeof window === "undefined") return;
  try {
    const state: DashboardScrollState = {
      path: `${window.location.pathname}${window.location.search}`,
      scrollY: window.scrollY,
    };
    sessionStorage.setItem(DASHBOARD_SCROLL_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage failures.
  }
}

export function readDashboardScroll(): DashboardScrollState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DASHBOARD_SCROLL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DashboardScrollState;
    if (
      typeof parsed.path !== "string" ||
      typeof parsed.scrollY !== "number" ||
      !Number.isFinite(parsed.scrollY)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearDashboardScroll(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(DASHBOARD_SCROLL_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function peekDashboardReturnHref(fallback = "/"): string {
  return readDashboardScroll()?.path ?? fallback;
}

export function restoreDashboardScroll(): boolean {
  const state = readDashboardScroll();
  if (!state) return false;

  const currentPath = `${window.location.pathname}${window.location.search}`;
  if (state.path !== currentPath) return false;

  let attempts = 0;
  const apply = () => {
    window.scrollTo({ top: state.scrollY, left: 0, behavior: "auto" });
    attempts += 1;
    const tallEnough =
      document.documentElement.scrollHeight >= state.scrollY + window.innerHeight * 0.4;
    if (!tallEnough && attempts < 16) {
      requestAnimationFrame(apply);
      return;
    }
    clearDashboardScroll();
  };

  apply();
  return true;
}
