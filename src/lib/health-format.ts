// Pure number and sentence helpers for the Health Rings pages (DESIGN.md:
// "Under 10, show counts only", "not tracked", segmented rings under 10).

const nf = new Intl.NumberFormat("en-US");
const fmt = (n: number) => nf.format(Number.isFinite(n) ? n : 0);

/** The two halves of countOrPercent, for layouts that wrap between them. */
export const countOrPercentParts = (n: number, of: number): { percent: string | null; counts: string } => ({
  percent: of >= 10 ? `${Math.round((n / of) * 100)}%` : null,
  counts: `${fmt(n)} of ${fmt(of)}`,
});

/** Under 10 in the group: "n of m". From 10: "p% (n of m)". */
export const countOrPercent = (n: number, of: number): string => {
  const { percent, counts } = countOrPercentParts(n, of);
  return percent ? `${percent} (${counts})` : counts;
};

/** Ring fill 0..1; 0 when there is no goal or the inputs are not numbers. */
export const ringProgress = (n: number, of: number): number => {
  if (!(of > 0) || !Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n / of));
};

/**
 * A goal under 10 draws that many ticks instead of a continuous arc, so 1 of 1
 * reads as one tick and not a closed ring. No goal (0) or a fractional one
 * keeps the plain ring.
 */
export const ringSegments = (of: number): number | undefined =>
  Number.isInteger(of) && of > 0 && of < 10 ? of : undefined;

export type WindowState = "not_tracked" | "open" | "final";

const addDays = (isoDay: string, n: number): string => {
  const d = new Date(`${isoDay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * A return window covers days 1..n after the install day. When tracking began
 * after its last day, nothing in it could have been seen: "not tracked", never 0.
 * `trackedFrom` null means the start is unknown, so the window flags decide.
 */
export const windowState = (
  installDay: string,
  trackedFrom: string | null,
  n: number,
  finished: boolean,
): WindowState => {
  if (trackedFrom && trackedFrom > addDays(installDay, n)) return "not_tracked";
  return finished ? "final" : "open";
};

/** "1 phone", "3 phones": drops a trailing s for exactly one. */
export const plural = (n: number, noun: string): string =>
  `${fmt(n)} ${n === 1 && noun.endsWith("s") ? noun.slice(0, -1) : noun}`;

const tunisWeekday = () =>
  new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "Africa/Tunis" }).format(new Date());

/**
 * One plain sentence comparing today with the same weekday last week (the
 * server counts last week only up to the same time of day). Null when both are 0.
 */
export const highlight = (
  today: number,
  lastWeekSameDay: number,
  noun: string,
  weekday: string = tunisWeekday(),
): string | null => {
  if (!today && !lastWeekSameDay) return null;
  const last = `last ${weekday}`;
  if (!today) return `No ${noun} yet today, ${fmt(lastWeekSameDay)} by this time ${last}`;
  const head = `${plural(today, noun)} today`;
  const diff = today - lastWeekSameDay;
  if (diff === 0) return `${head}, same as ${last}`;
  return `${head}, ${fmt(Math.abs(diff))} ${diff > 0 ? "more" : "fewer"} than ${last}`;
};

/** Fixed short month names: some ICU builds (Chrome, Node) write "Sept" for en-GB. */
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-02" → "2 Nov" (a calendar day; no time zone shift). */
export const shortDay = (isoDay: string): string => `${Number(isoDay.slice(8, 10))} ${MONTHS[Number(isoDay.slice(5, 7)) - 1]}`;

/** A round axis top: 2 for tiny counts, then 1/2/5 × 10^k. */
export const niceMax = (m: number): number => {
  if (!(m > 2)) return 2;
  if (m <= 5) return 5;
  const p = 10 ** Math.floor(Math.log10(m));
  const f = m / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
};
