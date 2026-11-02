import { useLayoutEffect, useRef } from "react";
import { prefersReducedMotion } from "./motion";
import "./ui.css";

const DURATION = 700;

type Props = { value: number; decimals?: number };

/**
 * A number that counts from its previous value over 700ms (cubic ease-out),
 * and jumps under reduced motion. Assistive tech reads only the final value.
 */
export const TickNumber = ({ value, decimals = 0 }: Props) => {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const format = (v: number) =>
      v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    const paint = (v: number) => {
      shown.current = v;
      el.textContent = format(v);
    };
    const from = shown.current;
    if (prefersReducedMotion() || from === value || !Number.isFinite(value)) {
      paint(value);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / DURATION);
      paint(from + (value - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    el.textContent = format(from);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, decimals]);

  return (
    <>
      <span ref={ref} className="ui-num" aria-hidden="true" />
      <span className="ui-sr">{value.toLocaleString("en-US", { maximumFractionDigits: decimals })}</span>
    </>
  );
};
