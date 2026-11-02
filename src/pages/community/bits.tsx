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
  // Row tiles (Row in ./row.tsx): one glyph per kind of item.
  check: <path d="M20 6 9 17l-5-5" />,
  cross: <path d="M18 6 6 18M6 6l12 12" />,
  bug: (
    <>
      <path d="M9 7.13v-1a3 3 0 1 1 6 0v1" />
      <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" />
      <path d="M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M20.97 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4" />
    </>
  ),
  bulb: (
    <>
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6M10 22h4" />
    </>
  ),
  heart: <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />,
  chat: <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />,
  pinPlus: (
    <>
      <path d="M19.9 11.1A7.3 7.3 0 0 0 20 10a8 8 0 0 0-16 0c0 5 5.5 10.2 7.4 11.8a1 1 0 0 0 1.2 0l.8-.7" />
      <circle cx="12" cy="10" r="3" />
      <path d="M16 18h6M19 15v6" />
    </>
  ),
  alert: (
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4M12 17h.01" />
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

/** "Couldn't load. Try again", with an optional second way out (`more`). */
export const RetryLine = ({ children, onRetry, more }: { children: ReactNode; onRetry: () => void; more?: ReactNode }) => (
  <p className="com-retry" role="alert">
    {children}{" "}
    <button type="button" onClick={onRetry}>
      Try again
    </button>
    {more}
  </p>
);

/**
 * Read the list (and the queue) again, by hand: nothing here reloads on a
 * timer. `saving`: a row's change is still on its way, and a read started now
 * could land after it with the old row, so Refresh waits for it.
 */
export const RefreshButton = ({ busy, saving = false, onRefresh }: { busy: boolean; saving?: boolean; onRefresh: () => void }) => (
  <button type="button" className="ui-link com-refresh" onClick={onRefresh} disabled={busy || saving} title={saving && !busy ? "Saving a change…" : undefined}>
    {busy ? "Refreshing…" : "Refresh"}
  </button>
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
