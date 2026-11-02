import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { tone as baseTone } from "./category";
import type { Tip } from "./use-chart-tip";
import "./ui.css";

const EDGE = 8;
const OFFSET = 12;

/**
 * Chart tooltip, portalled to <body> so no transformed card clips or offsets
 * it. Placed with inset-inline-start / inset-block-start, never left/top, so
 * it sits on the reading side in RTL too. Visual only: hit targets carry the
 * same text as their aria-label.
 */
export const ChartTooltip = ({ tip }: { tip: Tip | null }) => {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !tip) return;
    const vw = document.documentElement.clientWidth;
    const rtl = getComputedStyle(el).direction === "rtl";
    const fromStart = rtl ? vw - tip.x : tip.x;
    const maxStart = vw - el.offsetWidth - EDGE;
    el.style.insetInlineStart = `${Math.max(EDGE, Math.min(maxStart, fromStart + OFFSET))}px`;
    el.style.insetBlockStart = `${Math.max(EDGE, tip.y - el.offsetHeight - OFFSET)}px`;
  }, [tip]);

  if (!tip) return null;
  return createPortal(
    <div ref={ref} className="ui-tip" aria-hidden="true">
      <div className="ui-tip-t">{tip.title}</div>
      {tip.rows.map((r) => (
        <div key={r.name} className="ui-tip-r">
          <span>
            {r.tone && <i style={{ background: baseTone(r.tone) }} />}
            {r.name}
          </span>
          <b>{r.value}</b>
        </div>
      ))}
    </div>,
    document.body,
  );
};
