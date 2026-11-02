import { useEffect, useState, useSyncExternalStore, type FocusEvent, type PointerEvent } from "react";
import type { Category } from "./category";

/** `color` (a domain mark colour) wins over `tone` for the swatch. */
export type TipRow = { name: string; value: string; tone?: Category; color?: string };
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
 * One chart's tooltip, outside React state: a pointer move updates only the
 * tooltip (which subscribes), never the chart and its table. While a tip is
 * shown the store listens for scrolls and outside taps.
 */
export type TipStore = {
  get: () => Tip | null;
  subscribe: (listener: () => void) => () => void;
};

const createTipStore = () => {
  let tip: Tip | null = null;
  let mode: Mode | null = null;
  let target: Element | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  const onScroll = () => {
    if (mode === "focus" && target && tip) {
      tip = { ...tip, ...above(target) };
      emit();
    } else hide();
  };
  const onOutside = (e: globalThis.PointerEvent) => {
    if (mode === "pinned" && e.target !== target) hide();
  };
  const listen = (on: boolean) => {
    if (on) {
      window.addEventListener("scroll", onScroll, { capture: true, passive: true });
      document.addEventListener("pointerdown", onOutside, { capture: true });
    } else {
      window.removeEventListener("scroll", onScroll, { capture: true });
      document.removeEventListener("pointerdown", onOutside, { capture: true });
    }
  };

  function show(m: Mode, el: Element, at: { x: number; y: number }, title: string, rows: TipRow[]) {
    if (tip === null) listen(true);
    mode = m;
    target = el;
    tip = { ...at, title, rows };
    emit();
  }
  function hide() {
    if (tip === null) return;
    listen(false);
    mode = null;
    target = null;
    tip = null;
    emit();
  }

  const store: TipStore = {
    get: () => tip,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return { store, show, hide, mode: () => mode, target: () => target };
};

/** The current tip of a chart's store (for ChartTooltip). */
export const useTip = (store: TipStore): Tip | null => useSyncExternalStore(store.subscribe, store.get, store.get);

/**
 * Tooltip store for a chart plus props for each hit target: focusable,
 * labelled, shown on hover, tap and focus.
 */
export const useChartTip = () => {
  const [tips] = useState(createTipStore);
  // A chart that goes away takes its listeners with it.
  useEffect(() => () => tips.hide(), [tips]);

  const bind = (title: string, rows: TipRow[]) => {
    const show = (m: Mode, el: Element, at: { x: number; y: number }) => tips.show(m, el, at, title, rows);
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
        if (e.pointerType === "mouse" && tips.mode() === "hover") tips.hide();
      },
      onFocus: (e: FocusEvent<SVGElement>) => {
        // A tap that also focuses keeps its pinned tooltip at the finger.
        if (tips.mode() === "pinned" && tips.target() === e.currentTarget) return;
        show("focus", e.currentTarget, above(e.currentTarget));
      },
      onBlur: () => {
        if (tips.mode() !== "pinned") tips.hide();
      },
    };
  };

  return { tip: tips.store, target: bind };
};
