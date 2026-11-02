// Small pure helpers shared by the Chargers views. `now` is passed in (the
// page's open time), so rendering stays pure.

import type { WorkingHours } from "../../data/chargers.ts";
import { MONTHS } from "../../lib/health-format.ts";

export const nf = new Intl.NumberFormat("en-US");

/** "just now", "12 min ago", "3 h ago", "5 d ago", then a date. */
export const fmtAgo = (iso: string, now: number): string => {
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return "—";
  const min = Math.round((now - at) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} d ago`;
  return tunisDate(at);
};

const TUNIS_PARTS = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "numeric", year: "numeric", timeZone: "Africa/Tunis" });
/** "3 Oct 2026" on Tunis time, with fixed month names (some ICU builds write "Sept"). */
export const tunisDate = (ms: number): string => {
  const part = (type: string) => Number(TUNIS_PARTS.formatToParts(ms).find((p) => p.type === type)?.value);
  return `${part("day")} ${MONTHS[part("month") - 1]} ${part("year")}`;
};

/** The full time, for a tooltip. */
export const fullTime = (iso: string): string | undefined => {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? undefined : at.toLocaleString("en-GB", { timeZone: "Africa/Tunis" });
};

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const TUNIS_WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "Africa/Tunis" });

/** Monday 0 … Sunday 6, on Tunis time. */
export const tunisDayIndex = (now: number): number => Math.max(0, DAYS.indexOf(TUNIS_WEEKDAY.format(now) as (typeof DAYS)[number]));

// Database shape: `{ weekly: { mon: [{from, to}], ..., sun: [] } }`.
// Empty array → closed that day. Missing day entirely → unknown ("—").
export const dayCellLabel = (wh: WorkingHours, idx: number): string => {
  if (wh?.always_open) return "24h";
  if (!wh || !wh.weekly) return "—";
  const ranges = wh.weekly[DAY_KEYS[idx]];
  if (ranges === undefined) return "—";
  if (ranges.length === 0) return "Closed";
  return ranges
    .map((r) => (r.from === "00:00" && r.to === "24:00" ? "24h" : `${r.from.slice(0, 5)}–${r.to.slice(0, 5)}`))
    .join(" / ");
};
