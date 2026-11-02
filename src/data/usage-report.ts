// ── admin-usage report: shapes, strict parsing, small derivations ──────────
// Source: the admin-usage Edge Function (../charj/supabase/functions/admin-usage),
// which returns public.admin_usage_report(view, days, environment) as is.
// Pure module (no runtime imports) so `node --test` can load it directly.
//
// The summary is parsed strictly: a missing key or a wrong type throws rather
// than drawing a misleading 0. Extra keys are ignored, so an additive server
// change never breaks the page.

export const USAGE_ENVIRONMENTS = ["production", "preview", "development"] as const;
export type UsageEnvironment = (typeof USAGE_ENVIRONMENTS)[number];
export type UsageView = "summary" | "usage";
export const USAGE_DAYS = [7, 30, 90] as const;
export type UsageDays = (typeof USAGE_DAYS)[number];

export type SummaryReport = {
  generated_at: string;
  timezone: string;
  environment: UsageEnvironment;
  /** Distinct users with an app_opened on today's Tunis day. */
  today: { active: number };
  /** Mean daily active over the last 7 Tunis days, today included (2 decimals). */
  avg7: number;
  /** The last 30 Tunis days, oldest first, zeros filled. */
  daily: { day: string; active: number }[];
  /** The newest install week whose 7 days are over, summed over platforms. */
  cohort: { install_week: string; installed: number; back_7d: number } | null;
  /** Active users in 30 days per build; a user who upgraded sits in two rows. */
  versions: { platform: string; app_version: string; ui: string; users: number }[];
  dropped_7d: number;
  /** The same weekday a week ago, up to the same time of day. */
  same_day_last_week: { active: number };
  /** Active users in 30 days per app language; a user who switched counts in both. */
  languages: { language: string; users: number }[];
};

/** Task 8 replaces this with the full Usage shape; the header is checked now. */
export type UsageDetailReport = {
  generated_at: string;
  timezone: string;
  environment: UsageEnvironment;
  days: UsageDays;
  raw: Record<string, unknown>;
};

export type UsageReportFor<V extends UsageView> = V extends "summary" ? SummaryReport : UsageDetailReport;

const invalid = (): never => {
  throw new Error("Invalid usage report");
};
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : invalid();
const text = (value: unknown): string => (typeof value === "string" ? value : invalid());
const instant = (value: unknown): string => {
  const s = text(value);
  return Number.isFinite(Date.parse(s)) ? s : invalid();
};
const day = (value: unknown): string => {
  const s = text(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) ? s : invalid();
};
const amount = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : invalid();
const count = (value: unknown): number => {
  const n = amount(value);
  return Number.isInteger(n) ? n : invalid();
};
const list = <T>(value: unknown, row: (r: Record<string, unknown>) => T): T[] =>
  Array.isArray(value) ? value.map((r: unknown) => row(object(r))) : invalid();
const environment = (value: unknown): UsageEnvironment =>
  (USAGE_ENVIRONMENTS as readonly unknown[]).includes(value) ? (value as UsageEnvironment) : invalid();
const header = (r: Record<string, unknown>) => {
  if (r.timezone !== "Africa/Tunis") invalid();
  return { generated_at: instant(r.generated_at), timezone: text(r.timezone), environment: environment(r.environment) };
};

const parseSummary = (value: unknown): SummaryReport => {
  const r = object(value);
  const cohort = r.cohort === null ? null : object(r.cohort);
  return {
    ...header(r),
    today: { active: count(object(r.today).active) },
    avg7: amount(r.avg7),
    daily: list(r.daily, (d) => ({ day: day(d.day), active: count(d.active) })),
    cohort: cohort && { install_week: day(cohort.install_week), installed: count(cohort.installed), back_7d: count(cohort.back_7d) },
    versions: list(r.versions, (v) => ({
      platform: text(v.platform),
      app_version: text(v.app_version),
      ui: text(v.ui),
      users: count(v.users),
    })),
    dropped_7d: count(r.dropped_7d),
    same_day_last_week: { active: count(object(r.same_day_last_week).active) },
    languages: list(r.languages, (l) => ({ language: text(l.language), users: count(l.users) })),
  };
};

const parseUsage = (value: unknown): UsageDetailReport => {
  const r = object(value);
  const days = (USAGE_DAYS as readonly unknown[]).includes(r.days) ? (r.days as UsageDays) : invalid();
  return { ...header(r), days, raw: r };
};

export function parseUsageReport(view: "summary", value: unknown): SummaryReport;
export function parseUsageReport(view: "usage", value: unknown): UsageDetailReport;
export function parseUsageReport(view: UsageView, value: unknown): SummaryReport | UsageDetailReport;
export function parseUsageReport(view: UsageView, value: unknown): SummaryReport | UsageDetailReport {
  return view === "summary" ? parseSummary(value) : parseUsage(value);
}

/** `?env=` from the URL; anything else is production. */
export const parseUsageEnvironment = (value: string | null | undefined): UsageEnvironment =>
  (USAGE_ENVIRONMENTS as readonly (string | null | undefined)[]).includes(value) ? (value as UsageEnvironment) : "production";

/** The Active ring's goal: the rounded 7-day average, at least 1. */
export const activeGoal = (avg7: number): number => Math.max(1, Math.round(Number.isFinite(avg7) ? avg7 : 0));

const LANGUAGE_ORDER = ["fr", "ar", "en"];

/**
 * FR, AR, EN in that order as counts (never shares: a user who switched
 * language counts in both). The server lists only languages that occur, so a
 * missing one is a real zero.
 */
export const languageCounts = (languages: SummaryReport["languages"]) => {
  const users = new Map(languages.map((l) => [l.language, l.users]));
  const order = [...LANGUAGE_ORDER, ...languages.map((l) => l.language).filter((l) => !LANGUAGE_ORDER.includes(l))];
  return order.map((language) => ({ language, label: language.toUpperCase(), users: users.get(language) ?? 0 }));
};

const PLATFORM: Record<string, string> = { android: "Android", ios: "iOS", web: "Web" };

/** "Android 1.3.0" + the design label ('unknown' is an older build: "no label"). */
export const versionRows = (versions: SummaryReport["versions"]) => {
  const rows = versions.map((v) => ({
    key: `${v.platform}|${v.app_version}|${v.ui}`,
    name: `${PLATFORM[v.platform] ?? v.platform} ${v.app_version}`,
    ui: v.ui === "unknown" ? "no label" : v.ui,
    users: v.users,
  }));
  return { rows, versions: new Set(rows.map((r) => r.name)).size };
};
