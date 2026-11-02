// Stored dashboard preferences, pure so the migration is testable.
// index.html carries a copy of the theme part of parseTweaks + resolveTheme
// (it runs before first paint): change both together.

export type ThemePref = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";
export type Density = "comfortable" | "compact";

export type Tweaks = {
  v: 2;
  theme: ThemePref;
  density: Density;
};

export const STORAGE_KEY = "charj-admin:tweaks";

export const DEFAULT_TWEAKS: Tweaks = { v: 2, theme: "system", density: "comfortable" };

/** The grouped ground of each scheme (DESIGN.md), for <meta name="theme-color">. */
export const THEME_COLOR: Record<ResolvedTheme, string> = { light: "#f2f2f7", dark: "#000000" };

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;

/**
 * Reads the stored JSON. The old shape ({theme: 'dark'|'light', density,
 * accent, numStyle}, no `v`) always wrote `theme`, so its 'dark' is usually
 * just the old default: it becomes 'system'. A stored 'light' was a deliberate
 * toggle and stays. accent and numStyle are dropped.
 */
export const parseTweaks = (raw: string | null): Tweaks => {
  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  if (!isRecord(parsed)) return { ...DEFAULT_TWEAKS };
  const density: Density = parsed.density === "compact" ? "compact" : "comfortable";
  let theme: ThemePref = "system";
  if (parsed.v === 2) {
    if (parsed.theme === "light" || parsed.theme === "dark") theme = parsed.theme;
  } else if (parsed.theme === "light") {
    theme = "light";
  }
  return { v: 2, theme, density };
};

export const resolveTheme = (pref: ThemePref, systemDark: boolean): ResolvedTheme =>
  pref === "system" ? (systemDark ? "dark" : "light") : pref;
