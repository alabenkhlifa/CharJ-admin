import { useEffect, useRef, useState, type FocusEvent, type PointerEvent } from "react";
import type { Category } from "./category";

export type TipRow = { name: string; value: string; tone?: Category };
/** x / y are viewport pixels (physical); the tooltip converts to logical. */
export type Tip = { x: number; y: number; title: string; rows: TipRow[] };

/**
 * hover  mouse over a target: follows the pointer, hides on leave.
 * pinned a tap (touch or pen): stays until a tap elsewhere or a scroll.
 *        Touch fires pointerleave right after the finger lifts, and iOS may
 *        not focus an SVG element, so a tap can't rely on either.
 * focus  keyboard: sits above the target and follows it while the focus
 *        scroll brings it into view; hides on blur.
 */
type Mode = "hover" | "pinned" | "focus";

const above = (el: Element) => {
  const b = el.getBoundingClientRect();
  return { x: b.left + b.width / 2, y: b.top };
};

/**
 * Tooltip state for a chart plus props for each hit target: focusable,
 * labelled, shown on hover, tap and focus.
 */
export const useChartTip = () => {
  const [tip, setTip] = useState<Tip | null>(null);
  const mode = useRef<Mode | null>(null);
  const target = useRef<Element | null>(null);
  const open = tip !== null;

  useEffect(() => {
    if (!open) return;
    const hide = () => {
      mode.current = null;
      target.current = null;
      setTip(null);
    };
    const onScroll = () => {
      const el = target.current;
      if (mode.current === "focus" && el) setTip((t) => (t ? { ...t, ...above(el) } : null));
      else hide();
    };
    const onOutside = (e: globalThis.PointerEvent) => {
      if (mode.current === "pinned" && e.target !== target.current) hide();
    };
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    document.addEventListener("pointerdown", onOutside, { capture: true });
    return () => {
      window.removeEventListener("scroll", onScroll, { capture: true });
      document.removeEventListener("pointerdown", onOutside, { capture: true });
    };
  }, [open]);

  const bind = (title: string, rows: TipRow[]) => {
    const show = (m: Mode, el: Element, at: { x: number; y: number }) => {
      mode.current = m;
      target.current = el;
      setTip({ ...at, title, rows });
    };
    const hide = () => {
      mode.current = null;
      target.current = null;
      setTip(null);
    };
    const atPointer = (e: PointerEvent<SVGElement>) => ({ x: e.clientX, y: e.clientY });
    return {
      tabIndex: 0,
      role: "img",
      "aria-label": `${title}: ${rows.map((r) => `${r.name} ${r.value}`).join(", ")}`,
      onPointerMove: (e: PointerEvent<SVGElement>) => {
        if (e.pointerType === "mouse") show("hover", e.currentTarget, atPointer(e));
      },
      onPointerDown: (e: PointerEvent<SVGElement>) => {
        show(e.pointerType === "mouse" ? "hover" : "pinned", e.currentTarget, atPointer(e));
      },
      onPointerLeave: (e: PointerEvent<SVGElement>) => {
        if (e.pointerType === "mouse" && mode.current === "hover") hide();
      },
      onFocus: (e: FocusEvent<SVGElement>) => {
        // A tap that also focuses keeps its pinned tooltip at the finger.
        if (mode.current === "pinned" && target.current === e.currentTarget) return;
        show("focus", e.currentTarget, above(e.currentTarget));
      },
      onBlur: () => {
        if (mode.current !== "pinned") hide();
      },
    };
  };

  return { tip, target: bind };
};
