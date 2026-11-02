import type { ReactNode } from "react";
import { Empty } from "../ui/empty";

// Small pieces shared by the Usage overview and its drill-ins.

const PATHS = {
  pulse: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  bars: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  back: (
    <>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </>
  ),
  screens: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18" />
    </>
  ),
  check: <path d="M5 12l5 5L20 7" />,
  funnel: <path d="M3 4h18l-7 8v6l-4 2v-8z" />,
  trip: <path d="M3 17l6-6 4 4 8-8" />,
  navigate: <path d="M3 11l18-8-8 18-2-8z" />,
  pen: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  car: (
    <>
      <path d="M5 17h14l-1.5-6.5A2 2 0 0 0 15.6 9H8.4a2 2 0 0 0-1.9 1.5z" />
      <circle cx="7.5" cy="17.5" r="1.5" />
      <circle cx="16.5" cy="17.5" r="1.5" />
    </>
  ),
  book: (
    <>
      <path d="M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2z" />
      <path d="M4 21V5" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="6" r="2" />
      <path d="M8 18h6a4 4 0 0 0 0-8h-4a4 4 0 0 1 0-8h6" />
    </>
  ),
  auto: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 18v2M17 18v2" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
} as const;

export type UsageIconName = keyof typeof PATHS;

export const UsageIcon = ({ name }: { name: UsageIconName }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {PATHS[name]}
  </svg>
);

export const LOADING = "Loading…";

/** A card's body while the report loads or failed: no numbers, about its loaded height. */
export const Waiting = ({ size = "preview", children }: { size?: "preview" | "chart" | "list"; children: ReactNode }) => (
  <div className={`use-wait use-wait-${size}`} aria-busy={children === LOADING}>
    {typeof children === "string" ? <Empty size="body">{children}</Empty> : children}
  </div>
);

/** A 13px note under a card's content (DESIGN.md "Footnote"). */
export const Note = ({ children }: { children: ReactNode }) => <p className="use-note">{children}</p>;

/** Two or three stat numbers side by side (28px, label under). */
export const Stats = ({ items }: { items: { value: ReactNode; label: string }[] }) => (
  <div className="use-stats" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
    {items.map((s) => (
      <div key={s.label}>
        <b>{s.value}</b>
        <span>{s.label}</span>
      </div>
    ))}
  </div>
);

export const RetryLine = ({ children, onRetry }: { children: ReactNode; onRetry: () => void }) => (
  <p className="use-retry" role="alert">
    {children}{" "}
    <button type="button" onClick={onRetry}>
      Try again
    </button>
  </p>
);
