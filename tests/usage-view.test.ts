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
  stepTotals,
  tapRows,
  TRACKING_STARTED,
} from "../src/data/usage-report.ts";

// The usage view as admin-usage returns it (Task 1 + 1b keys), small enough to
// reason about: two days, production-style 'unknown' rows plus a few Lune rows.
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
  ]),
  cohorts: [
    { ui: "unknown", platform: "android", installed: 4, finished_1: false, finished_7: false, returned_1: 2, returned_7: 2, finished_30: false, returned_30: 2, install_week: "2026-10-26" },
    { ui: "unknown", platform: "ios", installed: 5, finished_1: false, finished_7: false, returned_1: 1, returned_7: 1, finished_30: false, returned_30: 1, install_week: "2026-10-26" },
    { ui: "unknown", platform: "android", installed: 2, finished_1: true, finished_7: true, returned_1: 0, returned_7: 0, finished_30: false, returned_30: 0, install_week: "2026-10-19" },
    { ui: "unknown", platform: "ios", installed: 2, finished_1: true, finished_7: true, returned_1: 1, returned_7: 1, finished_30: false, returned_30: 1, install_week: "2026-10-19" },
    { ui: "unknown", platform: "android", installed: 3, finished_1: true, finished_7: true, returned_1: 0, returned_7: 0, finished_30: true, returned_30: 0, install_week: "2026-09-14" },
    { ui: "unknown", platform: "ios", installed: 3, finished_1: true, finished_7: true, returned_1: 1, returned_7: 1, finished_30: true, returned_30: 1, install_week: "2026-09-14" },
  ],
  languages: [
    { language: "en", platform: "android", ui: "unknown", users: 3 },
    { language: "fr", platform: "android", ui: "lune", users: 1 },
    { language: "fr", platform: "android", ui: "unknown", users: 4 },
    { language: "fr", platform: "ios", ui: "unknown", users: 2 },
  ],
  screens: [
    { screen: "map", platform: "android", ui: "lune", views: 35, users: 1 },
    { screen: "map", platform: "ios", ui: "lune", views: 45, users: 1 },
    { screen: "charger", platform: "android", ui: "lune", views: 23, users: 1 },
    { screen: "charger", platform: "ios", ui: "classic", views: 33, users: 1 },
    { screen: "list", platform: "ios", ui: "lune", views: 0, users: 0 },
  ],
  actions: [
    { ui: "unknown", users: 19, detail: "foreground", events: 263, platform: "android", event_name: "app_opened" },
    { ui: "unknown", users: 17, detail: "", events: 237, platform: "ios", event_name: "charger_viewed" },
    { ui: "lune", users: 1, detail: "map", events: 15, platform: "android", event_name: "charger_viewed" },
    { ui: "lune", users: 1, detail: "true", events: 4, platform: "ios", event_name: "favorite_toggled" },
    { ui: "lune", users: 1, detail: "false", events: 5, platform: "ios", event_name: "favorite_toggled" },
    { ui: "lune", users: 1, detail: "ar", events: 1, platform: "ios", event_name: "language_changed" },
    { ui: "lune", users: 1, detail: "fr", events: 2, platform: "android", event_name: "language_changed" },
  ],
  funnels: {
    onboarding: [
      { ui: "lune", step: "shown", users: 2, events: 5, platform: "android" },
      { ui: "lune", step: "shown", users: 1, events: 4, platform: "ios" },
      { ui: "unknown", step: "shown", users: 0, events: 0, platform: "ios" },
      { ui: "lune", step: "finished", users: 1, events: 2, platform: "android" },
      { ui: "lune", step: "finished", users: 1, events: 2, platform: "ios" },
    ],
    trip: [
      { ui: "unknown", step: "route_requested", users: 3, events: 6, platform: "android" },
      { ui: "unknown", step: "route_requested", users: 3, events: 5, platform: "ios" },
    ],
    navigate: {
      taps: [
        { warning: "brand_exclusive", platform: "ios", ui: "lune", taps: 2, went: 2 },
        { warning: "customers_only", platform: "ios", ui: "lune", taps: 2, went: 1 },
        { warning: "none", platform: "android", ui: "lune", taps: 3, went: 3 },
      ],
      launched: [
        { ui: "unknown", step: "navigation_launched", users: 6, events: 13, platform: "android" },
        { ui: "unknown", step: "navigation_launched", users: 5, events: 32, platform: "ios" },
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
  assert.equal(r.daily.length, 12);
  assert.deepEqual(r.daily[7], { day: "2026-11-02", platform: "android", ui: "lune", active: 1, events: 12 });
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
  ];
  for (const value of bad) {
    assert.throws(() => parseUsageReport("usage", value), /Invalid usage report/, JSON.stringify(value).slice(0, 120));
  }
});

test("filterUsage(report, {platform:'ios'}) drops Android rows everywhere it can", () => {
  const r = filterUsage(parseUsageReport("usage", usage()), { platform: "ios" });
  for (const rows of [r.daily, r.cohorts, r.languages, r.screens, r.actions, r.funnels.onboarding, r.funnels.trip, r.funnels.navigate.taps, r.funnels.navigate.launched]) {
    assert.ok(rows.length > 0);
    assert.ok(rows.every((x) => x.platform === "ios"), JSON.stringify(rows));
  }
  // Not split by platform on the server: kept whole.
  assert.equal(r.funnels.permissions.length, 3);
  assert.deepEqual(r.funnels.contributions, { review_started: 3, reviews_posted: 1, add_started: 0, submitted: 0 });
  assert.equal(r.routes.found, 11);
});

test("filterUsage by design: Lune alone, and Classic includes builds with no label", () => {
  const all = parseUsageReport("usage", usage());
  const lune = filterUsage(all, { ui: "lune" });
  assert.ok(lune.daily.every((d) => d.ui === "lune"));
  assert.deepEqual(lune.funnels.permissions.map((p) => p.count), [4, 1]);
  const classic = filterUsage(all, { ui: "classic" });
  assert.deepEqual([...new Set(classic.daily.map((d) => d.ui))].sort(), ["classic", "unknown"]);
  assert.deepEqual(classic.funnels.permissions.map((p) => p.count), [2]);
  assert.deepEqual(filterUsage(all, {}), all);
  assert.equal(filterUsage(all, { platform: "android", ui: "lune" }).screens.length, 2);
});

test("screensTable(report) sums per screen across platforms and designs, busiest first", () => {
  const rows = screensTable(parseUsageReport("usage", usage()));
  assert.deepEqual(rows.map((r) => [r.screen, r.views, r.users]), [
    ["map", 80, 2],
    ["charger", 56, 2],
  ]);
  assert.deepEqual(rows[1].platforms, { android: { views: 23, users: 1 }, ios: { views: 33, users: 1 } });
  assert.deepEqual(screensTable(filterUsage(parseUsageReport("usage", usage()), { platform: "android" })).map((r) => r.views), [35, 23]);
});

test("cohortRows(report) sums each install week and reads its windows with windowState", () => {
  const rows = cohortRows(parseUsageReport("usage", usage()));
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
  // Tracking began with the analytics launch, the week the oldest cohort starts.
  assert.equal(TRACKING_STARTED, "2026-09-14");
  assert.deepEqual(rows[2].windows.map((w) => w.state), ["final", "final", "final"]);
  // Had tracking begun on 21 Oct, the 14 Sep week's windows would all have
  // closed before it, and the 19 Oct week's first day too: not tracked, never a 0.
  const late = cohortRows(parseUsageReport("usage", usage()), "2026-10-21");
  assert.deepEqual(late[2].windows.map((w) => w.state), ["not_tracked", "not_tracked", "not_tracked"]);
  assert.deepEqual(late[1].windows.map((w) => w.state), ["not_tracked", "final", "open"]);
  assert.deepEqual(late[0].windows.map((w) => w.state), ["open", "open", "open"]);
});

test("latestCohort is the newest install week whose 7 days are final", () => {
  const r = parseUsageReport("usage", usage());
  assert.deepEqual(latestCohort(cohortRows(r))?.install_week, "2026-10-19");
  assert.equal(latestCohort(cohortRows({ ...r, cohorts: [] })), null);
  assert.equal(latestCohort(cohortRows(filterUsage(r, { ui: "lune" }))), null);
});

test("activitySeries stacks active phones and events per platform, by day", () => {
  const s = activitySeries(parseUsageReport("usage", usage()));
  assert.equal(s.grain, "day");
  assert.deepEqual(s.labels, ["2026-11-01", "2026-11-02"]);
  assert.deepEqual(s.platforms, ["ios", "android"]);
  assert.deepEqual(s.active, { ios: [2, 0], android: [2, 2] });
  assert.deepEqual(s.events, { ios: [70, 0], android: [30, 20] });
  assert.deepEqual(s.totalActive, [4, 2]);
  assert.equal(s.avgActive, 3);
  const from = activitySeries(parseUsageReport("usage", usage()), { from: "2026-11-02" });
  assert.deepEqual(from.labels, ["2026-11-02"]);
});

test("activitySeries buckets 90 days into Monday weeks: average phones a day, summed events", () => {
  const days = Array.from({ length: 10 }, (_, i) => new Date(Date.UTC(2026, 9, 24 + i)).toISOString().slice(0, 10));
  const r = parseUsageReport("usage", {
    ...usage(),
    days: 90,
    daily: days.map((day, i) => ({ day, platform: "ios", ui: "unknown", active: i, events: 10 })),
  });
  const s = activitySeries(r);
  assert.equal(s.grain, "week");
  // 24–25 Oct (Sat, Sun) sit in the week of 19 Oct; 26 Oct–1 Nov; 2 Nov.
  assert.deepEqual(s.labels, ["2026-10-19", "2026-10-26", "2026-11-02"]);
  assert.deepEqual(s.active.ios, [0.5, 5, 9]);
  assert.deepEqual(s.events.ios, [20, 70, 10]);
  assert.equal(s.avgActive, 4.5);
});

test("Lune is seen from its first event in the window", () => {
  const r = parseUsageReport("usage", usage());
  assert.equal(luneSeen(r), true);
  assert.equal(firstLuneDay(r), "2026-11-02");
  assert.equal(luneSeen(filterUsage(r, { platform: "ios" })), false);
  assert.equal(firstLuneDay(filterUsage(r, { platform: "ios" })), null);
});

test("languageTable reads FR, AR, EN as users per language, with real zeros", () => {
  const rows = languageTable(parseUsageReport("usage", usage()));
  assert.deepEqual(rows.map((l) => [l.language, l.users]), [["fr", 7], ["ar", 0], ["en", 3]]);
  assert.deepEqual(rows[0].platforms, { android: 5, ios: 2 });
});

test("actionRows sums each named action with its details, without app opens", () => {
  const rows = actionRows(parseUsageReport("usage", usage()));
  assert.deepEqual(rows.map((a) => [a.event_name, a.events]), [
    ["charger_viewed", 252],
    ["favorite_toggled", 9],
    ["language_changed", 3],
  ]);
  assert.deepEqual(rows[0].details, [{ detail: "", events: 237 }, { detail: "map", events: 15 }]);
  assert.deepEqual(rows[1].details, [{ detail: "false", events: 5 }, { detail: "true", events: 4 }]);
});

test("funnel helpers sum steps, taps and permissions", () => {
  const r = parseUsageReport("usage", usage());
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
  assert.equal(parseUsageUi("unknown"), "all");
});
