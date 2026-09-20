// Shared time-range vocabulary for the chart range selectors.
//
// A range picks both a window *and* a bucket grain — 7 days of monthly bars
// would be one bar, a year of daily bars would be 365 unreadable ticks. The
// grain is baked in here so every chart that honours a range buckets the same
// way and the x-axis labels stay legible.
//
// Everything is UTC. `created_at` comes back from Postgres as UTC and Tunisia
// is UTC+1 with no DST, so bucketing in local time would only shuffle rows
// across midnight boundaries for no benefit.

export type RangeKey = "7d" | "30d" | "90d" | "1y";

export const RANGE_KEYS: readonly RangeKey[] = ["7d", "30d", "90d", "1y"] as const;

export const RANGE_DAYS: Record<RangeKey, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
};

// Used in card subtitles — reads as "Cumulative catalogue · last 30 days".
export const RANGE_LABELS: Record<RangeKey, string> = {
  "7d": "last 7 days",
  "30d": "last 30 days",
  "90d": "last 13 weeks",
  "1y": "last 12 months",
};

export type Grain = "day" | "week" | "month";

export const GRAIN_FOR: Record<RangeKey, Grain> = {
  "7d": "day",
  "30d": "day",
  "90d": "week",
  "1y": "month",
};

export const isRangeKey = (v: string | null | undefined): v is RangeKey =>
  v === "7d" || v === "30d" || v === "90d" || v === "1y";

// `key` groups rows, `label` is the x-axis tick, `end` is the exclusive upper
// bound — needed for cumulative series ("how many existed by this point").
export type Bucket = { key: string; label: string; end: Date };

const utcDay = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

const startOfWeek = (d: Date) => {
  const dt = utcDay(d);
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7)); // Monday-anchored
  return dt;
};

const startOfMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

export const bucketStart = (d: Date, grain: Grain): Date =>
  grain === "day" ? utcDay(d) : grain === "week" ? startOfWeek(d) : startOfMonth(d);

export const bucketKey = (d: Date, grain: Grain): string =>
  bucketStart(d, grain).toISOString().slice(0, 10);

const addGrain = (d: Date, grain: Grain, n: number): Date => {
  const out = new Date(d);
  if (grain === "day") out.setUTCDate(out.getUTCDate() + n);
  else if (grain === "week") out.setUTCDate(out.getUTCDate() + n * 7);
  else out.setUTCMonth(out.getUTCMonth() + n);
  return out;
};

const dayLabel = (d: Date) =>
  d.toLocaleString("en-US", { day: "numeric", month: "short", timeZone: "UTC" });
const monthLabel = (d: Date) => d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });

const labelFor = (d: Date, grain: Grain) =>
  grain === "month" ? monthLabel(d) : dayLabel(d);

// How many buckets a range spans, oldest first, ending with the bucket that
// contains today (partial buckets included — a half-finished month still
// carries real rows).
const BUCKET_COUNT: Record<RangeKey, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 13,
  "1y": 12,
};

export const bucketsFor = (range: RangeKey, now: Date = new Date()): Bucket[] => {
  const grain = GRAIN_FOR[range];
  const count = BUCKET_COUNT[range];
  const current = bucketStart(now, grain);
  const out: Bucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = addGrain(current, grain, -i);
    out.push({
      key: bucketKey(start, grain),
      label: labelFor(start, grain),
      end: addGrain(start, grain, 1),
    });
  }
  return out;
};

// Oldest instant a range covers — used to trim the fetch window.
export const rangeStart = (range: RangeKey, now: Date = new Date()): Date => {
  const grain = GRAIN_FOR[range];
  return addGrain(bucketStart(now, grain), grain, -(BUCKET_COUNT[range] - 1));
};

// The widest window any selector can ask for. Fetch this once, slice in memory
// — toggling 7d ↔ 1y then costs nothing.
export const WIDEST_RANGE: RangeKey = "1y";
