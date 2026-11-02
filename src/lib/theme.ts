import { useEffect, useState, useSyncExternalStore } from "react";
import {
  parseTweaks,
  resolveTheme,
  STORAGE_KEY,
  THEME_COLOR,
  type ResolvedTheme,
  type ThemePref,
  type Tweaks,
} from "./theme-prefs";

export type { Density, ResolvedTheme, ThemePref, Tweaks } from "./theme-prefs";

const DARK = "(prefers-color-scheme: dark)";

const subscribeSystem = (onChange: () => void) => {
  const mq = window.matchMedia(DARK);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
const systemIsDark = () => window.matchMedia(DARK).matches;

/** The OS colour scheme, live. */
export const useSystemDark = () => useSyncExternalStore(subscribeSystem, systemIsDark, () => false);

const loadInitial = (): Tweaks => {
  try {
    return parseTweaks(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return parseTweaks(null);
  }
};

// <html data-theme> drives every token (and useCurrentTheme() for the maps).
// theme-color: with 'system' each media-scoped meta keeps its own scheme; an
// override paints both with the chosen ground.
const applyTheme = (pref: ThemePref, resolved: ResolvedTheme) => {
  document.documentElement.setAttribute("data-theme", resolved);
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    const scheme: ResolvedTheme =
      pref === "system" ? (meta.media.includes("dark") ? "dark" : "light") : resolved;
    meta.content = THEME_COLOR[scheme];
  });
};

/**
 * Dashboard preferences in localStorage["charj-admin:tweaks"]. `theme` is
 * 'system' | 'light' | 'dark'; the third tuple item is the theme in effect.
 */
export const useTweaks = (): [
  Tweaks,
  <K extends keyof Tweaks>(key: K, val: Tweaks[K]) => void,
  ResolvedTheme,
] => {
  const [tweaks, setTweaks] = useState<Tweaks>(loadInitial);
  const resolved = resolveTheme(tweaks.theme, useSystemDark());

  useEffect(() => {
    applyTheme(tweaks.theme, resolved);
  }, [tweaks.theme, resolved]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tweaks));
    } catch {
      // private mode / storage full: the choice just won't persist
    }
  }, [tweaks]);

  const setTweak = <K extends keyof Tweaks>(key: K, val: Tweaks[K]) => {
    setTweaks((prev) => ({ ...prev, [key]: val }));
  };

  return [tweaks, setTweak, resolved];
};
