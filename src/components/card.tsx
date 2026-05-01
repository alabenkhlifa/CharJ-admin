import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Icons } from "../lib/icons";
import { iconBtnStyle } from "./charts";

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

type CardHeaderProps = {
  title: string;
  subtitle?: string;
  periodSelector?: boolean;
};

export const CardHeader = ({ title, subtitle, periodSelector = true }: CardHeaderProps) => {
  const [period, setPeriod] = useState("30d");
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
        {periodSelector && (
          <div
            style={{
              display: "flex",
              border: "1px solid var(--border)",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            {(["7d", "30d", "90d", "1y"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  padding: "4px 8px",
                  fontSize: 11,
                  background: period === p ? "var(--surface-hover)" : "transparent",
                  color: period === p ? "var(--text)" : "var(--text-dim)",
                  border: "none",
                  borderInlineEnd: "1px solid var(--border)",
                }}
              >
                {p}
              </button>
            ))}
          </div>
        )}
        <button title="Export CSV" style={iconBtnStyle}>
          <Icons.Download size={13} />
        </button>
        <button title="Fullscreen" style={iconBtnStyle}>
          <Icons.Expand size={13} />
        </button>
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
