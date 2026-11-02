import { useEffect, useState } from "react";
import { tone as baseTone, toneText, type Category } from "./category";
import { TickNumber } from "./tick-number";
import "./ui.css";

export type Ring = {
  id: string;
  label: string;
  /** A number ticks up; "—" for a value that does not exist yet. */
  value: number | string;
  unit: string;
  /** 0..1 (use ringProgress). */
  progress: number;
  /** A goal under 10 draws this many ticks instead of a continuous arc (use ringSegments). */
  segments?: number;
  tone: Category;
  /** Usually scrolls to the ring's card (scrollToId). */
  onPick?: () => void;
};

const SIZE = 148;
const C0 = SIZE / 2;
const RADII = [64, 46, 28];
const STROKE = 15;
/** Visible gap between ticks; round caps eat STROKE of each pitch. */
const TICK_GAP = 4;
/** A zero keeps a dot so the ring stays legible. */
const FLOOR = 0.0001;
const nf = new Intl.NumberFormat("en-US");
/** The value as the legend shows it ("1,234"), not the raw number. */
const spoken = (value: number | string) => (typeof value === "number" ? nf.format(value) : value);

type ArcProps = { ring: Ring; r: number; drawn: boolean };

const ContinuousRing = ({ ring, r, drawn }: ArcProps) => {
  const c = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(FLOOR, Number.isFinite(ring.progress) ? ring.progress : 0));
  const pick = ring.onPick ? "ui-pick" : undefined;
  return (
    <>
      <circle cx={C0} cy={C0} r={r} className={pick} onClick={ring.onPick} style={{ stroke: baseTone(ring.tone), strokeOpacity: "var(--track)" }} />
      <circle
        cx={C0}
        cy={C0}
        r={r}
        className={pick ? `ui-ring-arc ${pick}` : "ui-ring-arc"}
        onClick={ring.onPick}
        strokeDasharray={c}
        strokeDashoffset={drawn ? c * (1 - p) : c}
        style={{ stroke: baseTone(ring.tone) }}
      />
    </>
  );
};

const SegmentedRing = ({ ring, r, drawn }: ArcProps) => {
  const n = Math.round(ring.segments ?? 1);
  const c = 2 * Math.PI * r;
  const pitch = c / n;
  const dash = Math.max(0.01, pitch - STROKE - TICK_GAP);
  const lit = Math.round(Math.min(1, Math.max(0, ring.progress || 0)) * n);
  const pick = ring.onPick ? "ui-pick" : undefined;
  return (
    <>
      {Array.from({ length: n }, (_, j) => {
        const shared = {
          cx: C0,
          cy: C0,
          r,
          onClick: ring.onPick,
          strokeDasharray: `${dash} ${c - dash}`,
          // Start each tick half a gap after its boundary; 12 o'clock is a boundary.
          strokeDashoffset: -(j * pitch + (STROKE + TICK_GAP) / 2),
        };
        return (
          <g key={j}>
            <circle {...shared} className={pick} style={{ stroke: baseTone(ring.tone), strokeOpacity: "var(--track)" }} />
            {j < lit && (
              <circle
                {...shared}
                className={pick ? `ui-ring-tick ${pick}` : "ui-ring-tick"}
                style={{
                  stroke: baseTone(ring.tone),
                  opacity: drawn ? 1 : 0,
                  transitionDelay: `${(j * 1.2) / n}s`,
                }}
              />
            )}
          </g>
        );
      })}
    </>
  );
};

/**
 * Up to three concentric rings (outside in: Active, Came back, Queue clear),
 * each arc a tap target, with a legend that does the same as buttons.
 */
export const Rings = ({ rings }: { rings: Ring[] }) => {
  // Start empty and fill on the next frame so the 1.2s transition runs on open.
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => setDrawn(true));
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const shown = rings.slice(0, RADII.length);
  return (
    <div className="ui-rings">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        {shown.map((ring, i) =>
          ring.segments && ring.segments > 0 ? (
            <SegmentedRing key={ring.id} ring={ring} r={RADII[i]} drawn={drawn} />
          ) : (
            <ContinuousRing key={ring.id} ring={ring} r={RADII[i]} drawn={drawn} />
          ),
        )}
      </svg>
      <div className="ui-legend">
        {shown.map((ring) => {
          const body = (
            <>
              <small style={{ color: toneText(ring.tone) }}>{ring.label}</small>
              <b>
                {typeof ring.value === "number" ? <TickNumber value={ring.value} /> : ring.value}
                <em>{ring.unit}</em>
              </b>
            </>
          );
          return ring.onPick ? (
            <button key={ring.id} type="button" onClick={ring.onPick} aria-label={`${ring.label}: ${spoken(ring.value)} ${ring.unit}. Show the card.`}>
              {body}
            </button>
          ) : (
            <div key={ring.id}>{body}</div>
          );
        })}
      </div>
    </div>
  );
};
