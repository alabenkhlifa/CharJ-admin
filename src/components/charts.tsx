import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

function useSize(ref: React.RefObject<HTMLElement | null>, fallbackW = 600, fallbackH = 200) {
  const [size, setSize] = useState({ w: fallbackW, h: fallbackH });
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const cr = e.contentRect;
        setSize({ w: Math.max(40, cr.width), h: Math.max(40, cr.height) });
      }
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

// ── Sparkline ──────────────────────────────────────────────────────────────
type SparklineProps = {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
  fill?: boolean;
  strokeW?: number;
};

export const Sparkline = ({
  data,
  color = "var(--accent)",
  height = 40,
  width = 120,
  fill = true,
  strokeW = 1.5,
}: SparklineProps) => {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data.map((v, i): [number, number] => [
    i * stepX,
    height - 4 - ((v - min) / range) * (height - 8),
  ]);
  const path = points
    .map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`))
    .join(" ");
  const areaPath = `${path} L${width},${height} L0,${height} Z`;
  const last = points[points.length - 1];
  return (
    <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
      {fill && <path d={areaPath} fill={color} fillOpacity={0.12} />}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={strokeW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill={color} />
    </svg>
  );
};

// ── Area chart (filled) ───────────────────────────────────────────────────
type AreaChartProps<T> = {
  data: T[];
  xKey: keyof T;
  yKey: keyof T;
  color?: string;
  height?: number;
  formatY?: (v: number) => string;
};

export function AreaChart<T extends Record<string, unknown>>({
  data,
  xKey,
  yKey,
  color = "var(--accent)",
  height = 220,
  formatY = (v) => String(v),
}: AreaChartProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const { w } = useSize(ref, 600, height);
  const padL = 40,
    padR = 16,
    padT = 16,
    padB = 28;
  const innerW = w - padL - padR;
  const innerH = height - padT - padB;
  const ys = data.map((d) => Number(d[yKey]));
  const ymin = Math.min(...ys);
  const ymax = Math.max(...ys);
  const yPad = (ymax - ymin) * 0.2 || 1;
  const yLo = Math.max(0, ymin - yPad);
  const yHi = ymax + yPad;
  const stepX = innerW / (data.length - 1 || 1);
  const pts = data.map((d, i): [number, number] => [
    padL + i * stepX,
    padT + innerH - ((Number(d[yKey]) - yLo) / (yHi - yLo)) * innerH,
  ]);
  const path = pts
    .map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`))
    .join(" ");
  const area = `${path} L${pts[pts.length - 1][0]},${padT + innerH} L${pts[0][0]},${padT + innerH} Z`;
  const yTicks = 4;
  return (
    <div ref={ref} style={{ width: "100%", height }}>
      <svg width={w} height={height} style={{ display: "block" }}>
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const yv = yLo + ((yHi - yLo) * i) / yTicks;
          const y = padT + innerH - (i / yTicks) * innerH;
          return (
            <g key={i}>
              <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="var(--grid)" strokeWidth={1} />
              <text
                x={padL - 8}
                y={y + 3}
                fill="var(--text-dim)"
                fontSize="10"
                textAnchor="end"
                className="num"
              >
                {formatY(yv)}
              </text>
            </g>
          );
        })}
        <path d={area} fill={color} fillOpacity={0.14} />
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {data.map((d, i) => (
          <text
            key={i}
            x={pts[i][0]}
            y={height - 8}
            fill="var(--text-dim)"
            fontSize="10"
            textAnchor="middle"
          >
            {String(d[xKey])}
          </text>
        ))}
        {pts.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={2} fill="var(--bg)" stroke={color} strokeWidth={1.4} />
        ))}
      </svg>
    </div>
  );
}

// ── Stacked area ──────────────────────────────────────────────────────────
type StackedKey<T> = { key: keyof T; label: string; color: string };

type StackedAreaProps<T> = {
  data: T[];
  xKey: keyof T;
  keys: StackedKey<T>[];
  height?: number;
};

export function StackedAreaChart<T extends Record<string, unknown>>({
  data,
  xKey,
  keys,
  height = 220,
}: StackedAreaProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const { w } = useSize(ref, 600, height);
  const padL = 32,
    padR = 16,
    padT = 16,
    padB = 28;
  const innerW = w - padL - padR;
  const innerH = height - padT - padB;
  const totals = data.map((d) => keys.reduce((s, k) => s + Number(d[k.key]), 0));
  const ymax = Math.max(...totals) * 1.1;
  const stepX = innerW / (data.length - 1 || 1);
  const stacks: { lo: number; hi: number }[][] = keys.map(() =>
    Array.from({ length: data.length }, () => ({ lo: 0, hi: 0 })),
  );
  data.forEach((d, i) => {
    let cum = 0;
    keys.forEach((k, ki) => {
      const v = Number(d[k.key]);
      stacks[ki][i] = { lo: cum, hi: cum + v };
      cum += v;
    });
  });
  const yPos = (v: number) => padT + innerH - (v / ymax) * innerH;
  return (
    <div ref={ref} style={{ width: "100%", height }}>
      <svg width={w} height={height} style={{ display: "block" }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
          <line
            key={i}
            x1={padL}
            x2={w - padR}
            y1={padT + innerH - f * innerH}
            y2={padT + innerH - f * innerH}
            stroke="var(--grid)"
          />
        ))}
        {keys.map((k, ki) => {
          const top = stacks[ki].map((s, i): [number, number] => [padL + i * stepX, yPos(s.hi)]);
          const bot = stacks[ki]
            .map((s, i): [number, number] => [padL + i * stepX, yPos(s.lo)])
            .reverse();
          const path =
            [...top, ...bot]
              .map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`))
              .join(" ") + " Z";
          return <path key={String(k.key)} d={path} fill={k.color} fillOpacity={0.85} stroke={k.color} strokeWidth={0.5} />;
        })}
        {data.map((d, i) => (
          <text
            key={i}
            x={padL + i * stepX}
            y={height - 8}
            fill="var(--text-dim)"
            fontSize="10"
            textAnchor="middle"
          >
            {String(d[xKey])}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ── Stacked bar (vertical) ────────────────────────────────────────────────
type StackedBarProps<T> = {
  data: T[];
  xKey: keyof T;
  keys: StackedKey<T>[];
  height?: number;
};

export function StackedBarChart<T extends Record<string, unknown>>({
  data,
  xKey,
  keys,
  height = 220,
}: StackedBarProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const { w } = useSize(ref, 600, height);
  const padL = 32,
    padR = 16,
    padT = 16,
    padB = 28;
  const innerW = w - padL - padR;
  const innerH = height - padT - padB;
  const totals = data.map((d) => keys.reduce((s, k) => s + Number(d[k.key]), 0));
  const ymax = Math.max(...totals) * 1.1;
  const barW = (innerW / data.length) * 0.62;
  return (
    <div ref={ref} style={{ width: "100%", height }}>
      <svg width={w} height={height} style={{ display: "block" }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
          <line
            key={i}
            x1={padL}
            x2={w - padR}
            y1={padT + innerH - f * innerH}
            y2={padT + innerH - f * innerH}
            stroke="var(--grid)"
          />
        ))}
        {data.map((d, i) => {
          const cx = padL + (innerW / data.length) * (i + 0.5);
          let y = padT + innerH;
          return (
            <g key={i}>
              {keys.map((k) => {
                const v = Number(d[k.key]);
                const h = (v / ymax) * innerH;
                y -= h;
                return (
                  <rect
                    key={String(k.key)}
                    x={cx - barW / 2}
                    y={y}
                    width={barW}
                    height={h}
                    fill={k.color}
                    rx={1}
                  />
                );
              })}
              <text x={cx} y={height - 8} fill="var(--text-dim)" fontSize="10" textAnchor="middle">
                {String(d[xKey])}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Histogram ─────────────────────────────────────────────────────────────
type HistogramProps = {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
};

export const Histogram = ({ data, height = 200, color = "var(--accent)" }: HistogramProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const { w } = useSize(ref, 600, height);
  const padL = 28,
    padR = 16,
    padT = 16,
    padB = 36;
  const innerW = w - padL - padR;
  const innerH = height - padT - padB;
  const ymax = Math.max(...data.map((d) => d.value)) * 1.15;
  const barW = (innerW / data.length) * 0.55;
  return (
    <div ref={ref} style={{ width: "100%", height }}>
      <svg width={w} height={height} style={{ display: "block" }}>
        {[0, 0.5, 1].map((f, i) => (
          <line
            key={i}
            x1={padL}
            x2={w - padR}
            y1={padT + innerH - f * innerH}
            y2={padT + innerH - f * innerH}
            stroke="var(--grid)"
          />
        ))}
        {data.map((d, i) => {
          const cx = padL + (innerW / data.length) * (i + 0.5);
          const h = (d.value / ymax) * innerH;
          const [first, ...rest] = d.label.split(" ");
          return (
            <g key={i}>
              <rect
                x={cx - barW / 2}
                y={padT + innerH - h}
                width={barW}
                height={h}
                fill={color}
                rx={2}
              />
              <text
                x={cx}
                y={padT + innerH - h - 6}
                fill="var(--text)"
                fontSize="11"
                textAnchor="middle"
                className="num"
              >
                {d.value}
              </text>
              <text x={cx} y={height - 18} fill="var(--text-muted)" fontSize="10" textAnchor="middle">
                {first}
              </text>
              <text x={cx} y={height - 6} fill="var(--text-dim)" fontSize="9" textAnchor="middle">
                {rest.join(" ")}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ── Horizontal bar list ───────────────────────────────────────────────────
type HBarRow = { name?: string; count?: number; op?: number; [k: string]: unknown };

type HBarListProps<T extends HBarRow> = {
  data: T[];
  valueKey?: keyof T;
  labelKey?: keyof T;
  color?: string;
  showOp?: boolean;
};

export function HBarList<T extends HBarRow>({
  data,
  valueKey = "count" as keyof T,
  labelKey = "name" as keyof T,
  color = "var(--accent)",
  showOp = false,
}: HBarListProps<T>) {
  const max = Math.max(...data.map((d) => Number(d[valueKey])));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {data.map((d, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "104px 1fr 56px",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {String(d[labelKey])}
          </div>
          <div
            style={{
              position: "relative",
              height: 18,
              background: "var(--bg-elev-2)",
              borderRadius: 4,
              overflow: "hidden",
              border: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                width: `${(Number(d[valueKey]) / max) * 100}%`,
                height: "100%",
                background: color,
                opacity: 0.85,
                transition: "width .4s",
              }}
            />
            {showOp && d.op !== undefined && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  width: `${(Number(d.op) / max) * 100}%`,
                  background: "#10B981",
                  opacity: 0.55,
                }}
              />
            )}
          </div>
          <div
            className="num"
            style={{ fontSize: 12, color: "var(--text)", textAlign: "end", fontWeight: 500 }}
          >
            {Number(d[valueKey])}
            {showOp && d.op !== undefined && (
              <span style={{ color: "var(--text-dim)", marginInlineStart: 4 }}>·{d.op}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Donut ─────────────────────────────────────────────────────────────────
type DonutProps = {
  data: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
};

export const Donut = ({ data, size = 180, thickness = 22 }: DonutProps) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = size / 2 - thickness / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
      <svg width={size} height={size} style={{ overflow: "visible" }}>
        <g transform={`translate(${size / 2},${size / 2}) rotate(-90)`}>
          <circle r={r} fill="none" stroke="var(--bg-elev-2)" strokeWidth={thickness} />
          {data.map((d, i) => {
            const len = (d.value / total) * c;
            const seg = (
              <circle
                key={i}
                r={r}
                fill="none"
                stroke={d.color}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += len;
            return seg;
          })}
        </g>
        <text
          x={size / 2}
          y={size / 2 - 4}
          textAnchor="middle"
          fill="var(--text)"
          fontSize="22"
          fontWeight="600"
          className="num"
        >
          {total}
        </text>
        <text
          x={size / 2}
          y={size / 2 + 14}
          textAnchor="middle"
          fill="var(--text-dim)"
          fontSize="10"
          letterSpacing="0.08em"
        >
          CHARGERS
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: d.color,
                flexShrink: 0,
              }}
            />
            <span style={{ color: "var(--text-muted)", flex: 1 }}>{d.label}</span>
            <span className="num" style={{ color: "var(--text)", fontWeight: 500 }}>
              {d.value}
            </span>
            <span
              className="num"
              style={{ color: "var(--text-dim)", width: 38, textAlign: "end" }}
            >
              {((d.value / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Funnel ────────────────────────────────────────────────────────────────
type FunnelProps = { data: { stage: string; value: number; color: string }[] };

export const Funnel = ({ data }: FunnelProps) => {
  const max = Math.max(...data.map((d) => d.value));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {data.map((d, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "120px 1fr 64px",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{d.stage}</div>
          <div
            style={{
              height: 26,
              background: "var(--bg-elev-2)",
              borderRadius: 4,
              overflow: "hidden",
              position: "relative",
              border: "1px solid var(--border)",
            }}
          >
            <div
              className="num"
              style={{
                width: `${(d.value / max) * 100}%`,
                height: "100%",
                background: d.color,
                opacity: 0.9,
                display: "flex",
                alignItems: "center",
                paddingInline: 8,
                color: "#fff",
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              {d.value}
            </div>
          </div>
          <div
            className="num"
            style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "end" }}
          >
            {((d.value / data[0].value) * 100).toFixed(0)}%
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Stacked horizontal bar ────────────────────────────────────────────────
type StackedHBarProps = { data: { label: string; value: number; color: string }[]; height?: number };

export const StackedHBar = ({ data, height = 28 }: StackedHBarProps) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div>
      <div
        style={{
          display: "flex",
          height,
          borderRadius: 4,
          overflow: "hidden",
          border: "1px solid var(--border)",
        }}
      >
        {data.map((d, i) => (
          <div
            key={i}
            style={{
              width: `${(d.value / total) * 100}%`,
              background: d.color,
              opacity: 0.9,
            }}
            title={`${d.label}: ${d.value}`}
          />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
        {data.map((d, i) => (
          <div
            key={i}
            style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color }} />
            <span style={{ color: "var(--text-muted)", flex: 1 }}>{d.label}</span>
            <span className="num" style={{ color: "var(--text)", fontWeight: 500 }}>
              {d.value}
            </span>
            <span
              className="num"
              style={{ color: "var(--text-dim)", width: 36, textAlign: "end" }}
            >
              {((d.value / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const iconBtnStyle: CSSProperties = {
  width: 26,
  height: 26,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text-muted)",
};
