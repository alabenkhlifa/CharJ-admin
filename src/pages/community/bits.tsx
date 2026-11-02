import type { ReactNode } from "react";
import { timeAgo } from "../../data/queue-report";
import { Empty } from "../../ui/empty";
import { nf, useNow } from "./format";

// Small pieces shared by the Community tabs.

const PATHS = {
  bell: (
    <>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10 21h4" />
    </>
  ),
  thumb: (
    <>
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
    </>
  ),
  plus: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  flag: (
    <>
      <path d="M5 21V4" />
      <path d="M5 4h11l-2 4 2 4H5" />
    </>
  ),
  star: <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z" />,
  pin: (
    <>
      <path d="M12 21s-7-6.1-7-12a7 7 0 0 1 14 0c0 5.9-7 12-7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </>
  ),
} as const;

export type ComIconName = keyof typeof PATHS;

export const ComIcon = ({ name }: { name: ComIconName }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {PATHS[name]}
  </svg>
);

/** The thumb of a design vote, down by turning it over. */
export const Thumb = ({ up, size = 16 }: { up: boolean; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={up ? undefined : { transform: "rotate(180deg)" }}
  >
    {PATHS.thumb}
  </svg>
);

export const LOADING = "Loading…";

/** A card's body while its list loads or failed: no numbers. */
export const Waiting = ({ children }: { children: ReactNode }) => (
  <div className="com-wait" aria-busy={children === LOADING}>
    {typeof children === "string" ? <Empty size="body">{children}</Empty> : children}
  </div>
);

export const RetryLine = ({ children, onRetry }: { children: ReactNode; onRetry: () => void }) => (
  <p className="com-retry" role="alert">
    {children}{" "}
    <button type="button" onClick={onRetry}>
      Try again
    </button>
  </p>
);

/** A 13px note under a card's content. */
export const Note = ({ children }: { children: ReactNode }) => <p className="com-note">{children}</p>;

/** Two to four stat numbers side by side; a null value is unknown and reads "—". */
export const Stats = ({ items }: { items: { value: number | null; label: string; alarm?: boolean }[] }) => (
  <div className={`com-stats com-stats-${items.length}`}>
    {items.map((s) => (
      <div key={s.label}>
        <b className={s.alarm && s.value ? "com-alarm" : undefined}>{s.value === null ? "—" : nf.format(s.value)}</b>
        <span>{s.label}</span>
      </div>
    ))}
  </div>
);

/** "3h ago", "1d ago", a date from 30 days on; the full time on hover. */
export const When = ({ iso }: { iso: string }) => {
  const now = useNow();
  const valid = Number.isFinite(Date.parse(iso));
  return (
    <time className="com-when" dateTime={iso} title={valid ? new Date(iso).toLocaleString("en-GB", { timeZone: "Africa/Tunis" }) : undefined}>
      {(valid && timeAgo(iso, now)) || "—"}
    </time>
  );
};
