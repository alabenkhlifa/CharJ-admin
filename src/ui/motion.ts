// Motion helpers. CSS animations are switched off under reduced motion in
// index.css; these cover what JS drives (number ticks, ring-tap scrolling).

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Scroll a card into view; instant under reduced motion. */
export const scrollToId = (id: string) =>
  document.getElementById(id)?.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "center",
  });
