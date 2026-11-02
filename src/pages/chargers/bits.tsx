import type { ReactNode } from "react";
import { CONNECTOR_COLORS, CONNECTOR_LABELS, STATUS_COLORS, type ChargerStatus, type ConnectorKey } from "../../data/chargers";
import { STATUS_LABELS } from "../../data/charger-catalog";
import { Empty } from "../../ui/empty";

// Small pieces shared by the Chargers views. Status and connector colours
// keep their meaning from data/chargers.ts, as marks only: the words beside
// them are always in Ink.

const PATHS = {
  charger: (
    <>
      <rect x="4" y="3" width="10" height="18" rx="2" />
      <path d="M14 9h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-3-3" />
      <path d="M9.5 7 7.5 11h3l-2 4" />
    </>
  ),
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  map: (
    <>
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" />
      <path d="M9 4v14M15 6v14" />
    </>
  ),
  bars: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  x: <path d="M6 6l12 12M6 18 18 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  download: <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />,
  verify: (
    <>
      <path d="M12 3l2.4 1.8 3-.2.9 2.9 2.5 1.7-1 2.8 1 2.8-2.5 1.7-.9 2.9-3-.2L12 21l-2.4-1.8-3 .2-.9-2.9-2.5-1.7 1-2.8-1-2.8 2.5-1.7.9-2.9 3 .2z" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </>
  ),
  bell: (
    <>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10 21h4" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </>
  ),
  pulse: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  plug: (
    <>
      <path d="M9 2v6M15 2v6" />
      <path d="M6 8h12v3a6 6 0 0 1-12 0z" />
      <path d="M12 17v5" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  pin: (
    <>
      <path d="M12 21s-7-6.1-7-12a7 7 0 0 1 14 0c0 5.9-7 12-7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </>
  ),
  wrench: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  chevron: <path d="m9 6 6 6-6 6" />,
  filter: <path d="M3 5h18M6 12h12M10 19h4" />,
} as const;

export type ChgIconName = keyof typeof PATHS;

export const ChgIcon = ({ name, size }: { name: ChgIconName; size?: number }) => (
  <svg
    className="chg-ic"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {PATHS[name]}
  </svg>
);

/** A status-coloured dot (the map pin's colour) and the status in words. */
export const StatusMark = ({ status }: { status: ChargerStatus }) => (
  <span className="chg-mark">
    <i className="chg-dot" style={{ background: STATUS_COLORS[status] }} />
    {STATUS_LABELS[status]}
  </span>
);

/** One small square per connector type, in its colour, with its name. */
export const ConnectorMarks = ({ keys }: { keys: ConnectorKey[] }) =>
  keys.length ? (
    <span className="chg-conns">
      {keys.map((k) => (
        <span key={k} className="chg-mark">
          <i className="chg-sq" style={{ background: CONNECTOR_COLORS[k] }} />
          {CONNECTOR_LABELS[k]}
        </span>
      ))}
    </span>
  ) : (
    <span className="chg-dim">No connectors</span>
  );

export const LOADING = "Loading…";

/** A card's body while its data loads or failed: no numbers. */
export const Waiting = ({ children, tall = false }: { children: ReactNode; tall?: boolean }) => (
  <div className={tall ? "chg-wait chg-wait-tall" : "chg-wait"} aria-busy={children === LOADING}>
    {typeof children === "string" ? <Empty size="body">{children}</Empty> : children}
  </div>
);

/** "Couldn't load. Try again" */
export const RetryLine = ({ children, onRetry }: { children: ReactNode; onRetry: () => void }) => (
  <p className="chg-retry" role="alert">
    {children}{" "}
    <button type="button" onClick={onRetry}>
      Try again
    </button>
  </p>
);

/** A 13px note under a card's content. */
export const Note = ({ children }: { children: ReactNode }) => <p className="chg-note">{children}</p>;
