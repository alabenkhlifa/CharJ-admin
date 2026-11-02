// When the app's usage was not measured. Pure (it imports only the pure
// health-format), so `node --test` loads it and every page reads the same spans (DESIGN.md: a missing value is
// "not tracked", never drawn as 0).
//
//   - Before 14 Sep 2026: analytics shipped that day (OTA 21/22).
//   - 16 Sep to 16 Oct 2026: record_app_events was broken
//     (migration 20260916000001) until 20261016000001 fixed it, so the app's
//     events didn't reach the server. Both edge days were only partly
//     recorded, so they count as not tracked.
// Days are ISO Tunis days (YYYY-MM-DD); both ends are inclusive.

import { MONTHS } from "./health-format.ts";

export type UntrackedSpan = {
  /** First untracked day; null = since forever. */
  from: string | null;
  /** Last untracked day. */
  to: string;
  /** Why, as a plain clause: "before analytics shipped". */
  why: string;
};

export const UNTRACKED: readonly UntrackedSpan[] = [
  { from: null, to: "2026-09-13", why: "before analytics shipped on 14 Sep 2026" },
  { from: "2026-09-16", to: "2026-10-16", why: "when the app's events didn't reach the server" },
];

const addDays = (isoDay: string, n: number): string => {
  const d = new Date(`${isoDay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** The day was measured. */
export const isTracked = (day: string, spans: readonly UntrackedSpan[] = UNTRACKED): boolean =>
  !spans.some((s) => (s.from === null || day >= s.from) && day <= s.to);

/** Some day in from..to (inclusive) was not measured. */
export const untrackedBetween = (from: string, to: string, spans: readonly UntrackedSpan[] = UNTRACKED): boolean =>
  spans.some((s) => (s.from === null || to >= s.from) && from <= s.to);

/**
 * A week's return window: its installers' day-1..N windows together run from
 * the day after the week starts to N days after its last day. If any of that
 * was not measured, the count would read low: the window is "not tracked".
 */
export const cohortWindowUntracked = (installWeek: string, n: number, spans: readonly UntrackedSpan[] = UNTRACKED): boolean =>
  untrackedBetween(addDays(installWeek, 1), addDays(installWeek, 6 + n), spans);

const month = (iso: string) => MONTHS[Number(iso.slice(5, 7)) - 1];
const dayOf = (iso: string) => Number(iso.slice(8, 10));

/** "4–16 Oct", "28 Sep – 3 Oct", "3 Aug – 13 Sep". */
export const rangeText = (from: string, to: string): string => {
  if (from === to) return `${dayOf(from)} ${month(from)}`;
  if (from.slice(0, 7) === to.slice(0, 7)) return `${dayOf(from)}–${dayOf(to)} ${month(to)}`;
  return `${dayOf(from)} ${month(from)} – ${dayOf(to)} ${month(to)}`;
};

/**
 * The untracked runs inside a list of days (sorted ISO days), each with its
 * reason: "4–16 Oct, when the app's events didn't reach the server".
 * Empty when every day was measured.
 */
export const untrackedRuns = (days: string[], spans: readonly UntrackedSpan[] = UNTRACKED): { from: string; to: string; text: string }[] => {
  const runs: { from: string; to: string; text: string }[] = [];
  for (const span of spans) {
    const inside = days.filter((d) => (span.from === null || d >= span.from) && d <= span.to);
    if (!inside.length) continue;
    const from = inside[0];
    const to = inside[inside.length - 1];
    runs.push({ from, to, text: `${rangeText(from, to)}, ${span.why}` });
  }
  return runs;
};

/** "Not tracked: 4–16 Oct, when the app's events didn't reach the server." or null. */
export const untrackedNote = (days: string[]): string | null => {
  const runs = untrackedRuns(days);
  return runs.length ? `Not tracked: ${runs.map((r) => r.text).join("; and ")}.` : null;
};

const TUNIS_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Tunis", year: "numeric", month: "2-digit", day: "2-digit" });

/** The Tunis day (YYYY-MM-DD) of an instant, as the server counts days; null for an unreadable one. */
export const tunisDay = (at: string | number | Date): string | null => {
  const d = new Date(at);
  return Number.isFinite(d.getTime()) ? TUNIS_DAY.format(d) : null;
};

/** The `m` days ending on `end` (inclusive), oldest first: a report's window. */
export const windowDays = (end: string, m: number): string[] => Array.from({ length: Math.max(0, m) }, (_, i) => addDays(end, i - m + 1));

export type WindowCoverage = {
  /** Days in the window that were measured. */
  measured: number;
  /** Days in the window. */
  of: number;
  /** The untracked runs inside it, each with its reason; empty when every day was measured. */
  runs: { from: string; to: string; text: string }[];
};

/** How much of an `m`-day window ending on `end` was measured. */
export const windowCoverage = (end: string, m: number, spans: readonly UntrackedSpan[] = UNTRACKED): WindowCoverage => {
  const days = windowDays(end, m);
  return { measured: days.filter((d) => isTracked(d, spans)).length, of: days.length, runs: untrackedRuns(days, spans) };
};

/**
 * For totals summed over a window: "Measured on 17 of these 30 days (not
 * tracked: 4–16 Oct, when the app's events didn't reach the server)." Null
 * when every day in the window was measured.
 */
export const measuredNote = (end: string, m: number, spans: readonly UntrackedSpan[] = UNTRACKED): string | null => {
  const c = windowCoverage(end, m, spans);
  if (!c.runs.length) return null;
  return `Measured on ${c.measured} of these ${c.of} days (not tracked: ${c.runs.map((r) => r.text).join("; and ")}).`;
};
