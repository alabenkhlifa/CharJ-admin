import { useEffect, useRef, useState } from "react";

export type Box = { width: number; rtl: boolean };

/**
 * The element's real content width (and direction), kept live with a
 * ResizeObserver, so charts draw at true pixel size instead of scaling.
 * Width is 0 until the first measurement.
 */
export const useBoxWidth = <T extends HTMLElement>() => {
  const ref = useRef<T>(null);
  const [box, setBox] = useState<Box>({ width: 0, rtl: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      const rtl = getComputedStyle(el).direction === "rtl";
      setBox((prev) => (prev.width === width && prev.rtl === rtl ? prev : { width, rtl }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, box] as const;
};
