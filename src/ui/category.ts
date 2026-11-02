// Category colour names (DESIGN.md "Category colour map"). Each one owns three
// CSS tokens in src/index.css, switched per theme:
//   --c-<name>        base: rings, chart bars, progress bars
//   --c-<name>-text   coloured text (darker accessible tone on light)
//   --c-<name>-fill   squares and bubbles carrying a glyph (ink: --glyph)

export const CATEGORIES = [
  "active",
  "came-back",
  "queue",
  "needs-you",
  "alarm",
  "screens",
  "actions",
  "cars",
  "routes",
  "onboarding",
  "trip",
  "navigate",
  "contributions",
  "languages",
  "permissions",
  "users",
  "android-auto",
  "idle",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const tone = (c: Category) => `var(--c-${c})`;
export const toneText = (c: Category) => `var(--c-${c}-text)`;
export const toneFill = (c: Category) => `var(--c-${c}-fill)`;
