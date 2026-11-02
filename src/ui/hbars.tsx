import { tone as baseTone, type Category } from "./category";
import { ChartKey } from "./chart-key";
import { ChartTooltip } from "./chart-tooltip";
import { TableView } from "./table-view";
import { useBoxWidth } from "./use-box-width";
import { useChartTip } from "./use-chart-tip";
import "./ui.css";

const nf = new Intl.NumberFormat("en-US");
const MIN_W = 280;
const ROW = 32;
const BAR = 16;
const END = 40;
const GAP = 2;
/** Rough 13px glyph width, to keep a label inside its gutter. */
const CHAR = 7;

export type HBarRow = { name: string; values: number[] };

type Props = {
  /** Drawn in this order; values line up with `series`. */
  rows: HBarRow[];
  series: { name: string; tone: Category }[];
  /** Accessible chart name ("Screen views"). */
  label: string;
  /** First column header of the table view. */
  labelHeader?: string;
};

const roundedEnd = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x} Z`;

const fit = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, Math.max(1, max - 1))}…`);

/**
 * Horizontal stacked bars at the container's real width: 32px rows, 16px
 * bars, labels in a 112px (narrow) or 128px start gutter, the total after the
 * bar. Each row is a focusable hit area with a tooltip; "Show table" has the numbers.
 */
export const HBars = ({ rows, series, label, labelHeader = "Name" }: Props) => {
  const [ref, box] = useBoxWidth<HTMLDivElement>();
  const { tip, target } = useChartTip();
  const at = (r: HBarRow, i: number) => r.values[i] ?? 0;
  const totals = rows.map((r) => series.reduce((a, _, i) => a + at(r, i), 0));
  const H = rows.length * ROW;

  let chart = null;
  if (box.width > 0 && rows.length > 0) {
    const W = Math.max(MIN_W, box.width);
    const L = W < 420 ? 112 : 128;
    const max = Math.max(1, ...totals);
    const x = (v: number) => (v / max) * (W - L - END);
    // Mirror x for text in RTL; text-anchor start/end follow the inherited
    // CSS direction by themselves, so the anchors stay fixed.
    const tx = (px: number) => (box.rtl ? W - px : px);
    chart = (
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="group" aria-label={label}>
        <g transform={box.rtl ? `translate(${W} 0) scale(-1 1)` : undefined}>
          {rows.map((r, ri) => {
            const yy = ri * ROW + 8;
            let off = 0;
            return (
              <g key={r.name}>
                {series.map((s, si) => {
                  const v = at(r, si);
                  if (!v) return null;
                  const last = series.slice(si + 1).every((_, k) => !at(r, si + 1 + k));
                  const xx = L + x(off) + (off ? GAP : 0);
                  const w = Math.max(1, x(v) - (off ? GAP : 0));
                  const rr = last ? Math.min(4, w, BAR / 2) : 0;
                  off += v;
                  return <path key={s.name} d={roundedEnd(xx, yy, w, BAR, rr)} style={{ fill: baseTone(s.tone) }} />;
                })}
              </g>
            );
          })}
          {rows.map((r, ri) => (
            <rect
              key={r.name}
              className="ui-hit"
              x={0}
              y={ri * ROW}
              width={W}
              height={ROW}
              {...target(r.name, series.map((s, si) => ({ name: s.name, value: nf.format(at(r, si)), tone: s.tone })))}
            />
          ))}
        </g>
        {rows.map((r, ri) => {
          const yy = ri * ROW + 8;
          return (
            <g key={r.name} aria-hidden="true">
              <text className="ui-lbl" x={tx(L - 10)} y={yy + 12} textAnchor="end">
                {fit(r.name, Math.floor((L - 14) / CHAR))}
              </text>
              <text className="ui-vl" x={tx(L + x(totals[ri]) + 8)} y={yy + 12} textAnchor="start">
                {nf.format(totals[ri])}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }

  const multi = series.length > 1;
  return (
    <>
      {multi && <ChartKey series={series} />}
      <div ref={ref} className="ui-chart" style={chart ? undefined : { minBlockSize: H }}>
        {chart}
      </div>
      <ChartTooltip tip={tip} />
      <TableView
        caption={label}
        head={[labelHeader, ...series.map((s) => s.name), ...(multi ? ["Total"] : [])]}
        numeric={series.map((_, i) => i + 1).concat(multi ? [series.length + 1] : [])}
        rows={rows.map((r, ri) => ({
          key: r.name,
          cells: [r.name, ...series.map((_, si) => nf.format(at(r, si))), ...(multi ? [nf.format(totals[ri])] : [])],
        }))}
      />
    </>
  );
};
