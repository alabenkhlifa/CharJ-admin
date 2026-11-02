// ── admin-usage report: shapes, strict parsing, small derivations ──────────
// Source: the admin-usage Edge Function (../charj/supabase/functions/admin-usage),
// which returns public.admin_usage_report(view, days, environment) as is.
// Pure module (it imports only the pure health-format and tracking helpers)
// so `node --test` can load it directly.
//
// Both views are parsed strictly: a missing key or a wrong type throws rather
// than drawing a misleading 0. Extra keys are ignored, so an additive server
// change never breaks the page.
import { windowState, type WindowState } from "../lib/health-format.ts";
import { cohortWindowUntracked, isTracked, UNTRACKED, type UntrackedSpan } from "../lib/tracking.ts";

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

/** Every usage row carries its build's platform and design ('unknown': no label, an older build). */
export type UsageDims = { platform: string; ui: string };
export type UsageDaily = UsageDims & { day: string; active: number; events: number };
export type UsageCohort = UsageDims & {
  install_week: string;
  installed: number;
  returned_1: number;
  returned_7: number;
  returned_30: number;
  finished_1: boolean;
  finished_7: boolean;
  finished_30: boolean;
};
export type UsageLanguage = UsageDims & { language: string; users: number };
export type UsageScreen = UsageDims & { screen: string; views: number; users: number };
export type UsageAction = UsageDims & { event_name: string; detail: string; events: number; users: number };
export type UsageStep = UsageDims & { step: string; events: number; users: number };
export type UsageTap = UsageDims & { warning: string; taps: number; went: number };
/** Permission answers have a design but no platform on the server. */
export type UsagePermission = { kind: string; result: string; source: string; ui: string; count: number };

/** view=usage: the window is `days` Tunis days ending today; cohorts are every install week. */
export type UsageReport = {
  generated_at: string;
  timezone: string;
  environment: UsageEnvironment;
  days: UsageDays;
  /** Every day × platform × design, zeros filled. */
  daily: UsageDaily[];
  cohorts: UsageCohort[];
  languages: UsageLanguage[];
  screens: UsageScreen[];
  /** Every event except screen_viewed, split by its detail. */
  actions: UsageAction[];
  funnels: {
    onboarding: UsageStep[];
    trip: UsageStep[];
    navigate: { taps: UsageTap[]; launched: UsageStep[] };
    /** Plain counts: not split by platform or design. */
    contributions: { review_started: number; reviews_posted: number; add_started: number; submitted: number };
    permissions: UsagePermission[];
  };
  /** Not split by platform or design. */
  missing_cars: { total_searches: number; no_result: number; queries: { query: string; searches: number }[] };
  /** Not split by platform or design. */
  routes: { found: number; failed: { reason: string; count: number }[]; p50_ms: number | null; p95_ms: number | null };
  android_auto: { sessions: number; minutes: number; chargers_opened: number; navigations: number };
};

export type UsageReportFor<V extends UsageView> = V extends "summary" ? SummaryReport : UsageReport;

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
const flag = (value: unknown): boolean => (typeof value === "boolean" ? value : invalid());
const maybeAmount = (value: unknown): number | null => (value === null ? null : amount(value));
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

const dims = (r: Record<string, unknown>): UsageDims => ({ platform: text(r.platform), ui: text(r.ui) });
const steps = (value: unknown): UsageStep[] =>
  list(value, (f) => ({ step: text(f.step), ...dims(f), events: count(f.events), users: count(f.users) }));

const parseUsage = (value: unknown): UsageReport => {
  const r = object(value);
  const days = (USAGE_DAYS as readonly unknown[]).includes(r.days) ? (r.days as UsageDays) : invalid();
  const funnels = object(r.funnels);
  const navigate = object(funnels.navigate);
  const contributions = object(funnels.contributions);
  const missing = object(r.missing_cars);
  const routes = object(r.routes);
  const auto = object(r.android_auto);
  const daily = list(r.daily, (d) => ({ day: day(d.day), ...dims(d), active: count(d.active), events: count(d.events) }));
  // Any design reads the server's ui='all' rows (people counted once across
  // designs). A report without them would read as nobody, so it is refused.
  if (daily.length && !daily.some((d) => d.ui === "all")) invalid();
  return {
    ...header(r),
    days,
    daily,
    cohorts: list(r.cohorts, (c) => ({
      install_week: day(c.install_week),
      ...dims(c),
      installed: count(c.installed),
      returned_1: count(c.returned_1),
      returned_7: count(c.returned_7),
      returned_30: count(c.returned_30),
      finished_1: flag(c.finished_1),
      finished_7: flag(c.finished_7),
      finished_30: flag(c.finished_30),
    })),
    languages: list(r.languages, (l) => ({ language: text(l.language), ...dims(l), users: count(l.users) })),
    screens: list(r.screens, (s) => ({ screen: text(s.screen), ...dims(s), views: count(s.views), users: count(s.users) })),
    actions: list(r.actions, (a) => ({
      event_name: text(a.event_name),
      detail: text(a.detail),
      ...dims(a),
      events: count(a.events),
      users: count(a.users),
    })),
    funnels: {
      onboarding: steps(funnels.onboarding),
      trip: steps(funnels.trip),
      navigate: {
        taps: list(navigate.taps, (t) => ({ warning: text(t.warning), ...dims(t), taps: count(t.taps), went: count(t.went) })),
        launched: steps(navigate.launched),
      },
      contributions: {
        review_started: count(contributions.review_started),
        reviews_posted: count(contributions.reviews_posted),
        add_started: count(contributions.add_started),
        submitted: count(contributions.submitted),
      },
      permissions: list(funnels.permissions, (p) => ({
        kind: text(p.kind),
        result: text(p.result),
        source: text(p.source),
        ui: text(p.ui),
        count: count(p.count),
      })),
    },
    missing_cars: {
      total_searches: count(missing.total_searches),
      no_result: count(missing.no_result),
      queries: list(missing.queries, (q) => ({ query: text(q.query), searches: count(q.searches) })),
    },
    routes: {
      found: count(routes.found),
      failed: list(routes.failed, (f) => ({ reason: text(f.reason), count: count(f.count) })),
      p50_ms: maybeAmount(routes.p50_ms),
      p95_ms: maybeAmount(routes.p95_ms),
    },
    android_auto: {
      sessions: count(auto.sessions),
      minutes: amount(auto.minutes),
      chargers_opened: count(auto.chargers_opened),
      navigations: count(auto.navigations),
    },
  };
};

export function parseUsageReport(view: "summary", value: unknown): SummaryReport;
export function parseUsageReport(view: "usage", value: unknown): UsageReport;
export function parseUsageReport(view: UsageView, value: unknown): SummaryReport | UsageReport;
export function parseUsageReport(view: UsageView, value: unknown): SummaryReport | UsageReport {
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
/** "iOS", "Android", "Web"; anything else as sent. */
export const platformName = (p: string): string => PLATFORM[p] ?? p;

/** "Android 1.3.0" + the design label ('unknown' is an older build: "no label"). */
export const versionRows = (versions: SummaryReport["versions"]) => {
  const rows = versions.map((v) => ({
    key: `${v.platform}|${v.app_version}|${v.ui}`,
    name: `${platformName(v.platform)} ${v.app_version}`,
    ui: v.ui === "unknown" ? "no label" : v.ui,
    users: v.users,
  }));
  return { rows, versions: new Set(rows.map((r) => r.name)).size };
};

// ── Usage page: URL filters ────────────────────────────────────────────────

export const USAGE_PLATFORMS = ["all", "ios", "android"] as const;
export type UsagePlatform = (typeof USAGE_PLATFORMS)[number];
export const USAGE_UIS = ["all", "lune", "classic", "unknown"] as const;
/**
 * The design filter is one server design each: 'all' (any design), 'lune',
 * 'classic', or 'unknown' (builds from before the design label, shown as
 * "No label"; they run the classic look). Never a sum of designs, because a
 * phone that switched design would count twice.
 */
export type UsageUi = (typeof USAGE_UIS)[number];
export type UsageFilter = { platform?: UsagePlatform; ui?: UsageUi };

const pick = <T extends string | number>(options: readonly T[], value: unknown, fallback: T): T =>
  (options as readonly unknown[]).includes(value) ? (value as T) : fallback;

/** `?days=`: 7, 30 or 90; anything else is 30. */
export const parseUsageDays = (value: string | null | undefined): UsageDays =>
  pick(USAGE_DAYS, value == null ? null : Number(value), 30);
/** `?platform=`: all, ios or android. */
export const parseUsagePlatform = (value: string | null | undefined): UsagePlatform => pick(USAGE_PLATFORMS, value, "all");
/** `?ui=`: all, lune, classic or unknown. */
export const parseUsageUi = (value: string | null | undefined): UsageUi => pick(USAGE_UIS, value, "all");

const platformMatches = (platform: string, filter: UsagePlatform = "all") => filter === "all" || platform === filter;

/** Every design of one platform: for questions about a design (has Lune started?). */
export const onPlatform = (report: UsageReport, platform: UsagePlatform = "all"): UsageReport => {
  if (platform === "all") return report;
  const keep = <T extends UsageDims>(rows: T[]) => rows.filter((r) => platformMatches(r.platform, platform));
  const f = report.funnels;
  return {
    ...report,
    daily: keep(report.daily),
    cohorts: keep(report.cohorts),
    languages: keep(report.languages),
    screens: keep(report.screens),
    actions: keep(report.actions),
    funnels: { ...f, onboarding: keep(f.onboarding), trip: keep(f.trip), navigate: { taps: keep(f.navigate.taps), launched: keep(f.navigate.launched) } },
  };
};

/**
 * The report narrowed to one platform and exactly one design, client-side.
 * Any design reads the server's ui='all' rows, where a person is counted once
 * across designs; a design reads only its own rows. Summing over platforms
 * stays exact (a phone is one install). Sections the server does not split
 * (contributions, missing cars, routes, Android Auto) stay whole; permissions
 * have a design but no platform and no 'all' rows (they are plain counts).
 */
export const filterUsage = (report: UsageReport, { platform = "all", ui = "all" }: UsageFilter = {}): UsageReport => {
  const p = onPlatform(report, platform);
  const keep = <T extends UsageDims>(rows: T[]) => rows.filter((r) => r.ui === ui);
  const f = p.funnels;
  return {
    ...p,
    daily: keep(p.daily),
    cohorts: keep(p.cohorts),
    languages: keep(p.languages),
    screens: keep(p.screens),
    actions: keep(p.actions),
    funnels: {
      ...f,
      onboarding: keep(f.onboarding),
      trip: keep(f.trip),
      navigate: { taps: keep(f.navigate.taps), launched: keep(f.navigate.launched) },
      permissions: ui === "all" ? f.permissions : f.permissions.filter((x) => x.ui === ui),
    },
  };
};

// ── Usage page: derivations ────────────────────────────────────────────────
// Each takes a report from filterUsage (one design), so the only sums are
// over platforms, where a phone counts once.

/** iOS first, then Android, then anything else the server saw. */
const PLATFORM_ORDER = ["ios", "android"];
export const platformsOf = (rows: UsageDims[]): string[] => {
  const seen = new Set(rows.map((r) => r.platform));
  return [...PLATFORM_ORDER.filter((p) => seen.has(p)), ...[...seen].filter((p) => !PLATFORM_ORDER.includes(p)).sort()];
};

const add = (into: Record<string, number>, key: string, n: number) => {
  into[key] = (into[key] ?? 0) + n;
};

export type CohortWindow = { days: 1 | 7 | 30; n: number; of: number; state: WindowState };
export type CohortWeek = {
  install_week: string;
  installed: number;
  /** Installs per platform. */
  platforms: Record<string, number>;
  windows: CohortWindow[];
};

/**
 * Return windows per install week, newest first, summed over the rows left by
 * the filters. A window that overlaps a day nobody measured (lib/tracking)
 * reads "not tracked", never a 0; otherwise windowState says open or final.
 */
export const cohortRows = (report: UsageReport, spans: readonly UntrackedSpan[] = UNTRACKED): CohortWeek[] => {
  const weeks = new Map<string, { installed: number; back: [number, number, number]; open: [boolean, boolean, boolean]; platforms: Record<string, number> }>();
  for (const c of report.cohorts) {
    const w = weeks.get(c.install_week) ?? { installed: 0, back: [0, 0, 0], open: [false, false, false], platforms: {} };
    w.installed += c.installed;
    w.back = [w.back[0] + c.returned_1, w.back[1] + c.returned_7, w.back[2] + c.returned_30];
    w.open = [w.open[0] || !c.finished_1, w.open[1] || !c.finished_7, w.open[2] || !c.finished_30];
    add(w.platforms, c.platform, c.installed);
    weeks.set(c.install_week, w);
  }
  return [...weeks.entries()]
    .filter(([, w]) => w.installed > 0)
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([install_week, w]) => ({
      install_week,
      installed: w.installed,
      platforms: w.platforms,
      windows: ([1, 7, 30] as const).map((days, i) => ({
        days,
        n: w.back[i],
        of: w.installed,
        state: cohortWindowUntracked(install_week, days, spans) ? "not_tracked" : windowState(install_week, null, days, !w.open[i]),
      })),
    }));
};

/** The newest install week whose 7-day window is final, or null. */
export const latestCohort = (weeks: CohortWeek[]): CohortWeek | null =>
  weeks.find((w) => w.windows[1].state === "final") ?? null;

export type ActivitySeries = {
  grain: "day" | "week";
  /** ISO days, or the Monday of each week. */
  labels: string[];
  platforms: string[];
  /**
   * Phones that opened the app: per day, or the average per measured day of
   * each week. null = not tracked (never drawn as 0).
   */
  active: Record<string, (number | null)[]>;
  /** All events: per day, or summed per week. null = not tracked (a week with any unmeasured day). */
  events: Record<string, (number | null)[]>;
  totalActive: (number | null)[];
  totalEvents: (number | null)[];
  /** Mean phones a day over the measured days shown; null when none was measured. */
  avgActive: number | null;
  /** Measured days shown (after `from`). */
  trackedDays: number;
  /** Every day shown, measured or not. */
  days: string[];
};

const monday = (isoDay: string) => {
  const d = new Date(`${isoDay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Active phones and events per platform. 7 and 30 days are daily; 90 days are
 * Monday weeks, where active is the average per
 * measured day (distinct phones can't be summed over days) and events are
 * summed. Days nobody measured (lib/tracking) are null and stay out of every
 * average. `from` drops the days before it (a Lune chart starts at its first event).
 */
export const activitySeries = (
  report: UsageReport,
  { from, spans = UNTRACKED }: { from?: string | null; spans?: readonly UntrackedSpan[] } = {},
): ActivitySeries => {
  const grain = report.days === 90 ? "week" : "day";
  const rows = from ? report.daily.filter((d) => d.day >= from) : report.daily;
  const platforms = platformsOf(rows);
  const days = [...new Set(rows.map((d) => d.day))].sort();
  const tracked = (d: string) => isTracked(d, spans);
  const perDay = new Map<string, { active: Record<string, number>; events: Record<string, number> }>();
  for (const d of rows) {
    const at = perDay.get(d.day) ?? { active: {}, events: {} };
    add(at.active, d.platform, d.active);
    add(at.events, d.platform, d.events);
    perDay.set(d.day, at);
  }
  const labels = grain === "day" ? days : [...new Set(days.map(monday))];
  const bucketDays = (label: string) => (grain === "day" ? [label] : days.filter((d) => monday(d) === label));
  const active: Record<string, (number | null)[]> = {};
  const events: Record<string, (number | null)[]> = {};
  for (const p of platforms) {
    active[p] = labels.map((label) => {
      const ds = bucketDays(label).filter(tracked);
      if (!ds.length) return null;
      const sum = ds.reduce((a, d) => a + (perDay.get(d)?.active[p] ?? 0), 0);
      return grain === "day" ? sum : round1(sum / ds.length);
    });
    events[p] = labels.map((label) => {
      const ds = bucketDays(label);
      // A sum with an unmeasured day in it would read low: the whole bucket is not tracked.
      if (!ds.every(tracked)) return null;
      return ds.reduce((a, d) => a + (perDay.get(d)?.events[p] ?? 0), 0);
    });
  }
  const total = (series: Record<string, (number | null)[]>, i: number) => {
    const vs = platforms.map((p) => series[p][i]);
    return vs.every((v) => v === null) ? null : round1(vs.reduce<number>((a, v) => a + (v ?? 0), 0));
  };
  const measured = days.filter(tracked);
  const allActive = measured.reduce((a, d) => a + Object.values(perDay.get(d)?.active ?? {}).reduce((x, y) => x + y, 0), 0);
  return {
    grain,
    labels,
    platforms,
    active,
    events,
    totalActive: labels.map((_, i) => total(active, i)),
    totalEvents: labels.map((_, i) => total(events, i)),
    avgActive: measured.length ? round1(allActive / measured.length) : null,
    trackedDays: measured.length,
    days,
  };
};

/** Any event from the Lune design in the window (on a report from onPlatform: every design). */
export const luneSeen = (report: UsageReport): boolean => report.daily.some((d) => d.ui === "lune" && d.events > 0);

/** The first day with a Lune event, or null before the Lune update. */
export const firstLuneDay = (report: UsageReport): string | null =>
  report.daily.filter((d) => d.ui === "lune" && d.events > 0).reduce<string | null>((a, d) => (a === null || d.day < a ? d.day : a), null);

export type ScreenRow = { screen: string; views: number; users: number; platforms: Record<string, { views: number; users: number }> };

/** Views and people per screen, summed over platforms and designs, busiest first. */
export const screensTable = (report: UsageReport): ScreenRow[] => {
  const by = new Map<string, ScreenRow>();
  for (const s of report.screens) {
    const row = by.get(s.screen) ?? { screen: s.screen, views: 0, users: 0, platforms: {} };
    row.views += s.views;
    row.users += s.users;
    const p = row.platforms[s.platform] ?? { views: 0, users: 0 };
    p.views += s.views;
    p.users += s.users;
    row.platforms[s.platform] = p;
    by.set(s.screen, row);
  }
  return [...by.values()].filter((r) => r.views > 0).sort((a, b) => b.views - a.views || a.screen.localeCompare(b.screen));
};

export type LanguageRow = { language: string; users: number; platforms: Record<string, number> };

/**
 * Users per language: FR, AR, EN (real zeros when missing), then any other.
 * Never shares: a person who switched language counts in both.
 */
export const languageTable = (report: UsageReport): LanguageRow[] => {
  const by = new Map<string, LanguageRow>();
  for (const l of report.languages) {
    const row = by.get(l.language) ?? { language: l.language, users: 0, platforms: {} };
    row.users += l.users;
    add(row.platforms, l.platform, l.users);
    by.set(l.language, row);
  }
  const others = [...by.keys()].filter((l) => !LANGUAGE_ORDER.includes(l)).sort();
  return [...LANGUAGE_ORDER, ...others].map((language) => by.get(language) ?? { language, users: 0, platforms: {} });
};

export type ActionRow = { event_name: string; events: number; platforms: Record<string, number>; details: { detail: string; events: number }[] };

/** Opening the app is Activity, not a feature. */
const NOT_ACTIONS = new Set(["app_opened"]);

/** Each named action with its count and its detail split, busiest first. */
export const actionRows = (report: UsageReport): ActionRow[] => {
  const by = new Map<string, { events: number; platforms: Record<string, number>; details: Record<string, number> }>();
  for (const a of report.actions) {
    if (NOT_ACTIONS.has(a.event_name)) continue;
    const row = by.get(a.event_name) ?? { events: 0, platforms: {}, details: {} };
    row.events += a.events;
    add(row.platforms, a.platform, a.events);
    add(row.details, a.detail, a.events);
    by.set(a.event_name, row);
  }
  return [...by.entries()]
    .filter(([, r]) => r.events > 0)
    .map(([event_name, r]) => ({
      event_name,
      events: r.events,
      platforms: r.platforms,
      details: Object.entries(r.details)
        .filter(([, n]) => n > 0)
        .map(([detail, events]) => ({ detail, events }))
        .sort((a, b) => b.events - a.events || a.detail.localeCompare(b.detail)),
    }))
    .sort((a, b) => b.events - a.events || a.event_name.localeCompare(b.event_name));
};

export type StepTotal = { events: number; users: number; platforms: Record<string, { events: number; users: number }> };

/** One funnel step summed over the rows left by the filters. */
export const stepTotals = (rows: UsageStep[], step: string): StepTotal => {
  const out: StepTotal = { events: 0, users: 0, platforms: {} };
  for (const r of rows) {
    if (r.step !== step || (!r.events && !r.users)) continue;
    out.events += r.events;
    out.users += r.users;
    const p = out.platforms[r.platform] ?? { events: 0, users: 0 };
    p.events += r.events;
    p.users += r.users;
    out.platforms[r.platform] = p;
  }
  return out;
};

export type TapRow = { warning: string; taps: number; went: number };

/** Navigate taps per warning met, and how many went on to navigation. */
export const tapRows = (report: UsageReport): TapRow[] => {
  const by = new Map<string, TapRow>();
  for (const t of report.funnels.navigate.taps) {
    const row = by.get(t.warning) ?? { warning: t.warning, taps: 0, went: 0 };
    row.taps += t.taps;
    row.went += t.went;
    by.set(t.warning, row);
  }
  return [...by.values()].filter((r) => r.taps > 0).sort((a, b) => b.taps - a.taps || a.warning.localeCompare(b.warning));
};

export type PermissionKind = {
  kind: string;
  asked: number;
  /** Answers by result (granted / denied / undetermined). */
  results: Record<string, number>;
  /** Where it was asked, with its answers. */
  sources: { source: string; result: string; count: number }[];
};

/** Location and notification answers, by result and by where they were asked. */
export const permissionTable = (report: UsageReport): PermissionKind[] => {
  const by = new Map<string, PermissionKind>();
  for (const p of report.funnels.permissions) {
    if (!p.count) continue;
    const row = by.get(p.kind) ?? { kind: p.kind, asked: 0, results: {}, sources: [] };
    row.asked += p.count;
    add(row.results, p.result, p.count);
    const same = row.sources.find((s) => s.source === p.source && s.result === p.result);
    if (same) same.count += p.count;
    else row.sources.push({ source: p.source, result: p.result, count: p.count });
    by.set(p.kind, row);
  }
  for (const row of by.values()) row.sources.sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));
  return [...by.values()].sort((a, b) => a.kind.localeCompare(b.kind));
};
