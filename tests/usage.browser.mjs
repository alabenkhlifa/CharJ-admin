// Usage (health categories with drill-ins, Users and Catalog folded in) on
// mocked admin functions, headless. Run against a local Vite server started
// with fake Supabase values, e.g.
//   VITE_SUPABASE_URL=https://fake.supabase.test VITE_SUPABASE_ANON_KEY=fake \
//     npx vite --port 5181 --strictPort &
//   USAGE_URL=http://localhost:5181 PLAYWRIGHT_MODULE=<…>/playwright/index.mjs \
//     node tests/usage.browser.mjs
// Fixtures:
//   development — the approved mock's test-phone snapshot (docs/mockups/admin-dashboard.html DATA),
//                 shaped as admin-usage view=usage;
//   production  — the Task 1 / 1b live production sample (no Lune build yet);
//   zero        — an all-zero report.
// All Supabase traffic is intercepted; this suite never reaches a real backend.
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.USAGE_URL || "http://localhost:5181";
const output = process.env.USAGE_ARTIFACTS || "/tmp/charj-usage-browser";
await mkdir(output, { recursive: true });

// ---- fixtures ----
const html = await readFile(new URL("../docs/mockups/admin-dashboard.html", import.meta.url), "utf8");
const DATA = JSON.parse(html.match(/^const DATA = (\{.*\});$/m)[1]);
const NOW = new Date("2026-11-02T01:23:38Z"); // the snapshot time (02:23 Tunis)
const UIS = ["classic", "lune", "unknown"];
const PLATFORMS = ["android", "ios"];
const PHONE = { iPhone: "ios", S24U: "android" };
const lastDays = (n) => Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 10, 2 - (n - 1) + i)).toISOString().slice(0, 10));
const grid = (days, value) => days.flatMap((day) => PLATFORMS.flatMap((platform) => UIS.map((ui) => ({ day, platform, ui, ...value(day, platform, ui) }))));
const stepGrid = (steps, value) => steps.flatMap((step) => PLATFORMS.flatMap((platform) => UIS.map((ui) => ({ step, platform, ui, ...value(step, platform, ui) }))));
const header = (environment, days) => ({ generated_at: DATA.generated_at, timezone: "Africa/Tunis", environment, days });

// The test phones: the S24U ran an older build until 2 Nov, the iPhone Lune.
const phoneUi = (phone, day) => (phone === "iPhone" || day >= "2026-11-02" ? "lune" : "unknown");
const DEV_DETAIL = { None: "", True: "true", False: "false" };
const fromMockSteps = (rows, map) =>
  stepGrid(Object.keys(map), (step, platform, ui) => {
    if (ui !== "lune") return { events: 0, users: 0 };
    const row = rows.find((r) => r.step === map[step]);
    const phones = (row?.phones ?? []).filter((p) => PHONE[p] === platform);
    const all = row?.phones?.length || 1;
    return { users: phones.length, events: phones.length ? Math.round(((row?.events ?? 0) * phones.length) / all) : 0 };
  });
const development = (days = 30) => {
  const window = lastDays(days);
  const byDay = new Map(DATA.activity.days.map((d) => [d.day, d]));
  const f = DATA.funnels;
  return {
    ...header("development", days),
    daily: grid(window, (day, platform, ui) => {
      const d = byDay.get(day);
      const phones = Object.keys(PHONE).filter((p) => PHONE[p] === platform && phoneUi(p, day) === ui);
      return {
        active: phones.filter((p) => d?.phones_opened_list.includes(p)).length,
        events: phones.reduce((a, p) => a + (d?.events_by_phone[p] ?? 0), 0),
      };
    }),
    cohorts: DATA.cohorts.weeks.flatMap((w) => w.phones.map((p) => ({
      install_week: w.install_week, platform: PHONE[p.phone], ui: "unknown", installed: 1,
      returned_1: +p.back_1d, returned_7: +p.back_7d, returned_30: +p.back_30d,
      finished_1: p.window_1d_finished, finished_7: p.window_7d_finished, finished_30: p.window_30d_finished,
    }))),
    languages: [
      { language: "fr", platform: "android", ui: "lune", users: 1 },
      { language: "en", platform: "android", ui: "unknown", users: 1 },
      { language: "fr", platform: "ios", ui: "lune", users: 1 },
      { language: "ar", platform: "ios", ui: "lune", users: 1 },
    ],
    screens: DATA.screens.flatMap((s) => Object.entries(s.by_platform).map(([platform, v]) => ({ screen: s.screen, platform, ui: "lune", views: v.views, users: v.distinct_phones }))),
    actions: DATA.actions.filter((a) => a.event_name !== "screen_viewed").flatMap((a) => {
      const details = a.detail ? Object.entries(a.detail) : [["", { by_platform: a.by_platform }]];
      return details.flatMap(([detail, v]) => Object.entries(v.by_platform).map(([platform, events]) => ({
        event_name: a.event_name, detail: DEV_DETAIL[detail] ?? detail, platform, ui: "lune", events, users: 1,
      })));
    }),
    funnels: {
      onboarding: fromMockSteps(f.onboarding, { shown: "screen_viewed onboarding", finished: "onboarding_finished (all)", car_added: "onboarding_finished vehicle=added", car_skipped: "onboarding_finished vehicle=skipped", reached_map: "onboarding_finished (all)" }),
      trip: fromMockSteps(f.trip_planner, { opened: "screen_viewed trip_planner", route_requested: "route_requested", route_succeeded: "route_succeeded", saved: "trip_saved", shared: "trip_shared", navigation_launched: "navigation_launched source=trip_planner" }),
      navigate: {
        taps: Object.entries(f.navigate.per_warning).map(([warning, v]) => ({ warning, platform: "ios", ui: "lune", taps: v.taps, went: v.followed_by_launch_2min })),
        launched: fromMockSteps(f.navigate.steps, { directions_tapped: "directions_tapped", navigation_launched: "navigation_launched source=charger" }),
      },
      contributions: { review_started: 3, reviews_posted: 0, add_started: 0, submitted: 0 },
      permissions: f.permissions.notification_permission_result.map((p) => ({ kind: "notification", result: p.result, source: p.source, ui: "lune", count: p.count })),
    },
    missing_cars: { total_searches: DATA.missing_cars.total_car_searches, no_result: DATA.missing_cars.no_result_searches, queries: DATA.missing_cars.queries.map((q) => ({ query: q.query, searches: q.count })) },
    routes: { found: DATA.route_timing.succeeded_n, failed: [], p50_ms: DATA.route_timing.p50_ms, p95_ms: Math.round(DATA.route_timing.p95_ms) },
    android_auto: { sessions: 0, minutes: 0, chargers_opened: 0, navigations: 0 },
  };
};

// Production: the Task 1 / 1b sample. Daily from the mock's production DAU,
// split across the two platforms; every row 'unknown' (no Lune build yet).
const PROD_COHORTS = [
  ["2026-10-26", "android", 4, false, false, false, 2, 2, 2], ["2026-10-26", "ios", 5, false, false, false, 1, 1, 1],
  ["2026-10-19", "android", 2, true, true, false, 0, 0, 0], ["2026-10-19", "ios", 2, true, true, false, 1, 1, 1],
  ["2026-10-12", "android", 3, true, true, false, 1, 3, 3], ["2026-10-12", "ios", 3, true, true, false, 0, 1, 2],
  ["2026-10-05", "android", 1, true, true, false, 0, 0, 1], ["2026-10-05", "ios", 1, true, true, false, 0, 0, 1],
  ["2026-09-28", "ios", 1, true, true, false, 0, 0, 1],
  ["2026-09-21", "android", 1, true, true, true, 0, 0, 1], ["2026-09-21", "ios", 2, true, true, true, 0, 0, 2],
  ["2026-09-14", "android", 3, true, true, true, 0, 0, 0], ["2026-09-14", "ios", 3, true, true, true, 1, 1, 1],
].map(([install_week, platform, installed, finished_1, finished_7, finished_30, returned_1, returned_7, returned_30]) =>
  ({ install_week, platform, ui: "unknown", installed, finished_1, finished_7, finished_30, returned_1, returned_7, returned_30 }));
const PROD_ACTIONS = [
  ["app_opened", "foreground", "android", 263, 19], ["charger_viewed", "", "ios", 237, 17], ["app_opened", "foreground", "ios", 95, 14],
  ["app_opened", "launch", "ios", 62, 19], ["charger_viewed", "", "android", 54, 11], ["app_opened", "launch", "android", 42, 19],
  ["navigation_launched", "charger", "ios", 32, 5], ["search_completed", "all", "android", 23, 4], ["search_completed", "Type 2", "android", 23, 2],
  ["navigation_launched", "charger", "android", 13, 6], ["route_requested", "", "android", 6, 3], ["route_succeeded", "", "android", 6, 3],
  ["navigation_launched", "trip_planner", "android", 5, 2], ["route_requested", "", "ios", 5, 3], ["route_succeeded", "", "ios", 5, 3],
  ["search_completed", "all", "ios", 5, 2], ["navigation_launched", "trip_planner", "ios", 3, 1], ["search_completed", "CCS", "android", 3, 3],
  ["search_completed", "CCS", "ios", 3, 3], ["search_completed", "CHAdeMO", "android", 3, 1], ["search_completed", "Type 2", "ios", 2, 2],
].map(([event_name, detail, platform, events, users]) => ({ event_name, detail, platform, ui: "unknown", events, users }));
const prodDau = new Map(DATA.production_overview.dau_30d.map((d) => [d.day, d.dau]));
const zeroSteps = (steps) => stepGrid(steps, () => ({ events: 0, users: 0 }));
const production = (days = 30) => {
  const trip = { route_requested: { android: [3, 6], ios: [3, 5] }, route_succeeded: { android: [3, 6], ios: [3, 5] }, navigation_launched: { android: [2, 5], ios: [1, 3] } };
  return {
    ...header("production", days),
    daily: grid(lastDays(days), (day, platform, ui) => {
      const dau = prodDau.get(day) ?? 0;
      const active = ui !== "unknown" ? 0 : platform === "android" ? Math.ceil(dau / 2) : Math.floor(dau / 2);
      return { active, events: active * 12 };
    }),
    cohorts: PROD_COHORTS,
    languages: [
      { language: "fr", platform: "android", ui: "unknown", users: 14 },
      { language: "fr", platform: "ios", ui: "unknown", users: 11 },
      { language: "en", platform: "android", ui: "unknown", users: 6 },
      { language: "en", platform: "ios", ui: "unknown", users: 7 },
    ],
    screens: [],
    actions: PROD_ACTIONS,
    funnels: {
      onboarding: zeroSteps(["shown", "finished", "car_added", "car_skipped", "reached_map"]),
      trip: stepGrid(["opened", "route_requested", "route_succeeded", "saved", "shared", "navigation_launched"], (step, platform, ui) => {
        const v = ui === "unknown" ? trip[step]?.[platform] : null;
        return v ? { users: v[0], events: v[1] } : { users: 0, events: 0 };
      }),
      navigate: {
        taps: [],
        launched: stepGrid(["directions_tapped", "navigation_launched"], (step, platform, ui) =>
          step === "navigation_launched" && ui === "unknown" ? (platform === "android" ? { users: 6, events: 13 } : { users: 5, events: 32 }) : { users: 0, events: 0 }),
      },
      contributions: { submitted: 0, add_started: 0, review_started: 0, reviews_posted: 1 },
      permissions: [],
    },
    missing_cars: { queries: [], no_result: 0, total_searches: 0 },
    routes: { found: 11, failed: [], p50_ms: 438, p95_ms: 1614 },
    android_auto: { minutes: 0, sessions: 0, navigations: 0, chargers_opened: 0 },
  };
};
const zero = (environment = "production", days = 30) => ({
  ...header(environment, days),
  daily: grid(lastDays(days), () => ({ active: 0, events: 0 })),
  cohorts: [], languages: [], screens: [], actions: [],
  funnels: {
    onboarding: zeroSteps(["shown", "finished", "car_added", "car_skipped", "reached_map"]),
    trip: zeroSteps(["opened", "route_requested", "route_succeeded", "saved", "shared", "navigation_launched"]),
    navigate: { taps: [], launched: zeroSteps(["directions_tapped", "navigation_launched"]) },
    contributions: { review_started: 0, reviews_posted: 0, add_started: 0, submitted: 0 },
    permissions: [],
  },
  missing_cars: { total_searches: 0, no_result: 0, queries: [] },
  routes: { found: 0, failed: [], p50_ms: null, p95_ms: null },
  android_auto: { sessions: 0, minutes: 0, chargers_opened: 0, navigations: 0 },
});
// Four- and five-digit numbers and long names: for the width checks.
const big = (environment, days = 30) => {
  const r = development(days);
  const x = (n) => n * 1234;
  return {
    ...r,
    environment,
    daily: r.daily.map((d) => ({ ...d, active: x(d.active), events: x(d.events) })),
    cohorts: r.cohorts.map((c) => ({ ...c, installed: x(c.installed) + 17, returned_1: x(c.returned_1), returned_7: x(c.returned_7) + 3, returned_30: x(c.returned_30) })),
    languages: [...r.languages.map((l) => ({ ...l, users: x(l.users) })), { language: "de", platform: "ios", ui: "lune", users: 42 }],
    screens: r.screens.map((s) => ({ ...s, views: x(s.views), users: x(s.users) })),
    actions: r.actions.map((a) => ({ ...a, events: x(a.events) })),
    funnels: {
      ...r.funnels,
      onboarding: r.funnels.onboarding.map((s) => ({ ...s, users: x(s.users), events: x(s.events) })),
      trip: r.funnels.trip.map((s) => ({ ...s, users: x(s.users), events: x(s.events) })),
      navigate: { taps: [...r.funnels.navigate.taps.map((t) => ({ ...t, taps: x(t.taps), went: x(t.went) })), { warning: "private_emergency", platform: "android", ui: "lune", taps: 4321, went: 1234 }], launched: r.funnels.navigate.launched.map((s) => ({ ...s, users: x(s.users), events: x(s.events) })) },
      contributions: { review_started: 12345, reviews_posted: 6789, add_started: 4321, submitted: 1234 },
      permissions: [{ kind: "location", result: "undetermined", source: "map_trip", ui: "lune", count: 12345 }, ...r.funnels.permissions.map((p) => ({ ...p, count: x(p.count) }))],
    },
    missing_cars: { total_searches: 54321, no_result: 12345, queries: [{ query: "mercedes-benz eqs suv 580 4matic", searches: 1234 }, ...r.missing_cars.queries] },
    routes: { found: 123456, failed: [{ reason: "service_unavailable", count: 12345 }, { reason: "no_route", count: 234 }], p50_ms: 12345, p95_ms: 123456 },
  };
};

const user = (i, extra = {}) => ({
  id: `${(i + 10).toString(16).padStart(8, "0")}-1111-4111-8111-${String(i).padStart(12, "0")}`,
  email: null, created_at: "2026-10-30T10:00:00Z", last_sign_in_at: "2026-11-02T00:20:00Z",
  vehicles_count: 1, ratings_count: 0, submissions_count: 0, visits_count: i % 3, events_count: 40 + i, sessions_count: 3 + i,
  device: { platform: i % 2 ? "ios" : "android", app_version: "1.2.1", language: "fr", environment: "production", last_event_at: "2026-11-02T00:40:00Z", model: i % 2 ? "iPhone15,3" : "SM-S928B", os_version: i % 2 ? "18.1" : "15", screen_width: 1290, screen_height: 2796, screen_scale: 3 },
  vehicles: [{ make: "Mercedes-Benz", model: "EQS SUV", variant: "580 4MATIC Long Range Edition", year_from: 2023, is_primary: true }, { make: "BYD", model: "Seal", variant: null, year_from: 2024, is_primary: false }],
  ...extra,
});
const USERS = Array.from({ length: 40 }, (_, i) => user(i));
const MODELS = Array.from({ length: 30 }, (_, i) => ({
  id: `m${i}`, make: i % 2 ? "BYD" : "Mercedes-Benz", model: i % 2 ? `Seal ${i}` : `EQS SUV ${i}`, variant: i % 3 ? "580 4MATIC Long Range Edition" : null,
  year_from: 2022, year_to: i % 4 ? null : 2024, battery_kwh: "108.4", usable_battery_kwh: i % 2 ? "82.5" : null, max_ac_kw: "22.0", max_dc_kw: i % 5 ? "200.0" : "0",
  connectors: ["Type 2", "CCS"], efficiency_wh_per_km: 180, is_active: true, source: i % 3 ? "curated" : "wikidata", dc_charge_curve: null,
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
}));

// ---- harness ----
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || "chrome" });
let checks = 0;
const ok = (cond, msg, extra) => { assert.ok(cond, extra === undefined ? msg : `${msg}: ${JSON.stringify(extra)}`); checks += 1; console.log(`PASS ${msg}`); };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks += 1; console.log(`PASS ${msg}`); };
const errors = [];

/** `server` is read on every request, so a test can change answers mid-run. */
const open = async ({ width = 390, height = 844, colorScheme = "light", server, rtl = false, scale = 1, touch = false } = {}) => {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme, deviceScaleFactor: scale, hasTouch: touch, isMobile: touch });
  await context.clock.setFixedTime(NOW);
  await context.addInitScript(() =>
    localStorage.setItem("charj-admin-auth", JSON.stringify({
      access_token: "test.admin.session", refresh_token: "test-refresh", token_type: "bearer", expires_in: 3600, expires_at: 4102444800,
      user: { id: "a0000000-0000-4000-8000-000000000001", email: "admin@charj.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
    })),
  );
  if (rtl) await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => { document.documentElement.dir = "rtl"; }));
  await context.route("**/auth/v1/**", (route) => route.abort());
  await context.route("https://maps.googleapis.com/**", (route) => route.abort());
  const requests = [];
  await context.route("**/rest/v1/**", (route) => {
    const url = new URL(route.request().url());
    requests.push(`rest:${url.pathname.split("/").pop()}`);
    if (url.pathname.endsWith("/ev_models")) return route.fulfill({ json: server.models ?? MODELS });
    return route.fulfill({ json: [], headers: { "content-range": "*/0" } });
  });
  await context.route("**/functions/v1/**", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    const url = new URL(request.url());
    const name = url.pathname.split("/").pop();
    requests.push(`${name}${url.search}`);
    assert.equal(request.headers().authorization, "Bearer test.admin.session");
    if (name === "admin-usage") {
      if (server.usageStatus) return route.fulfill({ status: server.usageStatus, json: { error: "Usage reporting is unavailable" } });
      const environment = url.searchParams.get("environment");
      const days = Number(url.searchParams.get("days"));
      if (url.searchParams.get("view") !== "usage") return route.fulfill({ status: 400, json: { error: "wrong view" } });
      if (server.delay) await new Promise((r) => setTimeout(r, server.delay));
      return route.fulfill({ json: server.usage(environment, days) });
    }
    if (name === "admin-users") {
      const p = url.searchParams;
      const lookup = p.get("user");
      const list = lookup ? USERS.filter((u) => u.id === lookup) : p.get("filter") === "engaged" ? USERS.filter((u) => u.visits_count > 0) : USERS;
      const page = Number(p.get("page")), perPage = Number(p.get("perPage"));
      return route.fulfill({ json: { users: list.slice((page - 1) * perPage, page * perPage), page, perPage, total: list.length } });
    }
    return route.fulfill({ json: {} });
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  return { context, page, requests };
};

const hscroll = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const settle = (page) => page.waitForTimeout(900); // card rise .5s + stagger, numbers .7s
const ready = async (page) => { await page.waitForSelector(".use .ui-card"); await page.waitForFunction(() => !document.querySelector(".use [aria-busy=true]")); await settle(page); };
const hashOf = (page) => page.evaluate(() => location.hash);
const cardText = (page, id) => page.locator(`#${id}`).innerText();
const titles = (page) => page.$$eval(".use .ui-card .ui-ch h2", (h) => h.map((x) => x.textContent));
// Visible text of a hero value, without the screen-reader copy.
const hero = (page, sel) => page.$eval(`${sel} .ui-val`, (v) => {
  const b = v.querySelector("b");
  return `${b.querySelector(".ui-num")?.textContent ?? b.textContent} ${v.querySelector(":scope > span")?.textContent ?? ""}`.trim();
});
const square = (page, sel) => page.$eval(`${sel} .ui-sq`, (q) => q.getAttribute("style") ?? "");
const pressed = (page) => page.$$eval(".use-filters .ui-seg", (segs) => segs.map((s) => `${s.getAttribute("aria-label")}=${s.querySelector("[aria-pressed=true]")?.textContent}`));
// Every card's content stays inside it (no element pokes out, no text cut off
// beyond one-line ellipsis rows), and no segmented label is clipped.
const fits = (page) => page.evaluate(() => {
  const bad = [];
  for (const card of document.querySelectorAll(".use .ui-card")) {
    const c = card.getBoundingClientRect();
    const name = card.querySelector("h2")?.textContent ?? card.className;
    for (const el of card.querySelectorAll("*")) {
      if (el.closest(".ui-sr") || el.closest("svg") || el.closest("details:not([open])")) continue;
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      if (r.left < c.left - 0.5 || r.right > c.right + 0.5) bad.push(`${name}: ${el.className || el.tagName} pokes out`);
      const cs = getComputedStyle(el);
      if (cs.display === "inline" || cs.textOverflow === "ellipsis" || el.scrollWidth <= el.clientWidth + 1) continue;
      const clipped = cs.overflowX !== "visible";
      const runsOut = r.left + el.scrollWidth > c.right + 0.5;
      if (clipped || runsOut) bad.push(`${name}: ${el.className || el.tagName} is cut off`);
    }
  }
  for (const b of document.querySelectorAll(".use .ui-seg button")) {
    if (b.scrollWidth > b.clientWidth + 1) bad.push(`segment "${b.textContent}" is clipped`);
  }
  const cards = [...document.querySelectorAll(".use-grid > .ui-card:not(.ui-card-wide)")].map((x) => Math.round(x.getBoundingClientRect().x));
  return { bad, columns: new Set(cards).size };
});
const shot = async (page, name) => {
  const { width, height } = page.viewportSize();
  await page.setViewportSize({ width, height: await page.evaluate(() => document.documentElement.scrollHeight) });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${output}/${name}` });
  await page.setViewportSize({ width, height });
};
const SECTIONS = ["activity", "coming-back", "languages", "screens", "actions", "funnels", "cars", "routes", "android-auto", "users"];
const SECTION_TITLE = { activity: "Activity", "coming-back": "Coming back", languages: "Languages", screens: "Screens", actions: "Actions", funnels: "Funnels", cars: "Cars", routes: "Routes", "android-auto": "Android Auto", users: "Users" };
// The overview's order: grouped under the mock's questions.
const OVERVIEW_ORDER = ["activity", "languages", "coming-back", "screens", "actions", "funnels", "routes", "cars", "android-auto", "users"];
const OVERVIEW = OVERVIEW_ORDER.map((s) => SECTION_TITLE[s]);
const devServer = () => ({ usage: (env, days) => (env === "development" ? development(days) : production(days)) });

try {
  // ---- 1. Overview on the test phones: every category, real numbers, 390 / 1440, light / dark ----
  for (const [width, height] of [[390, 844], [1440, 900]]) {
    for (const colorScheme of ["light", "dark"]) {
      const { context, page, requests } = await open({ width, height, colorScheme, server: devServer(), scale: 2 });
      await page.goto(`${base}/#/usage?env=development`);
      await ready(page);
      const tag = `${width} ${colorScheme}`;
      eq(await titles(page), OVERVIEW, `${tag}: one card per category`);
      if (width === 390 && colorScheme === "light") {
        ok(requests.includes("admin-usage?view=usage&days=30&environment=development"), "overview: asks admin-usage view=usage for 30 days", requests);
        eq(await page.locator(".ui-lt p").innerText(), "Last 30 days · Development", "overview: subtitle names the window and data");
        eq(await pressed(page), ["Window=30 days", "Platform=All phones", "App design=Any design", "Data=Development"], "overview: four filters");
        eq(await page.$$eval(".use-sec", (h) => h.map((x) => x.textContent)), ["Is anyone using it?", "Do people come back?", "Which features get used?", "Where do people get stuck?", "Cars and Android Auto", "Who uses it?"], "overview: the mock's questions head the groups");
        eq(await page.$$eval(".use a.ui-card", (a) => a.map((x) => x.getAttribute("href"))), OVERVIEW_ORDER.map((s) => `#/usage?env=development&section=${s}`), "overview: every card is a Show all link that keeps the filters");
        ok((await page.$$eval(".use a.ui-card .ui-meta", (m) => m.map((x) => x.textContent))).every((t) => t === "Show all"), "overview: each card says Show all");
        const avg = development().daily.reduce((a, d) => a + d.active, 0) / 30;
        eq(await hero(page, "#usage-activity"), `${(Math.round(avg * 10) / 10).toFixed(1)} phones a day`, "activity: the window's average a day");
        eq(await page.locator("#usage-activity .ui-bars i").count(), 30, "activity: 30 daily bars");
        eq(await hero(page, "#usage-coming-back"), "1 of 1", "coming back: the newest final week, as counts");
        ok((await cardText(page, "usage-coming-back")).includes("Counts only"), "coming back: says why there's no percentage");
        eq((await page.locator("#usage-languages .use-stats").innerText()).replace(/\s+/g, " "), "2 French 1 Arabic 1 English", "languages: users per language, FR / AR / EN");
        ok((await cardText(page, "usage-languages")).includes("Users per language"), "languages: labelled users per language");
        ok((await cardText(page, "usage-languages")).includes("3 language switches in the last 30 days."), "languages: language_changed switches from actions");
        eq(await hero(page, "#usage-screens"), "238 views", "screens: total views");
        eq(await page.$$eval("#usage-screens .ui-lad-name", (n) => n.map((x) => x.textContent)), ["Map", "Charger detail", "List"], "screens: top three");
        eq(await page.$$eval("#usage-actions .ui-lad-name", (n) => n.map((x) => x.textContent)), ["Charger opened", "Route asked", "Route found"], "actions: top three, without app opens");
        eq(await page.$$eval("#usage-funnels .use-lines li", (l) => l.map((x) => x.innerText.replace(/\s+/g, " "))), [
          "Onboarding 2 shown · 2 reached the map",
          "Trip planner 2 opened · 1 navigated",
          "Navigate from a charger 4 taps · 4 went",
          "Contributions 3 reviews started · 0 posted · 0 chargers sent",
          "Permissions 4 asked · 4 allowed",
        ], "funnels: first and last step of each funnel");
        ok((await square(page, "#usage-funnels")).includes("linear-gradient"), "funnels: a gradient square, since it holds four funnels");
        eq(await hero(page, "#usage-cars"), "2 of 4 searches found nothing", "cars: counts under 10 searches");
        eq((await page.locator("#usage-routes .use-stats").innerText()).replace(/\s+/g, " "), "0.5 s typical answer 9.1 s slowest 5%", "routes: typical and slowest answers");
        ok((await cardText(page, "usage-android-auto")).includes("No car events yet. They arrive with the next native build."), "android auto: not tracked yet, never a 0");
        ok((await square(page, "#usage-android-auto")).includes("--c-idle-fill"), "android auto: Idle Grey square");
        eq(await hero(page, "#usage-users"), "40 sessions", "users: the session total from admin-users");
        ok(requests.some((r) => r.startsWith("admin-users?page=1&perPage=1&filter=all")), "users: the overview asks for one row only", requests);
        ok(!/NaN|undefined|Infinity/.test(await page.locator(".use").innerText()), "overview: no NaN, undefined or Infinity");
      }
      if (width === 1440) {
        const fit = await fits(page);
        eq(fit.columns, 2, `${tag}: categories pair up`);
      }
      eq(await hscroll(page), 0, `${tag}: no horizontal scroll`);
      const fit = await fits(page);
      ok(fit.bad.length === 0, `${tag}: every card's content fits inside it`, fit);
      await shot(page, `t8-${width}-${colorScheme}.png`);
      await context.close();
    }
  }

  // ---- 2. Drill-ins: each card opens its section; Back returns; charts, tables, widths ----
  {
    const { context, page } = await open({ server: devServer() });
    await page.goto(`${base}/#/usage?env=development`);
    await ready(page);
    for (const s of SECTIONS) {
      await page.locator(`#usage-${s}`).click();
      await page.waitForFunction((x) => location.hash.includes(`section=${x}`), s);
      await ready(page);
      eq(await hashOf(page), `#/usage?env=development&section=${s}`, `${s}: the card opens its drill-in`);
      eq(await page.locator(".ui-lt h1").innerText(), SECTION_TITLE[s], `${s}: large title`);
      eq(await page.locator(".use-back").getAttribute("href"), "#/usage?env=development", `${s}: the back link keeps the filters`);
      ok((await page.evaluate(() => scrollY)) === 0, `${s}: opens at its top`);
      eq(await hscroll(page), 0, `${s}: no horizontal scroll at 390`);
      const fit = await fits(page);
      ok(fit.bad.length === 0, `${s}: every card's content fits at 390`, fit);
      ok(!/NaN|undefined|Infinity/.test(await page.locator(".use").innerText()), `${s}: no NaN, undefined or Infinity`);
      await page.goBack();
      await page.waitForSelector("#usage-activity");
    }
    // Filters shown only where they change something.
    const seen = {};
    for (const s of SECTIONS) {
      await page.goto(`${base}/#/usage?env=development&section=${s}`);
      await ready(page);
      seen[s] = await page.$$eval(".use-filters .ui-seg", (x) => x.map((e) => e.getAttribute("aria-label")));
    }
    eq(seen, {
      activity: ["Window", "Platform", "App design", "Data"], "coming-back": ["Platform", "App design", "Data"], languages: ["Window", "Platform", "App design", "Data"],
      screens: ["Window", "Platform", "App design", "Data"], actions: ["Window", "Platform", "App design", "Data"], funnels: ["Window", "Platform", "App design", "Data"],
      cars: ["Window", "Data"], routes: ["Window", "Data"], "android-auto": [], users: [],
    }, "drill-ins: only the filters that change what they show");
    // Activity: stacked platform columns, tooltip on tap, a table.
    await page.goto(`${base}/#/usage?env=development&section=activity`);
    await ready(page);
    eq(await titles(page), ["Active phones", "Events"], "activity: active phones and events");
    eq(await page.locator(".use .ui-card").first().locator(".ui-key span").allInnerTexts(), ["iOS", "Android"], "activity: iOS and Android series with a key");
    eq(await page.locator(".use .ui-card").first().locator("rect.ui-hit").count(), 30, "activity: a hit target per day");
    await page.locator(".use .ui-card").first().locator("summary").click();
    ok((await page.locator(".use .ui-card").first().locator("table tbody tr").count()) > 0, "activity: Show table lists the days with phones");
    eq(await hscroll(page), 0, "activity: the open table keeps the page from scrolling sideways");
    // Coming back: the May iPhone install predates tracking: not tracked, never 0.
    await page.goto(`${base}/#/usage?env=development&section=coming-back`);
    await ready(page);
    const coh = await page.$$eval(".use .ui-coh li", (li) => li.map((x) => x.innerText.replace(/\s+/g, " ")));
    eq(coh.length, 2, "coming back: two install weeks");
    ok(coh[0].startsWith("Week of 19 Oct 1 Android") && coh[0].includes("Within 7 days 1 of 1") && coh[0].includes("open"), "coming back: the S24U week, 30-day window still open", coh);
    ok(coh[1].startsWith("Week of 18 May 1 iOS") && (coh[1].match(/not tracked/g) ?? []).length === 3, "coming back: the May week reads not tracked", coh);
    // Funnels: five cards; navigate by warning → went.
    await page.goto(`${base}/#/usage?env=development&section=funnels`);
    await ready(page);
    eq(await titles(page), ["Onboarding", "Trip planner", "Navigate from a charger", "Contributions", "Permissions"], "funnels: five cards");
    const nav = page.locator(".use .ui-card", { hasText: "Navigate from a charger" });
    eq(await nav.locator(".ui-lad li").evaluateAll((li) => li.map((x) => [x.querySelector(".ui-lad-name").textContent, x.querySelector(".ui-lad-v").firstChild.textContent, x.querySelector(".ui-lad-v small")?.textContent ?? ""].join(" | "))), ["Navigate tapped | 4 | ", "Brand-only warning | 2 | 2 went", "Customers-only warning | 2 | 2 went", "Navigation opened | 6 | 2 users"], "navigate: taps by warning, then went");
    // Cars: missing names + the catalog.
    await page.goto(`${base}/#/usage?env=development&section=cars`);
    await ready(page);
    await page.waitForSelector("#usage-catalog .use-models li");
    eq(await titles(page), ["Cars not in the catalog", "Car catalog"], "cars: missing names and the catalog");
    eq(await page.$$eval(".use .ui-card:first-child tbody td:first-child", (td) => td.map((x) => x.textContent)), ["byd seal uu", "im 7"], "cars: the names searched for");
    await context.close();
  }

  // ---- 3. Filters live in the URL and survive a reload ----
  {
    const { context, page, requests } = await open({ server: devServer() });
    await page.goto(`${base}/#/usage`);
    await ready(page);
    ok(requests.includes("admin-usage?view=usage&days=30&environment=production"), "filters: production, 30 days by default");
    await page.locator(".ui-seg[aria-label=Data] button", { hasText: "Development" }).click();
    await ready(page);
    await page.locator(".ui-seg[aria-label=Window] button", { hasText: "7 days" }).click();
    await ready(page);
    ok(requests.includes("admin-usage?view=usage&days=7&environment=development"), "filters: days refetches from the server", requests);
    const before = requests.filter((r) => r.startsWith("admin-usage")).length;
    await page.locator(".ui-seg[aria-label=Platform] button", { hasText: "iOS" }).click();
    await page.locator(".ui-seg[aria-label='App design'] button", { hasText: "Lune" }).click();
    await settle(page);
    eq(requests.filter((r) => r.startsWith("admin-usage")).length, before, "filters: platform and design filter in the browser, no new request");
    eq(await hashOf(page), "#/usage?env=development&days=7&platform=ios&ui=lune", "filters: all four in the URL");
    eq(await page.locator(".ui-lt p").innerText(), "Last 7 days · Development · iOS · Lune", "filters: the subtitle says what's shown");
    const iosLune = development(7).daily.filter((d) => d.platform === "ios" && d.ui === "lune");
    const first = iosLune.filter((d) => d.events).map((d) => d.day).sort()[0];
    const shown = iosLune.filter((d) => d.day >= first);
    eq(await hero(page, "#usage-activity"), `${(Math.round((shown.reduce((a, d) => a + d.active, 0) / shown.length) * 10) / 10).toFixed(1)} phones a day`, "filters: Activity counts iOS on Lune only");
    ok((await cardText(page, "usage-activity")).includes("Starts on 1 Nov, the first day with the Lune design."), "filters: a Lune chart starts at its first event, said on the card");
    eq(await page.locator("#usage-activity .ui-bars i").count(), shown.length, "filters: no zero days drawn before Lune");
    ok((await cardText(page, "usage-routes")).includes("Not split by platform or design"), "filters: routes say they count every phone");
    await page.reload();
    await ready(page);
    eq(await pressed(page), ["Window=7 days", "Platform=iOS", "App design=Lune", "Data=Development"], "filters: survive a reload");
    ok(requests.filter((r) => r === "admin-usage?view=usage&days=7&environment=development").length >= 2, "filters: the reload asks for the same window and data");
    await page.locator("#usage-screens").click();
    await ready(page);
    eq(await hashOf(page), "#/usage?days=7&platform=ios&ui=lune&env=development&section=screens", "filters: a drill-in keeps them");
    eq(await pressed(page), ["Window=7 days", "Platform=iOS", "App design=Lune", "Data=Development"], "filters: the drill-in shows them");
    await page.reload();
    await ready(page);
    eq(await page.locator(".ui-lt h1").innerText(), "Screens", "filters: a drill-in survives a reload");
    eq(await page.locator(".use .ui-card").first().locator(".ui-key").count(), 0, "filters: iOS only, so a single series without a key");
    // A filter that matches nothing: an honest empty state, not zeros.
    await page.goto(`${base}/#/usage?env=development&platform=ios&ui=classic`);
    await ready(page);
    eq(await cardText(page, "usage-activity").then((t) => t.split("\n").slice(-1)[0]), "No iOS phones on the classic design opened the app in the last 30 days.", "empty filter: Activity says so");
    eq(await page.locator("#usage-activity .ui-bars, #usage-activity .ui-val").count(), 0, "empty filter: no zero bars or hero");
    ok((await cardText(page, "usage-screens")).includes("Only the Lune design sends these events."), "empty filter: Lune-only charts say why under Classic");
    eq(await hscroll(page), 0, "filters: no horizontal scroll");
    await context.close();
  }

  // ---- 4. Production before the Lune update: Lune-only charts say when they start ----
  {
    const { context, page } = await open({ server: devServer() });
    await page.goto(`${base}/#/usage`);
    await ready(page);
    for (const id of ["usage-screens"]) {
      ok((await cardText(page, id)).includes("Starts with the Lune update."), `production: ${id} starts with the Lune update`);
      ok((await square(page, `#${id}`)).includes("--c-idle-fill"), `production: ${id} square goes Idle Grey`);
    }
    eq(await page.$$eval("#usage-funnels .use-lines li", (l) => l.map((x) => x.innerText.replace(/\s+/g, " "))), [
      "Onboarding Starts with the Lune update.",
      "Trip planner 6 people asked a route · 3 navigated",
      "Navigate from a charger 45 navigations opened",
      "Contributions 1 review posted",
      "Permissions Starts with the Lune update.",
    ], "production: funnels keep what old builds send, and say when the rest starts");
    ok((await cardText(page, "usage-cars")).includes("Starts with the Lune update."), "production: missing cars start with the Lune update");
    eq(await hero(page, "#usage-coming-back"), "1 of 4", "production: came back 1 of 4 (week of 19 Oct)");
    eq((await page.locator("#usage-languages .use-stats").innerText()).replace(/\s+/g, " "), "25 French 0 Arabic 13 English", "production: FR 25 · AR 0 · EN 13");
    await shot(page, "t8-390-production.png");
    await page.goto(`${base}/#/usage?section=funnels`);
    await ready(page);
    ok((await page.locator(".use .ui-card", { hasText: "Onboarding" }).innerText()).includes("Starts with the Lune update."), "production: onboarding drill-in waits for Lune");
    eq(await page.locator(".use .ui-card", { hasText: "Trip planner" }).locator(".ui-lad-name").allInnerTexts(), ["Route asked", "Route found", "Navigation opened"], "production: trip leaves out the Lune steps instead of drawing 0");
    ok((await page.locator(".use .ui-card", { hasText: "Trip planner" }).innerText()).includes("Planner opened, saved and shared: starts with the Lune update."), "production: and says so");
    await page.goto(`${base}/#/usage?section=screens`);
    await ready(page);
    eq(await page.locator(".use .ui-card .ui-empty").allInnerTexts(), ["Starts with the Lune update.", "Starts with the Lune update."], "production: screens drill-in waits for Lune");
    await page.goto(`${base}/#/usage?ui=lune`);
    await ready(page);
    ok((await cardText(page, "usage-activity")).includes("Starts with the Lune update."), "production + Lune filter: Activity starts with the Lune update");
    await context.close();
  }

  // ---- 5. An all-zero report: no NaN, honest empties ----
  {
    const { context, page } = await open({ server: { usage: (env, days) => zero(env, days) } });
    await page.goto(`${base}/#/usage`);
    await ready(page);
    const text = await page.locator(".use").innerText();
    ok(!/NaN|undefined|Infinity|null/.test(text), "zero: no NaN, undefined, Infinity or null anywhere");
    ok(text.includes("No phones opened the app in the last 30 days."), "zero: Activity is an honest empty");
    ok((await cardText(page, "usage-coming-back")).includes("Fills in once an install week has had its 7 days"), "zero: Coming back says when it fills in");
    ok(text.includes("No routes asked in the last 30 days."), "zero: Routes is an honest empty");
    eq(await page.locator(".use .ui-bars").count(), 0, "zero: no zero bars drawn");
    eq(await hscroll(page), 0, "zero: no horizontal scroll");
    await shot(page, "t8-390-zero.png");
    for (const s of SECTIONS.filter((x) => x !== "users")) {
      await page.goto(`${base}/#/usage?section=${s}`);
      await ready(page);
      ok(!/NaN|undefined|Infinity|null/.test(await page.locator(".use").innerText()), `zero: ${s} drill-in has no NaN`);
      eq(await page.locator(".use svg rect.ui-hit").count(), 0, `zero: ${s} draws no chart of zeros`);
    }
    await context.close();
  }

  // ---- 6. Users: the user= lookup, filters and pages in the URL ----
  {
    const { context, page, requests } = await open({ server: devServer() });
    const target = USERS[7].id;
    await page.goto(`${base}/#/users?user=${target}`);
    await page.waitForSelector(".use-users li, .use-users-table tr");
    eq(await hashOf(page), `#/usage?tab=users&user=${target}`, "users: the old link lands on Usage → Users");
    ok(requests.some((r) => r.startsWith("admin-users?") && r.includes(`user=${target}`)), "users: asks admin-users for that driver", requests);
    ok(!requests.some((r) => r.startsWith("admin-usage")), "users: the usage report is not fetched for Users");
    eq(await page.locator(".use-users li").count(), 1, "users: one driver");
    eq(await page.locator(".use-chip").innerText().then((t) => t.replace(/\s+/g, " ").trim()), `Driver ${target.slice(0, 8)}… ×`, "users: the lookup chip");
    eq(await page.locator(".use .ui-card .ui-meta").innerText(), "1 driver", "users: meta says one driver");
    eq(await hscroll(page), 0, "users: no horizontal scroll at 390");
    let fit = await fits(page);
    ok(fit.bad.length === 0, "users: rows fit at 390", fit);
    await page.locator(".use-chip button").click();
    await page.waitForFunction(() => document.querySelectorAll(".use-users li").length > 1);
    eq(await hashOf(page), "#/usage?tab=users", "users: clearing the lookup drops user=");
    eq(await page.locator(".use-users li").count(), 25, "users: 25 a page");
    await page.locator(".ui-pager button", { hasText: "Next" }).click();
    await page.waitForFunction(() => location.hash.includes("page=2"));
    await page.waitForSelector(".use-users li");
    eq(await page.locator(".ui-pager-range").innerText(), "26–40 of 40", "users: page 2 in the URL");
    await page.locator(".ui-seg[aria-label=Show] button", { hasText: "Engaged only" }).click();
    await page.waitForFunction(() => location.hash.includes("show=engaged") && !location.hash.includes("page="));
    await page.reload();
    await page.waitForSelector(".use-users li");
    eq(await page.locator(".ui-seg[aria-label=Show] [aria-pressed=true]").innerText(), "Engaged only", "users: the filter survives a reload");
    ok(requests.some((r) => r.includes("filter=engaged")), "users: engaged asks the server");
    const copy = page.locator(".use-users li .use-id").first();
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await copy.click();
    eq(await copy.innerText(), "Copied", "users: tapping an id copies it");
    for (const width of [768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(300);
      eq(await hscroll(page), 0, `users: no horizontal scroll at ${width}`);
      fit = await fits(page);
      ok(fit.bad.length === 0, `users: fits at ${width}`, fit);
      eq(await page.locator(".use-users-table").isVisible(), width === 1440, `users: ${width === 1440 ? "a table on a wide card" : "rows on a narrow card"}`);
    }
    await shot(page, "t8-1440-users.png");
    // Driver visits → Open driver now builds section=users.
    await page.goto(`${base}/#/usage?section=users&user=${USERS[3].id}`);
    await page.waitForSelector(".use-chip");
    ok(true, "users: section=users&user= works too");
    await context.close();
  }

  // ---- 7. Catalog: the old Vehicles link, pages in the URL ----
  {
    const { context, page, requests } = await open({ server: devServer() });
    await page.goto(`${base}/#/vehicles`);
    await page.waitForSelector("#usage-catalog .use-models li");
    eq(await hashOf(page), "#/usage?tab=catalog", "catalog: the old link lands on Usage → Cars");
    ok(requests.includes("rest:ev_models"), "catalog: reads ev_models");
    eq(await page.locator(".ui-lt h1").innerText(), "Cars", "catalog: inside Cars");
    eq(await page.locator("#usage-catalog .ui-meta").innerText(), "30 models", "catalog: model count");
    eq(await page.locator("#usage-catalog .use-models li").count(), 24, "catalog: 24 a page");
    eq(await page.locator("#usage-catalog .use-models li .use-d").first().innerText(), "2022–2024 · 108.4 kWh · 22 kW AC · Type 2, CCS", "catalog: years, usable battery, the headline charge and connectors");
    eq(await page.locator("#usage-catalog .use-cap").innerText(), "20 curated · 10 wikidata. Read-only: adding a car stays a database job.", "catalog: sources");
    eq(await titles(page), ["Car catalog", "Cars not in the catalog"], "catalog: the old link puts the catalog first");
    await page.locator("#usage-catalog .ui-pager button", { hasText: "Next" }).click();
    await page.waitForFunction(() => location.hash.includes("page=2"));
    eq(await page.locator("#usage-catalog .use-models li").count(), 6, "catalog: page 2");
    eq(await hscroll(page), 0, "catalog: no horizontal scroll");
    const fit = await fits(page);
    ok(fit.bad.length === 0, "catalog: fits at 390", fit);
    await context.close();
  }

  // ---- 8. Widths: overview and every drill-in at 375 / 768 / 1024 / 1440, snapshot and big numbers ----
  for (const [width, fixture] of [[375, "dev"], [375, "big"], [768, "dev"], [768, "big"], [1024, "dev"], [1024, "big"], [1440, "big"]]) {
    const server = { usage: (env, days) => (fixture === "big" ? big(env, days) : development(days)) };
    const { context, page } = await open({ width, height: 1000, server });
    for (const s of [null, ...SECTIONS]) {
      await page.goto(`${base}/#/usage?env=development${s ? `&section=${s}` : ""}`);
      if (s === "users") await page.waitForSelector(".use-users li", { state: "attached" });
      else if (s === "cars") await page.waitForSelector("#usage-catalog .use-models li");
      await ready(page);
      const tag = `${width} ${fixture} ${s ?? "overview"}`;
      const fit = await fits(page);
      ok(fit.bad.length === 0, `${tag}: fits`, fit);
      eq(await hscroll(page), 0, `${tag}: no horizontal scroll`);
      if (!s) eq(fit.columns, width >= 1024 + 80 ? 2 : 1, `${tag}: ${width >= 1100 ? "two columns" : "one column"}`);
    }
    if (width === 768 && fixture === "dev") {
      await page.goto(`${base}/#/usage?env=development`);
      await ready(page);
      await shot(page, "t8-768-light.png");
    }
    await context.close();
  }

  // ---- 9. Loading, errors, retry ----
  {
    const server = { ...devServer(), delay: 1200 };
    const { context, page } = await open({ server });
    await page.goto(`${base}/#/usage?env=development`);
    await page.waitForSelector(".use .ui-card");
    eq(await titles(page), OVERVIEW, "loading: the card shells stay while the report loads");
    ok((await page.locator(".use [aria-busy=true]").count()) >= 8, "loading: the cards say Loading…");
    eq(await page.locator(".use .ui-val:not(#usage-users .ui-val), .use .ui-bars, .use .ui-lad, .use-stats").count(), 0, "loading: no numbers while loading");
    await ready(page);
    await page.locator(".ui-seg[aria-label=Window] button", { hasText: "90 days" }).click();
    await page.waitForSelector(".use [aria-busy=true]");
    eq(await page.locator("#usage-activity .ui-bars").count(), 0, "loading: a new window never shows the old numbers");
    await ready(page);
    eq(await page.locator("#usage-activity .ui-bars i").count(), 14, "90 days: Monday weeks, not 90 thin days");
    eq(await page.locator("#usage-activity .ui-ax").innerText(), "3 Aug\nThis week", "90 days: the axis runs from the first week to this week");
    await page.goto(`${base}/#/usage?env=development&days=90&section=activity`);
    await ready(page);
    eq(await page.locator(".use .ui-card").first().locator(".ui-meta").innerText(), "a day, by week", "90 days: the drill-in says each column is a week");
    await context.close();

    const failing = { ...devServer(), usageStatus: 503 };
    const second = await open({ server: failing });
    await second.page.goto(`${base}/#/usage`);
    await second.page.waitForSelector(".use-retry");
    ok((await second.page.locator(".use-retry").innerText()).includes("Usage reporting is unavailable right now."), "error: said plainly, with Try again");
    ok((await second.page.locator(".use [aria-busy=false]").count()) >= 8, "error: the cards say they couldn't load");
    eq(await second.page.locator(".use .ui-bars, .use .ui-lad, .use-stats").count(), 0, "error: no numbers drawn from nothing");
    failing.usageStatus = 0;
    await second.page.locator(".use-retry button").click();
    await ready(second.page);
    ok(await second.page.locator("#usage-activity .ui-bars").isVisible(), "error: Try again loads the report");
    await second.context.close();
  }

  // ---- 10. Touch tooltips and RTL ----
  {
    const { context, page } = await open({ server: devServer(), touch: true });
    await page.goto(`${base}/#/usage?env=development&section=screens`);
    await ready(page);
    await page.locator(".use .ui-card").first().locator("rect.ui-hit").first().tap();
    await page.waitForSelector(".ui-tip");
    eq(await page.locator(".ui-tip .ui-tip-t").innerText(), "Map", "touch: a tap shows the bar's tooltip");
    await context.close();
    const rtl = await open({ server: devServer(), rtl: true });
    await rtl.page.goto(`${base}/#/usage?env=development`);
    await ready(rtl.page);
    eq(await hscroll(rtl.page), 0, "rtl: no horizontal scroll at 390");
    await rtl.page.goto(`${base}/#/usage?env=development&section=funnels`);
    await ready(rtl.page);
    eq(await hscroll(rtl.page), 0, "rtl: drill-in, no horizontal scroll");
    const back = await rtl.page.evaluate(() => { const a = document.querySelector(".use-back").getBoundingClientRect(); return a.right > innerWidth / 2; });
    ok(back, "rtl: the back link sits at the inline start (right)");
    await rtl.page.screenshot({ path: `${output}/t8-390-rtl.png` });
    await rtl.context.close();
  }

  // ---- 11. Drill-in screenshots (390 / 1440, light / dark) ----
  for (const [width, height, colorScheme, sections] of [
    [390, 844, "light", ["activity", "coming-back", "funnels", "users"]],
    [390, 844, "dark", ["screens"]],
    [1440, 900, "light", ["activity", "funnels", "cars"]],
    [1440, 900, "dark", ["languages"]],
  ]) {
    const { context, page } = await open({ width, height, colorScheme, server: devServer(), scale: 2 });
    for (const s of sections) {
      await page.goto(`${base}/#/usage?env=development&section=${s}`);
      if (s === "users") await page.waitForSelector(".use-users li", { state: "attached" });
      if (s === "cars") await page.waitForSelector("#usage-catalog .use-models li");
      await ready(page);
      const fit = await fits(page);
      ok(fit.bad.length === 0 && (await hscroll(page)) === 0, `${width} ${colorScheme} ${s}: fits, no horizontal scroll`, fit);
      await shot(page, `t8-${width}-${colorScheme}-${s}.png`);
    }
    await context.close();
  }

  ok(errors.length === 0, "no page or console errors", errors);
  console.log(`\n${checks} checks passed`);
} finally {
  await browser.close();
}
