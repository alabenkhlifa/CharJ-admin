import { niceMax, shortDay } from "../lib/health-format";
import { tone as baseTone, type Category } from "./category";
import { ChartKey } from "./chart-key";
import { ChartTooltip } from "./chart-tooltip";
import { TableView } from "./table-view";
import { useBoxWidth } from "./use-box-width";
import { useChartTip } from "./use-chart-tip";
import "./ui.css";

const nf = new Intl.NumberFormat("en-US");
const MIN_W = 280;
const GUTTER = 30;
const BOTTOM = 22;
const TOP = 6;
const GAP = 2;

export type ColumnSeries = { name: string; tone: Category; values: number[] };

type Props = {
  /** One per column, usually ISO days. */
  labels: string[];
  /** Stacked bottom-up in this order. */
  series: ColumnSeries[];
  /** Accessible chart name ("Active phones per day"). */
  label: string;
  formatLabel?: (label: string) => string;
  height?: number;
  /** Fixed axis top (e.g. the number of test phones); otherwise a round max. */
  yMax?: number;
  /** First column header of the table view. */
  labelHeader?: string;
};

const roundedTop = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;

/**
 * Stacked columns drawn at the container's real width, 30px start gutter for
 * ticks, gridlines at 0 / half / max, x labels every 7th from the end. Every
 * column is a focusable hit area with a tooltip; "Show table" has the numbers.
 */
export const Columns = ({ labels, series, label, formatLabel = shortDay, height = 170, yMax, labelHeader = "Day" }: Props) => {
  const [ref, box] = useBoxWidth<HTMLDivElement>();
  const { tip, target } = useChartTip();
  const n = labels.length;
  const at = (s: ColumnSeries, i: number) => s.values[i] ?? 0;
  const totals = labels.map((_, i) => series.reduce((a, s) => a + at(s, i), 0));

  let chart = null;
  if (box.width > 0 && n > 0) {
    const W = Math.max(MIN_W, box.width);
    const H = height;
    const band = (W - GUTTER) / n;
    const bw = Math.max(4, band - 4);
    const top = yMax ?? niceMax(Math.max(1, ...totals));
    const y = (v: number) => H - BOTTOM - (v / top) * (H - BOTTOM - TOP);
    // Marks are drawn left-to-right and mirrored as a group in RTL; text is
    // placed with tx() so it never renders backwards.
    const tx = (x: number) => (box.rtl ? W - x : x);
    const ticks = top <= 2 ? [0, 1, 2] : [0, top / 2, top];
    chart = (
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="group" aria-label={label}>
        <g transform={box.rtl ? `translate(${W} 0) scale(-1 1)` : undefined}>
          {ticks.map((t) => (
            <line key={t} x1={GUTTER} x2={W} y1={y(t)} y2={y(t)} style={{ stroke: "var(--sep)" }} strokeWidth={1} />
          ))}
          {labels.map((lab, i) => {
            const x = GUTTER + band * i + (band - bw) / 2;
            let base = 0;
            return (
              <g key={lab}>
                {series.map((s, si) => {
                  const v = at(s, i);
                  if (!v) return null;
                  const y1 = y(base + v);
                  const h = Math.max(1, y(base) - y1 - (base ? GAP : 0));
                  const isTop = series.slice(si + 1).every((o) => !at(o, i));
                  const r = isTop ? Math.min(4, bw / 2, h) : 0;
                  base += v;
                  return <path key={s.name} d={roundedTop(x, y1, bw, h, r)} style={{ fill: baseTone(s.tone) }} />;
                })}
              </g>
            );
          })}
          {labels.map((lab, i) => (
            <rect
              key={lab}
              className="ui-hit"
              x={GUTTER + band * i}
              y={TOP}
              width={band}
              height={H - BOTTOM - TOP}
              {...target(formatLabel(lab), series.map((s) => ({ name: s.name, value: nf.format(at(s, i)), tone: s.tone })))}
            />
          ))}
        </g>
        {ticks.map((t) => (
          <text key={t} className="ui-tick" x={tx(GUTTER - 8)} y={y(t) + 4} textAnchor={box.rtl ? "start" : "end"}>
            {nf.format(t)}
          </text>
        ))}
        {labels.map((lab, i) =>
          (n - 1 - i) % 7 === 0 ? (
            <text key={lab} className="ui-tick" x={tx(GUTTER + band * i + band / 2)} y={H - 5} textAnchor="middle">
              {formatLabel(lab)}
            </text>
          ) : null,
        )}
      </svg>
    );
  }

  const multi = series.length > 1;
  return (
    <>
      {multi && <ChartKey series={series} />}
      <div ref={ref} className="ui-chart" style={chart ? undefined : { minBlockSize: height }}>
        {chart}
      </div>
      <ChartTooltip tip={tip} />
      <TableView
        caption={label}
        head={[labelHeader, ...series.map((s) => s.name), ...(multi ? ["Total"] : [])]}
        numeric={series.map((_, i) => i + 1).concat(multi ? [series.length + 1] : [])}
        rows={labels
          .map((lab, i) => ({
            key: lab,
            cells: [formatLabel(lab), ...series.map((s) => nf.format(at(s, i))), ...(multi ? [nf.format(totals[i])] : [])],
            total: totals[i],
          }))
          .filter((r) => r.total)}
      />
    </>
  );
};
