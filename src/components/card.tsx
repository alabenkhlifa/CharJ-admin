import type { CSSProperties, ReactNode } from "react";
import { Icons } from "../lib/icons";
import { iconBtnStyle } from "./charts";
import { RANGE_KEYS, type RangeKey } from "../lib/time-range";

type CardProps = {
  children: ReactNode;
  style?: CSSProperties;
  padding?: number;
};

export const Card = ({ children, style, padding = 16 }: CardProps) => (
  <div
    style={{
      background: "var(--bg-elev)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      padding,
      ...style,
    }}
  >
    {children}
  </div>
);

// Every control here is opt-in and controlled by the parent. There is
// deliberately no local state: a header button that only moves its own
// highlight teaches you to distrust the whole dashboard. If a card doesn't
// pass `range`, no range selector renders; same for `onExport`.
type CardRange = {
  value: RangeKey;
  onChange: (next: RangeKey) => void;
  // Narrow the offered windows when shorter ones would be meaningless.
  options?: readonly RangeKey[];
};

type CardHeaderProps = {
  title: string;
  subtitle?: ReactNode;
  range?: CardRange;
  // Renders a Download button wired to this handler.
  onExport?: () => void;
  exportLabel?: string;
  // Extra controls appended after the built-ins.
  actions?: ReactNode;
};

export const CardHeader = ({
  title,
  subtitle,
  range,
  onExport,
  exportLabel = "Export CSV",
  actions,
}: CardHeaderProps) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        marginBottom: 16,
        gap: 12,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "var(--text)",
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{subtitle}</div>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {range && (
          <div
            role="group"
            aria-label={`${title} time range`}
            style={{
              display: "flex",
              border: "1px solid var(--border)",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            {(range.options ?? RANGE_KEYS).map((p) => {
              const on = range.value === p;
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={on}
                  onClick={() => range.onChange(p)}
                  style={{
                    padding: "4px 8px",
                    fontSize: 11,
                    background: on ? "var(--surface-hover)" : "transparent",
                    color: on ? "var(--text)" : "var(--text-dim)",
                    border: "none",
                    borderInlineEnd: "1px solid var(--border)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {p}
                </button>
              );
            })}
          </div>
        )}
        {onExport && (
          <button type="button" title={exportLabel} aria-label={exportLabel} onClick={onExport} style={iconBtnStyle}>
            <Icons.Download size={13} />
          </button>
        )}
        {actions}
      </div>
    </div>
  );
};

export const EmptyState = ({
  title = "Nothing here yet",
  subtitle = "When data arrives, it'll show up here.",
  children,
}: {
  title?: string;
  subtitle?: string;
  children?: ReactNode;
}) => (
  <div
    style={{
      padding: "60px 20px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 14,
      textAlign: "center",
    }}
  >
    <svg width="80" height="80" viewBox="0 0 80 80">
      <circle
        cx="40"
        cy="40"
        r="32"
        fill="none"
        stroke="var(--border-strong)"
        strokeWidth="1"
        strokeDasharray="3 4"
      />
      <rect
        x="28"
        y="32"
        width="24"
        height="20"
        rx="2"
        fill="var(--bg-elev-2)"
        stroke="var(--accent)"
        strokeWidth="1.2"
      />
      <path
        d="M 32 40 L 38 40 M 32 44 L 38 44"
        stroke="var(--accent)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <rect x="42" y="36" width="6" height="12" fill="var(--accent)" opacity="0.25" rx="1" />
      <circle cx="40" cy="22" r="3" fill="var(--accent)" opacity="0.6" />
    </svg>
    <div>
      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{title}</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{subtitle}</div>
    </div>
    {children}
  </div>
);
