import { useId } from "react";
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

/** null = not tracked: a column where every series is null is drawn hatched, never as 0. */
export type ColumnSeries = { name: string; tone: Category; values: (number | null)[] };

type Props = {
  /** One per column, usually ISO days. */
  labels: string[];
  /** Stacked bottom-up in this order. */
  series: ColumnSeries[];
  /** Accessible chart name ("Active phones per day"). */
  label: string;
  formatLabel?: (label: string) => string;
  /** X-axis ticks, when they need to be shorter than the tooltip and table label. */
  formatTick?: (label: string) => string;
  height?: number;
  /** Fixed axis top (e.g. the number of test phones); a round max otherwise, or when a column is taller. */
  yMax?: number;
  /** First column header of the table view. */
  labelHeader?: string;
};

/**
 * Table rows: the columns with something in them, and one "not tracked" row
 * per run of unmeasured columns (first..last label); empty measured columns are left out.
 */
type TableRow = { key: string; first: string; last: string; index: number; na: boolean };
const tableRows = (labels: string[], untracked: boolean[], totals: number[]): TableRow[] => {
  const out: TableRow[] = [];
  labels.forEach((lab, i) => {
    const prev = out[out.length - 1];
    if (untracked[i] && prev?.na && untracked[i - 1]) prev.last = lab;
    else if (untracked[i]) out.push({ key: `na-${lab}`, first: lab, last: lab, index: i, na: true });
    else if (totals[i]) out.push({ key: lab, first: lab, last: lab, index: i, na: false });
  });
  return out;
};

const roundedTop = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;

/**
 * Stacked columns drawn at the container's real width, 30px start gutter for
 * ticks, gridlines at 0 / half / max, x labels every 7th from the end. Every
 * column is a focusable hit area with a tooltip; "Show table" has the numbers.
 * A column with no measurement (every series null) is a hatched band that
 * says "not tracked", in the tooltip and as one table row per run.
 */
export const Columns = ({
  labels,
  series,
  label,
  formatLabel = shortDay,
  formatTick = formatLabel,
  height = 170,
  yMax,
  labelHeader = "Day",
}: Props) => {
  const [ref, box] = useBoxWidth<HTMLDivElement>();
  const { tip, target } = useChartTip();
  const hatch = `ui-hatch-${useId().replace(/:/g, "")}`;
  const n = labels.length;
  const at = (s: ColumnSeries, i: number) => s.values[i] ?? 0;
  const untracked = labels.map((_, i) => series.length > 0 && series.every((s) => s.values[i] === null));
  const totals = labels.map((_, i) => series.reduce((a, s) => a + at(s, i), 0));

  let chart = null;
  if (box.width > 0 && n > 0) {
    const W = Math.max(MIN_W, box.width);
    const H = height;
    const band = (W - GUTTER) / n;
    const bw = Math.max(4, band - 4);
    // A fixed top only while it holds every column (and is a real positive
    // number); taller data gets a round max, so no bar runs off the chart.
    const highest = Math.max(1, ...totals);
    const top = yMax !== undefined && Number.isFinite(yMax) && yMax >= highest ? yMax : niceMax(highest);
    const y = (v: number) => H - BOTTOM - (v / top) * (H - BOTTOM - TOP);
    // Marks are drawn left-to-right and mirrored as a group in RTL; text is
    // placed with tx() so it never renders backwards. text-anchor start/end
    // already follow the inherited CSS direction, so anchors stay fixed.
    const tx = (x: number) => (box.rtl ? W - x : x);
    const ticks = top <= 2 ? [0, 1, 2] : [0, top / 2, top];
    chart = (
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="group" aria-label={label}>
        <defs>
          <pattern id={hatch} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="2" height="5" style={{ fill: "var(--fill)" }} />
          </pattern>
        </defs>
        <g transform={box.rtl ? `translate(${W} 0) scale(-1 1)` : undefined}>
          {labels.map((lab, i) =>
            untracked[i] ? (
              <rect key={`na-${lab}`} className="ui-col-na" x={GUTTER + band * i} y={TOP} width={band} height={H - BOTTOM - TOP} fill={`url(#${hatch})`} />
            ) : null,
          )}
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
              {...target(
                formatLabel(lab),
                untracked[i]
                  ? [{ name: "Not tracked", value: "—" }]
                  : series.map((s) => ({ name: s.name, value: nf.format(at(s, i)), tone: s.tone })),
              )}
            />
          ))}
        </g>
        {ticks.map((t) => (
          <text key={t} className="ui-tick" x={tx(GUTTER - 8)} y={y(t) + 4} textAnchor="end">
            {nf.format(t)}
          </text>
        ))}
        {labels.map((lab, i) =>
          (n - 1 - i) % 7 === 0 ? (
            <text key={lab} className="ui-tick" x={tx(GUTTER + band * i + band / 2)} y={H - 5} textAnchor="middle">
              {formatTick(lab)}
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
        rows={tableRows(labels, untracked, totals).map((r) =>
          r.na
            ? {
                key: r.key,
                cells: [
                  r.first === r.last ? formatLabel(r.first) : `${formatLabel(r.first)} – ${formatLabel(r.last)}`,
                  ...series.map((s) => (
                    <span key={s.name} className="ui-na">
                      not tracked
                    </span>
                  )),
                  ...(multi ? [""] : []),
                ],
              }
            : {
                key: r.key,
                cells: [
                  formatLabel(r.first),
                  ...series.map((s) => nf.format(at(s, r.index))),
                  ...(multi ? [nf.format(totals[r.index])] : []),
                ],
              },
        )}
      />
    </>
  );
};
