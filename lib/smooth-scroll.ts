import type Lenis from "lenis";

let lenisInstance: Lenis | null = null;

export function registerLenis(instance: Lenis | null): void {
  lenisInstance = instance;
}

export function scrollToY(y: number, options: { immediate?: boolean } = {}): void {
  const immediate = options.immediate ?? false;
  if (lenisInstance) {
    lenisInstance.scrollTo(y, { immediate });
    return;
  }
  window.scrollTo({ top: y, left: 0, behavior: immediate ? "auto" : "smooth" });
}

export function scrollToTop(options: { immediate?: boolean } = {}): void {
  scrollToY(0, options);
}
