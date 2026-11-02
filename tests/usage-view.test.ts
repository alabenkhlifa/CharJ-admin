import assert from "node:assert/strict";
import { test } from "node:test";
import {
  actionRows,
  activitySeries,
  cohortRows,
  filterUsage,
  firstLuneDay,
  languageTable,
  latestCohort,
  luneSeen,
  parseUsagePlatform,
  parseUsageDays,
  parseUsageReport,
  parseUsageUi,
  permissionTable,
  screensTable,
  onPlatform,
  stepTotals,
  tapRows,
  type UsageReport,
} from "../src/data/usage-report.ts";
import {
  cohortWindowUntracked,
  isTracked,
  measuredNote,
  rangeText,
  tunisDay,
  untrackedNote,
  untrackedRuns,
  UNTRACKED,
  windowCoverage,
  windowDays,
} from "../src/lib/tracking.ts";

// The usage view as admin-usage returns it (Task 1 + 1b + 8b keys), small
// enough to reason about: two days, production-style 'unknown' rows, a few
// Lune rows, and the server's ui='all' rows. On 2 Nov one Android phone moved
// from an older build to Lune, so its 'all' row counts it once (1, not 2), and
// one French-speaking Android phone sits in both designs (4, not 5).
const grid = <T extends object>(rows: (T & { platform: string; ui: string })[]) => rows;
const usage = () => ({
  generated_at: "2026-11-02T03:04:41.441916+00:00",
  timezone: "Africa/Tunis",
  environment: "production",
  days: 7,
  daily: grid([
    { day: "2026-11-01", platform: "android", ui: "classic", active: 0, events: 0 },
    { day: "2026-11-01", platform: "android", ui: "lune", active: 0, events: 0 },
    { day: "2026-11-01", platform: "android", ui: "unknown", active: 2, events: 30 },
    { day: "2026-11-01", platform: "ios", ui: "classic", active: 0, events: 0 },
    { day: "2026-11-01", platform: "ios", ui: "lune", active: 0, events: 0 },
    { day: "2026-11-01", platform: "ios", ui: "unknown", active: 2, events: 70 },
    { day: "2026-11-02", platform: "android", ui: "classic", active: 0, events: 0 },
    { day: "2026-11-02", platform: "android", ui: "lune", active: 1, events: 12 },
    { day: "2026-11-02", platform: "android", ui: "unknown", active: 1, events: 8 },
    { day: "2026-11-02", platform: "ios", ui: "classic", active: 0, events: 0 },
    { day: "2026-11-02", platform: "ios", ui: "lune", active: 0, events: 0 },
    { day: "2026-11-02", platform: "ios", ui: "unknown", active: 0, events: 0 },
    { day: "2026-11-01", platform: "android", ui: "all", active: 2, events: 30 },
    { day: "2026-11-01", platform: "ios", ui: "all", active: 2, events: 70 },
    { day: "2026-11-02", platform: "android", ui: "all", active: 1, events: 20 },
    { day: "2026-11-02", platform: "ios", ui: "all", active: 0, events: 0 },
  ]),
  cohorts: [
    { ui: "unknown", platform: "android", installed: 4, finished_1: false, finished_7: false, returned_1: 2, returned_7: 2, finished_30: false, returned_30: 2, install_week: "2026-10-26" },
    { ui: "unknown", platform: "ios", installed: 5, finished_1: false, finished_7: false, returned_1: 1, returned_7: 1, finished_30: false, returned_30: 1, install_week: "2026-10-26" },
    { ui: "unknown", platform: "android", installed: 2, finished_1: true, finished_7: true, returned_1: 0, returned_7: 0, finished_30: false, returned_30: 0, install_week: "2026-10-19" },
    { ui: "unknown", platform: "ios", installed: 2, finished_1: true, finished_7: true, returned_1: 1, returned_7: 1, finished_30: false, returned_30: 1, install_week: "2026-10-19" },
    { ui: "unknown", platform: "android", installed: 3, finished_1: true, finished_7: true, returned_1: 0, returned_7: 0, finished_30: true, returned_30: 0, install_week: "2026-09-14" },
    { ui: "unknown", platform: "ios", installed: 3, finished_1: true, finished_7: true, returned_1: 1, returned_7: 1, finished_30: true, returned_30: 1, install_week: "2026-09-14" },
    { ui: "all", platform: "android", installed: 4, finished_1: false, finished_7: false, returned_1: 2, returned_7: 2, finished_30: false, returned_30: 2, install_week: "2026-10-26" },
    { ui: "all", platform: "ios", installed: 5, finished_1: false, finished_7: false, returned_1: 1, returned_7: 1, finished_30: false, returned_30: 1, install_week: "2026-10-26" },
    { ui: "all", platform: "android", installed: 2, finished_1: true, finished_7: true, returned_1: 0, returned_7: 0, finished_30: false, returned_30: 0, install_week: "2026-10-19" },
    { ui: "all", platform: "ios", installed: 2, finished_1: true, finished_7: true, returned_1: 1, returned_7: 1, finished_30: false, returned_30: 1, install_week: "2026-10-19" },
    { ui: "all", platform: "android", installed: 3, finished_1: true, finished_7: true, returned_1: 0, returned_7: 0, finished_30: true, returned_30: 0, install_week: "2026-09-14" },
    { ui: "all", platform: "ios", installed: 3, finished_1: true, finished_7: true, returned_1: 1, returned_7: 1, finished_30: true, returned_30: 1, install_week: "2026-09-14" },
  ],
  languages: [
    { language: "en", platform: "android", ui: "unknown", users: 3 },
    { language: "fr", platform: "android", ui: "lune", users: 1 },
    { language: "fr", platform: "android", ui: "unknown", users: 4 },
    { language: "fr", platform: "ios", ui: "unknown", users: 2 },
    { language: "en", platform: "android", ui: "all", users: 3 },
    { language: "fr", platform: "android", ui: "all", users: 4 },
    { language: "fr", platform: "ios", ui: "all", users: 2 },
  ],
  screens: [
    { screen: "map", platform: "android", ui: "lune", views: 35, users: 1 },
    { screen: "map", platform: "ios", ui: "lune", views: 45, users: 1 },
    { screen: "charger", platform: "android", ui: "lune", views: 23, users: 1 },
    { screen: "charger", platform: "ios", ui: "classic", views: 33, users: 1 },
    { screen: "list", platform: "ios", ui: "lune", views: 0, users: 0 },
    { screen: "map", platform: "android", ui: "all", views: 35, users: 1 },
    { screen: "map", platform: "ios", ui: "all", views: 45, users: 1 },
    { screen: "charger", platform: "android", ui: "all", views: 23, users: 1 },
    { screen: "charger", platform: "ios", ui: "all", views: 33, users: 1 },
  ],
  actions: [
    { ui: "unknown", users: 19, detail: "foreground", events: 263, platform: "android", event_name: "app_opened" },
    { ui: "unknown", users: 17, detail: "", events: 237, platform: "ios", event_name: "charger_viewed" },
    { ui: "lune", users: 1, detail: "map", events: 15, platform: "android", event_name: "charger_viewed" },
    { ui: "lune", users: 1, detail: "true", events: 4, platform: "ios", event_name: "favorite_toggled" },
    { ui: "lune", users: 1, detail: "false", events: 5, platform: "ios", event_name: "favorite_toggled" },
    { ui: "lune", users: 1, detail: "ar", events: 1, platform: "ios", event_name: "language_changed" },
    { ui: "lune", users: 1, detail: "fr", events: 2, platform: "android", event_name: "language_changed" },
    ...[
      ["app_opened", "foreground", "android", 263, 19], ["charger_viewed", "", "ios", 237, 17], ["charger_viewed", "map", "android", 15, 1],
      ["favorite_toggled", "true", "ios", 4, 1], ["favorite_toggled", "false", "ios", 5, 1], ["language_changed", "ar", "ios", 1, 1], ["language_changed", "fr", "android", 2, 1],
    ].map(([event_name, detail, platform, events, users]) => ({ ui: "all", event_name, detail, platform, events, users })),
  ],
  funnels: {
    onboarding: [
      { ui: "lune", step: "shown", users: 2, events: 5, platform: "android" },
      { ui: "lune", step: "shown", users: 1, events: 4, platform: "ios" },
      { ui: "unknown", step: "shown", users: 0, events: 0, platform: "ios" },
      { ui: "lune", step: "finished", users: 1, events: 2, platform: "android" },
      { ui: "lune", step: "finished", users: 1, events: 2, platform: "ios" },
      { ui: "all", step: "shown", users: 2, events: 5, platform: "android" },
      { ui: "all", step: "shown", users: 1, events: 4, platform: "ios" },
      { ui: "all", step: "finished", users: 1, events: 2, platform: "android" },
      { ui: "all", step: "finished", users: 1, events: 2, platform: "ios" },
    ],
    trip: [
      { ui: "unknown", step: "route_requested", users: 3, events: 6, platform: "android" },
      { ui: "unknown", step: "route_requested", users: 3, events: 5, platform: "ios" },
      { ui: "all", step: "route_requested", users: 3, events: 6, platform: "android" },
      { ui: "all", step: "route_requested", users: 3, events: 5, platform: "ios" },
    ],
    navigate: {
      taps: [
        { warning: "brand_exclusive", platform: "ios", ui: "lune", taps: 2, went: 2 },
        { warning: "customers_only", platform: "ios", ui: "lune", taps: 2, went: 1 },
        { warning: "none", platform: "android", ui: "lune", taps: 3, went: 3 },
        { warning: "brand_exclusive", platform: "ios", ui: "all", taps: 2, went: 2 },
        { warning: "customers_only", platform: "ios", ui: "all", taps: 2, went: 1 },
        { warning: "none", platform: "android", ui: "all", taps: 3, went: 3 },
      ],
      launched: [
        { ui: "unknown", step: "navigation_launched", users: 6, events: 13, platform: "android" },
        { ui: "unknown", step: "navigation_launched", users: 5, events: 32, platform: "ios" },
        { ui: "all", step: "navigation_launched", users: 6, events: 13, platform: "android" },
        { ui: "all", step: "navigation_launched", users: 5, events: 32, platform: "ios" },
      ],
    },
    contributions: { submitted: 0, add_started: 0, review_started: 3, reviews_posted: 1 },
    permissions: [
      { kind: "notification", result: "granted", source: "inbox", ui: "lune", count: 4 },
      { kind: "location", result: "denied", source: "map_locate", ui: "lune", count: 1 },
      { kind: "location", result: "granted", source: "map_locate", ui: "classic", count: 2 },
    ],
  },
  missing_cars: { queries: [{ query: "byd seal uu", searches: 1 }], no_result: 2, total_searches: 4 },
  routes: { found: 11, failed: [{ reason: "network", count: 2 }], p50_ms: 438, p95_ms: 1614 },
  android_auto: { minutes: 0, sessions: 0, navigations: 0, chargers_opened: 0 },
});

test("parses the full usage view strictly and keeps every value", () => {
  const r = parseUsageReport("usage", usage());
  assert.equal(r.days, 7);
  assert.equal(r.environment, "production");
  assert.equal(r.daily.length, 16);
  assert.deepEqual(r.daily[7], { day: "2026-11-02", platform: "android", ui: "lune", active: 1, events: 12 });
  assert.deepEqual(r.daily[14], { day: "2026-11-02", platform: "android", ui: "all", active: 1, events: 20 });
  assert.equal(r.cohorts[0].finished_7, false);
  assert.deepEqual(r.funnels.navigate.taps[1], { warning: "customers_only", platform: "ios", ui: "lune", taps: 2, went: 1 });
  assert.deepEqual(r.funnels.contributions, { review_started: 3, reviews_posted: 1, add_started: 0, submitted: 0 });
  assert.deepEqual(r.routes, { found: 11, failed: [{ reason: "network", count: 2 }], p50_ms: 438, p95_ms: 1614 });
  assert.deepEqual(r.missing_cars.queries, [{ query: "byd seal uu", searches: 1 }]);
  assert.deepEqual(r.android_auto, { sessions: 0, minutes: 0, chargers_opened: 0, navigations: 0 });
});

test("accepts null route timings and empty sections", () => {
  const r = parseUsageReport("usage", {
    ...usage(),
    routes: { found: 0, failed: [], p50_ms: null, p95_ms: null },
    screens: [],
    actions: [],
    cohorts: [],
    languages: [],
  });
  assert.equal(r.routes.p50_ms, null);
  assert.deepEqual(r.screens, []);
});

test("rejects a usage view with a missing key or a wrong type", () => {
  const top = ["generated_at", "timezone", "environment", "days", "daily", "cohorts", "languages", "screens", "actions", "funnels", "missing_cars", "routes", "android_auto"];
  for (const key of top) {
    const value: Record<string, unknown> = usage();
    delete value[key];
    assert.throws(() => parseUsageReport("usage", value), /Invalid usage report/, `missing ${key}`);
  }
  const u = usage();
  const bad: unknown[] = [
    { ...u, days: 365 },
    { ...u, daily: [{ ...u.daily[0], ui: undefined }] },
    { ...u, daily: [{ ...u.daily[0], active: -1 }] },
    { ...u, cohorts: [{ ...u.cohorts[0], finished_7: "yes" }] },
    { ...u, screens: [{ ...u.screens[0], views: "35" }] },
    { ...u, actions: [{ ...u.actions[0], detail: null }] },
    { ...u, funnels: { ...u.funnels, trip: null } },
    { ...u, funnels: { ...u.funnels, navigate: { taps: [], launched: [] }, contributions: { review_started: 1 } } },
    { ...u, funnels: { ...u.funnels, navigate: { launched: [] } } },
    { ...u, funnels: { ...u.funnels, permissions: [{ kind: "location", result: "granted", ui: "lune", count: 1 }] } },
    { ...u, missing_cars: { ...u.missing_cars, queries: [{ query: "x" }] } },
    { ...u, routes: { ...u.routes, p95_ms: Number.NaN } },
    { ...u, android_auto: { sessions: 0 } },
    // An older server without the all-designs rows would read as nobody.
    { ...u, daily: u.daily.filter((d) => d.ui !== "all") },
  ];
  for (const value of bad) {
    assert.throws(() => parseUsageReport("usage", value), /Invalid usage report/, JSON.stringify(value).slice(0, 120));
  }
});

test("filterUsage(report, {platform:'ios'}) drops Android rows everywhere it can, and reads the all-designs rows", () => {
  const r = filterUsage(parseUsageReport("usage", usage()), { platform: "ios" });
  for (const rows of [r.daily, r.cohorts, r.languages, r.screens, r.actions, r.funnels.onboarding, r.funnels.trip, r.funnels.navigate.taps, r.funnels.navigate.launched]) {
    assert.ok(rows.length > 0);
    assert.ok(rows.every((x) => x.platform === "ios" && x.ui === "all"), JSON.stringify(rows));
  }
  // Not split by platform on the server: kept whole.
  assert.equal(r.funnels.permissions.length, 3);
  assert.deepEqual(r.funnels.contributions, { review_started: 3, reviews_posted: 1, add_started: 0, submitted: 0 });
  assert.equal(r.routes.found, 11);
});

test("Any design counts each person once (the 'all' rows), never a sum of designs", () => {
  const all = filterUsage(parseUsageReport("usage", usage()));
  assert.ok(all.daily.every((d) => d.ui === "all"));
  // The Android phone that moved to Lune on 2 Nov: 1 active, not 1 + 1.
  assert.deepEqual(activitySeries(all).active.android, [2, 1]);
  // The French Android phone in both designs: 4, not 1 + 4.
  assert.deepEqual(languageTable(all).map((l) => [l.language, l.users]), [["fr", 6], ["ar", 0], ["en", 3]]);
  assert.deepEqual(stepTotals(all.funnels.onboarding, "shown").users, 3);
});

test("a design reads only its own rows: Lune, Classic, and No label", () => {
  const r = parseUsageReport("usage", usage());
  const lune = filterUsage(r, { ui: "lune" });
  assert.ok(lune.daily.every((d) => d.ui === "lune"));
  assert.deepEqual(activitySeries(lune).active.android, [0, 1]);
  assert.deepEqual(lune.funnels.permissions.map((p) => p.count), [4, 1]);
  const classic = filterUsage(r, { ui: "classic" });
  assert.deepEqual([...new Set(classic.daily.map((d) => d.ui))], ["classic"]);
  assert.deepEqual(classic.funnels.permissions.map((p) => p.count), [2]);
  const older = filterUsage(r, { ui: "unknown" });
  assert.deepEqual([...new Set(older.daily.map((d) => d.ui))], ["unknown"]);
  assert.deepEqual(languageTable(older).map((l) => l.users), [6, 0, 3]);
  assert.equal(filterUsage(r, { platform: "android", ui: "lune" }).screens.length, 2);
  // Every design of a platform, for "has Lune started there?".
  assert.equal(onPlatform(r, "android").daily.length, 8);
});

test("screensTable(report) sums per screen across platforms, busiest first", () => {
  const rows = screensTable(filterUsage(parseUsageReport("usage", usage())));
  assert.deepEqual(rows.map((r) => [r.screen, r.views, r.users]), [
    ["map", 80, 2],
    ["charger", 56, 2],
  ]);
  assert.deepEqual(rows[1].platforms, { android: { views: 23, users: 1 }, ios: { views: 33, users: 1 } });
  assert.deepEqual(screensTable(filterUsage(parseUsageReport("usage", usage()), { platform: "android" })).map((r) => r.views), [35, 23]);
  assert.deepEqual(screensTable(filterUsage(parseUsageReport("usage", usage()), { ui: "classic" })).map((r) => [r.screen, r.views]), [["charger", 33]]);
});

test("cohortRows(report) sums each install week and reads its windows: not tracked / open / final", () => {
  const rows = cohortRows(filterUsage(parseUsageReport("usage", usage())));
  assert.deepEqual(rows.map((r) => [r.install_week, r.installed]), [
    ["2026-10-26", 9],
    ["2026-10-19", 4],
    ["2026-09-14", 6],
  ]);
  assert.deepEqual(rows[0].windows.map((w) => [w.days, w.n, w.of, w.state]), [
    [1, 3, 9, "open"],
    [7, 3, 9, "open"],
    [30, 3, 9, "open"],
  ]);
  assert.deepEqual(rows[1].windows.map((w) => w.state), ["final", "final", "open"]);
  assert.deepEqual(rows[1].platforms, { android: 2, ios: 2 });
  // 14 Sep's windows all reach into 16 Sep–16 Oct, when nothing was recorded.
  assert.deepEqual(rows[2].windows.map((w) => w.state), ["not_tracked", "not_tracked", "not_tracked"]);
  // With nothing missing, the same week is simply final.
  assert.deepEqual(cohortRows(filterUsage(parseUsageReport("usage", usage())), [])[2].windows.map((w) => w.state), ["final", "final", "final"]);
});

test("production cohorts of 21 Sep, 28 Sep and 5 Oct read not tracked for day 1 and day 7; 19 Oct is measured", () => {
  const week = (install_week: string) => ({ install_week, platform: "ios", ui: "all", installed: 3, returned_1: 0, returned_7: 1, returned_30: 1, finished_1: true, finished_7: true, finished_30: true });
  const r = parseUsageReport("usage", { ...usage(), cohorts: ["2026-09-21", "2026-09-28", "2026-10-05", "2026-10-19"].map(week) });
  const rows = cohortRows(filterUsage(r));
  const state = (w: string) => rows.find((x) => x.install_week === w)?.windows.map((c) => c.state);
  for (const w of ["2026-09-21", "2026-09-28", "2026-10-05"]) {
    assert.deepEqual(state(w)?.slice(0, 2), ["not_tracked", "not_tracked"], w);
  }
  assert.deepEqual(state("2026-10-19"), ["final", "final", "final"]);
});

test("latestCohort is the newest install week whose 7 days are final", () => {
  const r = parseUsageReport("usage", usage()) as UsageReport;
  assert.deepEqual(latestCohort(cohortRows(filterUsage(r)))?.install_week, "2026-10-19");
  assert.equal(latestCohort(cohortRows({ ...r, cohorts: [] })), null);
  assert.equal(latestCohort(cohortRows(filterUsage(r, { ui: "lune" }))), null);
});

test("activitySeries stacks active phones and events per platform, by day", () => {
  const s = activitySeries(filterUsage(parseUsageReport("usage", usage())));
  assert.equal(s.grain, "day");
  assert.deepEqual(s.labels, ["2026-11-01", "2026-11-02"]);
  assert.deepEqual(s.platforms, ["ios", "android"]);
  assert.deepEqual(s.active, { ios: [2, 0], android: [2, 1] });
  assert.deepEqual(s.events, { ios: [70, 0], android: [30, 20] });
  assert.deepEqual(s.totalActive, [4, 1]);
  assert.equal(s.avgActive, 2.5);
  const from = activitySeries(filterUsage(parseUsageReport("usage", usage())), { from: "2026-11-02" });
  assert.deepEqual(from.labels, ["2026-11-02"]);
});

const thirtyDays = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2026, 9, 4 + i)).toISOString().slice(0, 10));

test("the 30-day production default leaves 4–16 Oct out: not tracked, not 0, and out of the average", () => {
  const r = parseUsageReport("usage", {
    ...usage(),
    days: 30,
    daily: thirtyDays.map((day) => ({ day, platform: "android", ui: "all", active: day <= "2026-10-16" ? 0 : 3, events: 7 })),
  });
  const s = activitySeries(filterUsage(r));
  assert.equal(s.labels[0], "2026-10-04");
  assert.deepEqual(s.totalActive.slice(0, 13), Array(13).fill(null));
  assert.equal(s.totalActive[13], 3); // 17 Oct
  assert.equal(s.trackedDays, 17);
  assert.equal(s.avgActive, 3); // 17 days of 3, not 51 / 30
  assert.equal(s.totalEvents[12], null);
});

test("activitySeries buckets 90 days into Monday weeks: average phones a measured day, summed events", () => {
  const days = Array.from({ length: 10 }, (_, i) => new Date(Date.UTC(2026, 9, 24 + i)).toISOString().slice(0, 10));
  const r = parseUsageReport("usage", {
    ...usage(),
    days: 90,
    daily: days.map((day, i) => ({ day, platform: "ios", ui: "all", active: i, events: 10 })),
  });
  const s = activitySeries(filterUsage(r));
  assert.equal(s.grain, "week");
  // 24–25 Oct (Sat, Sun) sit in the week of 19 Oct; 26 Oct–1 Nov; 2 Nov.
  assert.deepEqual(s.labels, ["2026-10-19", "2026-10-26", "2026-11-02"]);
  assert.deepEqual(s.active.ios, [0.5, 5, 9]);
  assert.deepEqual(s.events.ios, [20, 70, 10]);
  assert.equal(s.avgActive, 4.5);
  // A week half in the outage: its measured days average; its events sum would read low, so not tracked.
  const edge = parseUsageReport("usage", {
    ...usage(),
    days: 90,
    daily: ["2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"].map((day) => ({ day, platform: "ios", ui: "all", active: 4, events: 10 })),
  });
  const e = activitySeries(filterUsage(edge));
  assert.deepEqual(e.labels, ["2026-10-12"]);
  assert.deepEqual([e.active.ios, e.events.ios, e.trackedDays], [[4], [null], 2]);
});

test("Lune is seen from its first event in the window, on every design of the platform", () => {
  const r = parseUsageReport("usage", usage());
  assert.equal(luneSeen(onPlatform(r)), true);
  assert.equal(firstLuneDay(onPlatform(r)), "2026-11-02");
  assert.equal(luneSeen(onPlatform(r, "ios")), false);
  assert.equal(firstLuneDay(onPlatform(r, "ios")), null);
  // The all-designs rows alone can't tell.
  assert.equal(luneSeen(filterUsage(r)), false);
});

test("tracking: before 14 Sep and 16 Sep–16 Oct (both edge days) were not measured", () => {
  assert.equal(isTracked("2026-09-13"), false);
  assert.equal(isTracked("2026-09-14"), true);
  assert.equal(isTracked("2026-09-15"), true);
  assert.equal(isTracked("2026-09-16"), false);
  assert.equal(isTracked("2026-10-16"), false);
  assert.equal(isTracked("2026-10-17"), true);
  assert.equal(cohortWindowUntracked("2026-10-12", 1), true);
  assert.equal(cohortWindowUntracked("2026-10-19", 30), false);
  assert.equal(UNTRACKED.length, 2);
  assert.equal(rangeText("2026-10-04", "2026-10-16"), "4–16 Oct");
  assert.equal(rangeText("2026-09-28", "2026-10-03"), "28 Sep – 3 Oct");
  assert.deepEqual(untrackedRuns(thirtyDays).map((x) => [x.from, x.to]), [["2026-10-04", "2026-10-16"]]);
  assert.equal(untrackedNote(thirtyDays), "Not tracked: 4–16 Oct, when the app's events didn't reach the server.");
  assert.equal(untrackedNote(thirtyDays.slice(-7)), null);
});

test("windowCoverage: a window's measured days and its untracked runs", () => {
  // Today's windows (they end on 2 Nov): 30 days from 4 Oct, 90 from 5 Aug.
  assert.deepEqual(windowDays("2026-11-02", 3), ["2026-10-31", "2026-11-01", "2026-11-02"]);
  assert.equal(windowDays("2026-11-02", 30)[0], "2026-10-04");
  assert.equal(windowDays("2026-11-02", 90)[0], "2026-08-05");
  // 30 days: 4–16 Oct (13 days) not tracked, 17 Oct – 2 Nov measured.
  const thirty = windowCoverage("2026-11-02", 30);
  assert.equal(thirty.measured, 17);
  assert.equal(thirty.of, 30);
  assert.deepEqual(thirty.runs.map((r) => [r.from, r.to]), [["2026-10-04", "2026-10-16"]]);
  assert.equal(measuredNote("2026-11-02", 30), "Measured on 17 of these 30 days (not tracked: 4–16 Oct, when the app's events didn't reach the server).");
  // 90 days: only 14–15 Sep and 17 Oct – 2 Nov were measured.
  const ninety = windowCoverage("2026-11-02", 90);
  assert.equal(ninety.measured, 19);
  assert.equal(ninety.of, 90);
  assert.deepEqual(ninety.runs.map((r) => [r.from, r.to]), [["2026-08-05", "2026-09-13"], ["2026-09-16", "2026-10-16"]]);
  assert.equal(
    measuredNote("2026-11-02", 90),
    "Measured on 19 of these 90 days (not tracked: 5 Aug – 13 Sep, before analytics shipped on 14 Sep 2026; and 16 Sep – 16 Oct, when the app's events didn't reach the server).",
  );
  // 7 days were all measured: no note.
  assert.deepEqual(windowCoverage("2026-11-02", 7), { measured: 7, of: 7, runs: [] });
  assert.equal(measuredNote("2026-11-02", 7), null);
});

test("tunisDay: the server's day for an instant (UTC+1)", () => {
  assert.equal(tunisDay("2026-11-02T01:23:38Z"), "2026-11-02");
  assert.equal(tunisDay("2026-11-01T23:30:00Z"), "2026-11-02"); // 00:30 in Tunis
  assert.equal(tunisDay("2026-11-02T02:23:38.234357+01:00"), "2026-11-02");
  assert.equal(tunisDay("2026-11-02T22:59:59Z"), "2026-11-02");
  assert.equal(tunisDay("not a date"), null);
});

test("languageTable reads FR, AR, EN as users per language, with real zeros", () => {
  const rows = languageTable(filterUsage(parseUsageReport("usage", usage())));
  assert.deepEqual(rows.map((l) => [l.language, l.users]), [["fr", 6], ["ar", 0], ["en", 3]]);
  assert.deepEqual(rows[0].platforms, { android: 4, ios: 2 });
});

test("actionRows sums each named action with its details, without app opens", () => {
  const rows = actionRows(filterUsage(parseUsageReport("usage", usage())));
  assert.deepEqual(rows.map((a) => [a.event_name, a.events]), [
    ["charger_viewed", 252],
    ["favorite_toggled", 9],
    ["language_changed", 3],
  ]);
  assert.deepEqual(rows[0].details, [{ detail: "", events: 237 }, { detail: "map", events: 15 }]);
  assert.deepEqual(rows[1].details, [{ detail: "false", events: 5 }, { detail: "true", events: 4 }]);
});

test("funnel helpers sum steps, taps and permissions", () => {
  const r = filterUsage(parseUsageReport("usage", usage()));
  assert.deepEqual(stepTotals(r.funnels.onboarding, "shown"), { events: 9, users: 3, platforms: { android: { events: 5, users: 2 }, ios: { events: 4, users: 1 } } });
  assert.deepEqual(stepTotals(r.funnels.onboarding, "reached_map"), { events: 0, users: 0, platforms: {} });
  assert.deepEqual(tapRows(r).map((t) => [t.warning, t.taps, t.went]), [["none", 3, 3], ["brand_exclusive", 2, 2], ["customers_only", 2, 1]]);
  const p = permissionTable(r);
  assert.deepEqual(p.map((k) => [k.kind, k.asked, k.results]), [
    ["location", 3, { granted: 2, denied: 1 }],
    ["notification", 4, { granted: 4 }],
  ]);
});

test("URL filters fall back to their defaults", () => {
  assert.equal(parseUsageDays("90"), 90);
  assert.equal(parseUsageDays("365"), 30);
  assert.equal(parseUsageDays(null), 30);
  assert.equal(parseUsagePlatform("ios"), "ios");
  assert.equal(parseUsagePlatform("web"), "all");
  assert.equal(parseUsageUi("classic"), "classic");
  assert.equal(parseUsageUi("unknown"), "unknown");
  assert.equal(parseUsageUi("both"), "all");
});
