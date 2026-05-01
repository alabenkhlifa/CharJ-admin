import { useEffect, useState } from "react";

const readTheme = (): "dark" | "light" => {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
};

// Tracks the live <html data-theme="..."> attribute. Components that style
// off-DOM resources (like a Google Map's styles array) need to react when
// the user toggles the theme.
export const useCurrentTheme = () => {
  const [theme, setTheme] = useState<"dark" | "light">(readTheme);

  useEffect(() => {
    const obs = new MutationObserver(() => setTheme(readTheme()));
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => obs.disconnect();
  }, []);

  return theme;
};
