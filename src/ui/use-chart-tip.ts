import { useEffect, useRef, useState, type FocusEvent, type PointerEvent } from "react";
import type { Category } from "./category";

export type TipRow = { name: string; value: string; tone?: Category };
/** x / y are viewport pixels (physical); the tooltip converts to logical. */
export type Tip = { x: number; y: number; title: string; rows: TipRow[] };

const above = (el: Element) => {
  const b = el.getBoundingClientRect();
  return { x: b.left + b.width / 2, y: b.top };
};

/**
 * Tooltip state for a chart plus props for each hit target: focusable,
 * labelled, shown on hover, tap and focus, hidden on leave and blur. On
 * scroll a focused target's tooltip follows it (focusing scrolls it into
 * view); a pointer tooltip hides, since the pointer no longer marks the spot.
 */
export const useChartTip = () => {
  const [tip, setTip] = useState<Tip | null>(null);
  const anchor = useRef<Element | null>(null);
  const open = tip !== null;

  useEffect(() => {
    if (!open) return;
    const onScroll = () => {
      const el = anchor.current;
      setTip((t) => (t && el ? { ...t, ...above(el) } : null));
    };
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", onScroll, { capture: true });
  }, [open]);

  const target = (title: string, rows: TipRow[]) => {
    const at = (e: PointerEvent<SVGElement>) => {
      anchor.current = null;
      setTip({ x: e.clientX, y: e.clientY, title, rows });
    };
    const hide = () => {
      anchor.current = null;
      setTip(null);
    };
    return {
      tabIndex: 0,
      role: "img",
      "aria-label": `${title}: ${rows.map((r) => `${r.name} ${r.value}`).join(", ")}`,
      onPointerMove: at,
      onPointerDown: at,
      onPointerLeave: hide,
      onFocus: (e: FocusEvent<SVGElement>) => {
        anchor.current = e.currentTarget;
        setTip({ ...above(e.currentTarget), title, rows });
      },
      onBlur: hide,
    };
  };

  return { tip, target };
};
