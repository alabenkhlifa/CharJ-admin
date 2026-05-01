import { useEffect, useState } from "react";

export type Theme = "dark" | "light";
export type Density = "comfortable" | "compact";
export type NumStyle = "tabular" | "mono";

export type Tweaks = {
  theme: Theme;
  density: Density;
  accent: string;
  numStyle: NumStyle;
};

const STORAGE_KEY = "charj-admin:tweaks";

const DEFAULTS: Tweaks = {
  theme: "dark",
  density: "comfortable",
  accent: "#0BD8B6",
  numStyle: "tabular",
};

const loadInitial = (): Tweaks => {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Tweaks>) };
  } catch {
    return DEFAULTS;
  }
};

const hexToRgba = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

export const useTweaks = (): [Tweaks, <K extends keyof Tweaks>(key: K, val: Tweaks[K]) => void] => {
  const [tweaks, setTweaks] = useState<Tweaks>(loadInitial);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", tweaks.theme);
    root.setAttribute("data-num", tweaks.numStyle);
    root.style.setProperty("--accent", tweaks.accent);
    root.style.setProperty("--accent-soft", hexToRgba(tweaks.accent, 0.12));
    root.style.setProperty("--accent-border", hexToRgba(tweaks.accent, 0.28));
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tweaks));
    } catch {
      // ignore
    }
  }, [tweaks]);

  const setTweak = <K extends keyof Tweaks>(key: K, val: Tweaks[K]) => {
    setTweaks((prev) => ({ ...prev, [key]: val }));
  };

  return [tweaks, setTweak];
};
