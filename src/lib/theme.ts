import { useSyncExternalStore } from "react";
import {
  DEFAULT_TWEAKS,
  parseTweaks,
  resolveTheme,
  STORAGE_KEY,
  THEME_COLOR,
  type ResolvedTheme,
  type ThemePref,
  type Tweaks,
} from "./theme-prefs";

export type { Density, ResolvedTheme, ThemePref, Tweaks } from "./theme-prefs";

// Dashboard preferences in localStorage["charj-admin:tweaks"], held once for
// the whole app: every useTweaks() reads the same store, so the large-title
// toggle and Settings' Theme control always agree and a change applies at
// once everywhere. The store also keeps <html data-theme> and the
// theme-color metas in step (index.html sets the first value before paint).

const DARK = "(prefers-color-scheme: dark)";
const HAS_WINDOW = typeof window !== "undefined";

const subscribeSystem = (onChange: () => void) => {
  const mq = window.matchMedia(DARK);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
const systemIsDark = () => HAS_WINDOW && window.matchMedia(DARK).matches;

/** The OS colour scheme, live. */
export const useSystemDark = () => useSyncExternalStore(subscribeSystem, systemIsDark, () => false);

const load = (): Tweaks => {
  try {
    return parseTweaks(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return parseTweaks(null);
  }
};

const persist = (value: Tweaks) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // private mode / storage full: the choice just won't persist
  }
};

// <html data-theme> drives every token (and useCurrentTheme() for the maps).
// theme-color: with 'system' each media-scoped meta keeps its own scheme; an
// override paints both with the chosen ground.
const applyTheme = (pref: ThemePref) => {
  const resolved = resolveTheme(pref, systemIsDark());
  document.documentElement.setAttribute("data-theme", resolved);
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    const scheme: ResolvedTheme =
      pref === "system" ? (meta.media.includes("dark") ? "dark" : "light") : resolved;
    meta.content = THEME_COLOR[scheme];
  });
};

let current: Tweaks = HAS_WINDOW ? load() : { ...DEFAULT_TWEAKS };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const snapshot = () => current;
const serverSnapshot = () => DEFAULT_TWEAKS;

/** Change one preference: stored, applied and seen by every reader at once. */
export const setTweak = <K extends keyof Tweaks>(key: K, val: Tweaks[K]) => {
  if (current[key] === val) return;
  current = { ...current, [key]: val };
  persist(current);
  applyTheme(current.theme);
  emit();
};

if (HAS_WINDOW) {
  // Writes the migrated v2 shape back straight away.
  persist(current);
  applyTheme(current.theme);
  const mq = window.matchMedia(DARK);
  // 'system' follows a live OS change.
  const onSystem = () => applyTheme(current.theme);
  // Another tab changed the preference.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    current = parseTweaks(e.newValue);
    applyTheme(current.theme);
    emit();
  };
  mq.addEventListener("change", onSystem);
  window.addEventListener("storage", onStorage);
  import.meta.hot?.dispose(() => {
    mq.removeEventListener("change", onSystem);
    window.removeEventListener("storage", onStorage);
  });
}

/**
 * The shared preferences. `theme` is 'system' | 'light' | 'dark'; the third
 * tuple item is the theme in effect.
 */
export const useTweaks = (): [Tweaks, typeof setTweak, ResolvedTheme] => {
  const tweaks = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const resolved = resolveTheme(tweaks.theme, useSystemDark());
  return [tweaks, setTweak, resolved];
};
