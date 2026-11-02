import type { ReactNode } from "react";
import { tone as baseTone, type Category } from "./category";
import "./ui.css";

type Props = {
  /**
   * One column per key (usually 30 days). A 0 is a 3px Fill stub (a real
   * zero); null is a day nobody measured: a hatched column, never a 0.
   */
  data: { key: string; value: number | null }[];
  tone: Category;
  /** Labels under the first and last column ("4 Oct", "Today"). */
  axis?: { start: ReactNode; end: ReactNode };
  /** Accessible summary ("Active phones per day, last 30 days"). */
  label?: string;
};

/** Sparkline columns growing from the bottom. */
export const Bars = ({ data, tone, axis, label }: Props) => {
  const max = Math.max(1, ...data.map((d) => d.value ?? 0));
  return (
    <>
      <div className="ui-bars" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
        {data.map((d, i) =>
          d.value === null ? (
            <i key={d.key} className="ui-bar-na" />
          ) : d.value ? (
            <i
              key={d.key}
              style={{
                blockSize: `${(d.value / max) * 100}%`,
                background: baseTone(tone),
                animationDelay: `${0.25 + i * 0.012}s`,
              }}
            />
          ) : (
            <i key={d.key} className="ui-bar-zero" />
          ),
        )}
      </div>
      {axis && (
        <div className="ui-ax" aria-hidden="true">
          <span>{axis.start}</span>
          <span>{axis.end}</span>
        </div>
      )}
    </>
  );
};
