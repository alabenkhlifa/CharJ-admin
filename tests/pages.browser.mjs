// Every page, headless, on mocked functions: each route (and each view inside
// it) at 375 / 768 / 1440 in light and dark, plus right to left at 375.
// Run against a local Vite server started with fake Supabase values, e.g.
//   VITE_SUPABASE_URL=https://fake.supabase.test VITE_SUPABASE_ANON_KEY=fake \
//     npx vite --port 5181 --strictPort &
//   PAGES_URL=http://localhost:5181 PLAYWRIGHT_MODULE=<…>/playwright/index.mjs \
//     node tests/pages.browser.mjs
// Every admin function and every table read is answered in memory; this suite
// never reaches a real backend. Google Maps is never loaded (its script is
// aborted): the only console errors allowed are that script failing, matched
// by its URL (and the Maps loader saying so, matched by the loader's URL).
// Each view asserts: no horizontal scroll, no console or page error, no NaN or
// Infinity in any text or label, the large title is there, nothing still
// loading and no error line (every read was answered), the folded title bar
// spans the main area, and the nav badge has at least 4.5:1 contrast.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PAGES_URL || "http://localhost:5181";
const output = process.env.PAGES_ARTIFACTS || "/tmp/charj-pages-browser";
// Optional: a folder for one shot per page at 390 light and 1440 dark.
const shots = process.env.PAGES_SHOTS || null;
await mkdir(output, { recursive: true });
if (shots) await mkdir(shots, { recursive: true });

// ---- fixtures ----
const NOW = new Date("2026-11-02T10:00:00Z"); // a Monday, 11:00 in Tunis
const DAY = 86_400_000;
const iso = (ms) => new Date(ms).toISOString();
const isoDay = (ms) => iso(ms).slice(0, 10);
const uuid = (prefix, n) => `${prefix}0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const PLATFORMS = ["android", "ios"];
const DESIGNS = ["classic", "lune", "unknown"];
// One row per platform × design, plus the server's ui='all' rows (people once across designs).
const split = (key, value) =>
  PLATFORMS.flatMap((platform) => [
    ...DESIGNS.map((ui, d) => ({ ...key, platform, ui, ...value(platform, d) })),
    { ...key, platform, ui: "all", ...value(platform, 3) },
  ]);
const lastDays = (n) => Array.from({ length: n }, (_, i) => isoDay(NOW.getTime() - (n - 1 - i) * DAY));
const mondays = (n) => {
  const monday = Date.UTC(2026, 10, 2);
  return Array.from({ length: n }, (_, i) => isoDay(monday - (n - i) * 7 * DAY));
};

const summary = (environment) => ({
  generated_at: iso(NOW.getTime()),
  timezone: "Africa/Tunis",
  environment,
  today: { active: 14 },
  avg7: 11.43,
  daily: lastDays(30).map((day, i) => ({ day, active: 6 + (i % 9) })),
  cohort: { install_week: mondays(3)[0], installed: 12, back_7d: 5 },
  versions: [
    { platform: "android", app_version: "1.3.0", ui: "lune", users: 9 },
    { platform: "android", app_version: "1.2.1", ui: "unknown", users: 31 },
    { platform: "ios", app_version: "1.3.0", ui: "lune", users: 4 },
  ],
  dropped_7d: 0,
  same_day_last_week: { active: 9 },
  languages: [{ language: "fr", users: 25 }, { language: "ar", users: 8 }, { language: "en", users: 13 }],
});

const step = (steps) => steps.flatMap((name, s) => split({ step: name }, (p, d) => ({ events: (40 - s * 6) * (d + 1), users: Math.max(0, 12 - s * 2) + d })));
const usage = (environment, days) => ({
  generated_at: iso(NOW.getTime()),
  timezone: "Africa/Tunis",
  environment,
  days,
  daily: lastDays(days).flatMap((day, i) => split({ day }, (p, d) => ({ active: d === 3 ? 4 + (i % 6) : 1 + ((i + d) % 3), events: 30 + ((i * 7 + d) % 40) }))),
  cohorts: mondays(8).flatMap((install_week, w) =>
    split({ install_week }, (p, d) => {
      const installed = d === 3 ? 12 + w : 3 + w;
      const age = (NOW.getTime() - Date.parse(install_week)) / DAY;
      return {
        installed, returned_1: Math.floor(installed / 2), returned_7: Math.floor(installed / 3), returned_30: Math.floor(installed / 5),
        finished_1: age >= 8, finished_7: age >= 14, finished_30: age >= 37,
      };
    }),
  ),
  languages: ["fr", "ar", "en"].flatMap((language, l) => split({ language }, (p, d) => ({ users: (6 - l * 2) + d }))),
  screens: ["map", "charger", "list", "trip_planner", "settings", "saved_plans", "onboarding", "add", "vehicle_search", "updates", "feedback"].flatMap((screen, s) =>
    split({ screen }, (p, d) => ({ views: (120 - s * 9) * (d + 1), users: Math.max(1, 14 - s) + d })),
  ),
  actions: [
    ["charger_viewed", "map"], ["charger_viewed", "list"], ["favorite_toggled", "true"], ["favorite_toggled", "false"],
    ["search_completed", ""], ["filter_changed", ""], ["language_changed", "ar"], ["theme_changed", "dark"],
  ].flatMap(([event_name, detail], a) => split({ event_name, detail }, (p, d) => ({ events: (60 - a * 5) * (d + 1), users: Math.max(1, 10 - a) + d }))),
  funnels: {
    onboarding: step(["shown", "finished", "car_added", "car_skipped", "reached_map"]),
    trip: step(["opened", "route_requested", "route_succeeded", "saved", "shared", "navigation_launched"]),
    navigate: {
      taps: ["none", "brand_exclusive", "customers_only", "closed_today"].flatMap((warning, w) => split({ warning }, (p, d) => ({ taps: (30 - w * 6) * (d + 1), went: (12 - w * 3) * (d + 1) }))),
      launched: step(["directions_tapped", "navigation_launched"]),
    },
    contributions: { review_started: 23, reviews_posted: 9, add_started: 14, submitted: 4 },
    permissions: [
      { kind: "location", result: "granted", source: "map_locate", ui: "lune", count: 31 },
      { kind: "location", result: "denied", source: "map_trip", ui: "classic", count: 4 },
      { kind: "notification", result: "granted", source: "prompt", ui: "lune", count: 12 },
      { kind: "notification", result: "denied", source: "settings", ui: "unknown", count: 3 },
    ],
  },
  missing_cars: { total_searches: 140, no_result: 22, queries: [{ query: "mercedes-benz eqs suv 580 4matic", searches: 6 }, { query: "xpeng g6", searches: 3 }] },
  routes: { found: 87, failed: [{ reason: "no_route", count: 5 }, { reason: "network", count: 2 }], p50_ms: 812, p95_ms: 4120 },
  android_auto: { sessions: 0, minutes: 0, chargers_opened: 0, navigations: 0 },
});

const USERS = Array.from({ length: 30 }, (_, i) => ({
  id: `${(i + 10).toString(16).padStart(8, "0")}-1111-4111-8111-${String(i).padStart(12, "0")}`,
  email: null, created_at: "2026-10-30T10:00:00Z", last_sign_in_at: "2026-11-02T00:20:00Z",
  vehicles_count: 1, ratings_count: 0, submissions_count: 0, visits_count: i % 3, events_count: 40 + i, sessions_count: 3 + i,
  device: { platform: i % 2 ? "ios" : "android", app_version: "1.3.0", language: "fr", environment: "production", last_event_at: "2026-11-02T00:40:00Z", model: i % 2 ? "iPhone15,3" : "SM-S928B", os_version: i % 2 ? "18.1" : "15", screen_width: 1290, screen_height: 2796, screen_scale: 3 },
  vehicles: [{ make: "Mercedes-Benz", model: "EQS SUV", variant: "580 4MATIC Long Range Edition", year_from: 2023, is_primary: true }],
}));
const MODELS = Array.from({ length: 30 }, (_, i) => ({
  id: `m${i}`, make: i % 2 ? "BYD" : "Mercedes-Benz", model: i % 2 ? `Seal ${i}` : `EQS SUV ${i}`, variant: i % 3 ? "580 4MATIC Long Range Edition" : null,
  year_from: 2022, year_to: i % 4 ? null : 2024, battery_kwh: "108.4", usable_battery_kwh: i % 2 ? "82.5" : null, max_ac_kw: "22.0", max_dc_kw: i % 5 ? "200.0" : "0",
  connectors: ["Type 2", "CCS"], efficiency_wh_per_km: 180, is_active: true, source: i % 3 ? "curated" : "wikidata", dc_charge_curve: null,
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
}));

// Chargers: every status, access, connector and city shape, a long unbroken name, Arabic.
const GOVS = [["TN-11", "Tunis"], ["TN-12", "Ariana"], ["TN-21", "Nabeul"], ["TN-51", "Sousse"], ["TN-61", "Sfax"], ["TN-82", "Médenine"]]
  .map(([code, name_fr]) => ({ code, name_fr, name_ar: "", name_en: name_fr }));
const CITIES = [
  { id: uuid("c", 1), slug: "la-marsa", governorate_code: "TN-11", name_fr: "La Marsa", name_ar: "المرسى", name_en: "La Marsa" },
  { id: uuid("c", 2), slug: "hammamet", governorate_code: "TN-21", name_fr: "Hammamet", name_ar: "الحمامات", name_en: "Hammamet" },
  { id: uuid("c", 3), slug: "sousse", governorate_code: "TN-51", name_fr: "Sousse", name_ar: "سوسة", name_en: "Sousse" },
  { id: uuid("c", 4), slug: "sfax", governorate_code: "TN-61", name_fr: "Sfax", name_ar: "صفاقس", name_en: "Sfax" },
];
const CONNS = [
  [{ type: "Type 2", power_kw: 22, count: 2 }],
  [{ type: "CCS", power_kw: 60, count: 1 }, { type: "Type 2", power_kw: 22, count: 1 }],
  [{ type: "CCS", power_kw: 150, count: 2 }],
  [{ type: "CHAdeMO", power_kw: 50, count: 1 }, { type: "CCS", power_kw: 50, count: 1 }],
  [],
];
const WEEK = (from, to) => Object.fromEntries(["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => [d, [{ from, to }]]));
const CHARGERS = Array.from({ length: 30 }, (_, k) => {
  const i = k + 1;
  const city = i % 7 === 0 ? null : CITIES[i % CITIES.length];
  const gov = GOVS.find((g) => g.code === city?.governorate_code);
  return {
    id: uuid("e", i),
    name: i === 2 ? "StationDeRechargeUltraRapideAutorouteA1SortieHammametSudNumeroDeux" : i === 3 ? "محطة شحن المرسى الكبرى" : `Borne ${String(i).padStart(2, "0")} ${["Shell", "Total", "Agil", "Ennakl", "Carrefour", "Hôtel"][i % 6]}`,
    name_ar: "", name_fr: "", latitude: 33 + (i % 10) * 0.4, longitude: 9 + (i % 5) * 0.4,
    address: i % 3 ? `Avenue ${i}` : "", address_ar: i === 3 ? "شارع الحبيب بورقيبة، المرسى، تونس العاصمة، قرب محطة القطار" : "",
    city: city ? city.name_fr : "Nabeul", city_id: city ? city.id : null, highway_direction: null, operator: "",
    status: ["operational", "operational", "operational", "under_repair", "planned", "unknown"][i % 6],
    source: ["ocm", "curated", "community"][i % 3], ocm_id: i % 3 === 0 ? 300000 + i : null,
    access_type: ["public", "public", "customers_only", "brand_exclusive", "employees_only"][i % 5], connectors: CONNS[i % CONNS.length],
    working_hours: i % 2 ? { weekly: WEEK("00:00", "24:00") } : i % 4 === 0 ? { weekly: { ...WEEK("08:00", "18:00"), sun: [] } } : null,
    exclusive_to: [], amenities: i % 5 === 0 ? ["wifi", "cafe"] : [], photos: [], contact_id: null, contact_phone: null,
    is_verified: i % 3 === 0, verified_by: i % 3 === 0 ? "ala" : null, verified_at: i % 3 === 0 ? "2026-09-17T12:00:00Z" : null,
    manual_overrides: {}, created_at: "2026-04-01T12:00:00Z", updated_at: iso(NOW.getTime() - i * 2 * DAY),
    city_fr: city?.name_fr ?? null, city_ar: city?.name_ar ?? null, city_en: city?.name_en ?? null,
    governorate_code: gov?.code ?? null, governorate_fr: gov?.name_fr ?? null, governorate_ar: gov?.name_ar ?? null, governorate_en: gov?.name_en ?? null,
  };
});

// Community: open requests, design votes, submissions, review reports, visits, ratings.
const fb = (n, category, message, at, extra = {}) => ({
  id: uuid("f", n), device_id: "d", category, message, vote: null, email: "", app_version: "1.3.0", platform: "android", locale: "fr",
  resolved: false, resolved_at: null, resolved_by: null, created_at: at, ...extra,
});
const FEEDBACK = [
  fb(1, "bug", "L'appli plante quand je planifie un trajet vers Sfax.\nÀ chaque fois.", "2026-11-01T20:05:59Z", { email: "driver@example.tn" }),
  fb(2, "suggestion", "Ajouter les bornes Tesla", "2026-10-30T10:00:00Z", { platform: "ios" }),
  fb(3, "charger_data", "محطة توتال البحيرة معطلة منذ أسبوع", "2026-10-25T10:00:00Z", { locale: "ar" }),
  fb(4, "compliment", "Merci !", "2026-10-01T10:00:00Z", { resolved: true, resolved_at: "2026-10-02T10:00:00Z", resolved_by: "admin@charj.tn" }),
  ...Array.from({ length: 12 }, (_, i) => fb(100 + i, "design", i === 0 ? "Magnifique, enfin lisible la nuit" : "", `2026-10-${String(10 + i).padStart(2, "0")}T09:00:00Z`, { vote: i < 8 ? "up" : "down", platform: "" })),
];
const SUBMISSIONS = [
  { id: uuid("5", 1), name: "Borne Lac 2", lat: 36.8321, lng: 10.2345, notes: "Au parking du centre commercial,\nniveau -1", status: "pending" },
  { id: uuid("5", 2), name: "Hôtel Mouradi Gammarth", lat: 36.92, lng: 10.29, notes: "", status: "pending" },
  { id: uuid("5", 3), name: "Shell Sfax", lat: 34.74, lng: 10.76, notes: "", status: "approved", reviewed_at: "2026-10-20T08:00:00+00:00", reviewed_by: "admin@charj.tn", review_note: "Checked on Maps", charger_id: uuid("e", 4) },
].map((s, i) => ({
  submitted_by: "2c3e4f5a-aaaa-4bbb-8ccc-dddddddddddd", address: "Rue du Lac Léman", connectors: [{ type: "Type 2", power_kw: 22, count: 2 }], photos: [],
  reviewed_at: null, reviewed_by: null, review_note: null, charger_id: null, app_version: "1.3.0", created_at: iso(NOW.getTime() - (i + 1) * DAY), ...s,
}));
const REPORTS = [
  { id: uuid("d", 1), reason: "spam", notes: "Il fait de la pub pour son garage", created_at: "2026-11-01T22:00:00+00:00", resolved: false, rating: { id: "g1", rating: 1, comment: "Visitez mon garage www.example.tn", created_at: "2026-11-01T21:00:00+00:00", charger_id: uuid("e", 1), charger_name: "Shell Hammamet" } },
  { id: uuid("d", 2), reason: "other", notes: "", created_at: "2026-10-01T10:00:00+00:00", resolved: true, rating: null },
];
const VISITS = [
  ["Carrefour Marsa", "could_not_charge", "2026-11-01", { reason: "not_working" }],
  ["Total Lac", "could_not_charge", "2026-10-31", { reason: "occupied", connector_type: null }],
  ["Shell Hammamet", "charged", "2026-10-28", {}],
  ["Agil Sousse", "could_not_charge", "2026-09-01", { reason: "not_working", hidden_at: "2026-09-02T08:00:00Z", hidden_reason: "Test report" }],
].map(([charger_name, outcome, visit_date, extra], i) => ({
  id: uuid("b", i + 1), charger_id: uuid("e", 1), charger_name, charger_city: "La Marsa", user_id: USERS[i].id, outcome, reason: null,
  connector_type: "CCS", visit_date, submitted_at: `${visit_date}T19:32:16+00:00`, hidden_at: null, hidden_reason: null, ...extra,
}));
const RATINGS = [
  { id: "g1", charger_id: uuid("e", 1), rater: "9f8e7d6c-1111", rating: 5, comment: "Rapide et propre", created_at: "2026-11-01T12:00:00Z" },
  { id: "g2", charger_id: uuid("e", 2), rater: "1a2b3c4d-2222", rating: 2, comment: "", created_at: "2026-10-28T12:00:00Z" },
];

// Notifications: one of everything.
const TUNIS = { governorate_code: "TN-11", governorate_name_fr: "Tunis", governorate_name_ar: "تونس", governorate_name_en: "Tunis" };
const NOTIFICATIONS = {
  pending: [{
    event_id: uuid("7", 1), kind: "charger_added", update_class: null, reason: "new_charger", state: "held", note: "needs_review", needs_review: true,
    charger_id: uuid("e", 5), charger_name: "Borne 05 Hôtel", ...TUNIS, queued_at: iso(NOW.getTime() - 7 * 60_000),
    release_at: iso(NOW.getTime() + 23 * 60_000), requested_by: null, eta: iso(NOW.getTime() + 23 * 60_000),
  }],
  suggestions: [{
    update_event_id: uuid("8", 1), charger_id: uuid("e", 6), charger_name: "Borne 06 Shell", occurred_at: iso(NOW.getTime() - 3 * 3_600_000),
    changed_fields: ["status"], before: { status: "under_repair" }, after: { status: "operational" }, update_class: "back_in_service",
    ...TUNIS, recipient_estimate: 12, push_estimate: 7,
  }],
  history: Array.from({ length: 12 }, (_, i) => ({
    batch_id: uuid("9", i), source: i % 3 ? "auto" : "admin", status: i === 2 ? "failed" : "sent", claimed_at: iso(NOW.getTime() - (i + 1) * DAY),
    sent_at: i === 2 ? null : iso(NOW.getTime() - (i + 1) * DAY + 5000), recipient_count: i === 1 ? 0 : 40, device_count: 44, ticket_ok: 43,
    ticket_error: 1, receipt_ok: 42, receipt_error: 0, opens: i === 1 ? 0 : 10, event_count: 2,
  })),
  subscribers: [
    { governorate_code: "TN-11", name_fr: "Tunis", name_ar: "تونس", name_en: "Tunis", followers: 40, followers_with_push: 25 },
    { governorate_code: "TN-21", name_fr: "Nabeul", name_ar: "نابل", name_en: "Nabeul", followers: 18, followers_with_push: 6 },
  ],
  totals: { region_followers: 50, region_follows: 58, active_devices: 33, users_with_push: 31, pending: 1, suggestions: 1, batches: 12, announcements_24h: 2, quiet_now: false },
  funnel: { region_prompt_shown: 100, region_prompt_accepted: 40, permission_granted: 30, regions_updated: 35 },
  server_time: iso(NOW.getTime()),
};

// ---- the in-memory functions ----
const pageOf = (p, rows) => {
  const page = Number(p.get("page") ?? 1);
  const per = Number(p.get("perPage") ?? 25);
  return { items: rows.slice((page - 1) * per, page * per), page, perPage: per, total: rows.length };
};
const answer = (name, url) => {
  const p = url.searchParams;
  if (name === "admin-usage") {
    const env = p.get("environment") ?? "production";
    return p.get("view") === "usage" ? usage(env, Number(p.get("days") ?? 30)) : summary(env);
  }
  if (name === "admin-feedback") {
    const status = p.get("status") ?? "open";
    const category = p.get("category") ?? "all";
    let rows = FEEDBACK.filter((f) => status === "all" || f.resolved === (status === "resolved"));
    if (category === "requests") rows = rows.filter((f) => f.category !== "design");
    else if (category !== "all") rows = rows.filter((f) => f.category === category);
    const open = FEEDBACK.filter((f) => !f.resolved);
    return {
      ...pageOf(p, rows),
      summary: {
        total: FEEDBACK.length, open: open.length, open_requests: open.filter((f) => f.category !== "design").length,
        resolved: FEEDBACK.length - open.length, last_7_days: FEEDBACK.filter((f) => Date.parse(f.created_at) >= NOW.getTime() - 7 * DAY).length,
        by_category: Object.fromEntries(["bug", "suggestion", "charger_data", "compliment", "other", "design"].map((c) => [c, FEEDBACK.filter((f) => f.category === c).length])),
      },
    };
  }
  if (name === "admin-confirmations") {
    const outcome = p.get("outcome") ?? "all";
    const visibility = p.get("visibility") ?? "visible";
    const sinceDays = p.get("since_days");
    const since = sinceDays ? isoDay(NOW.getTime() - Number(sinceDays) * DAY) : null;
    const rows = VISITS.filter((v) => (outcome === "all" || v.outcome === outcome)
      && (visibility === "all" || (visibility === "hidden") === (v.hidden_at !== null))
      && (!since || v.visit_date >= since));
    const s = {
      total: VISITS.length, charged: VISITS.filter((v) => v.outcome === "charged").length,
      could_not_charge: VISITS.filter((v) => v.outcome === "could_not_charge").length, hidden: VISITS.filter((v) => v.hidden_at).length,
      last_7_days: VISITS.filter((v) => v.visit_date >= isoDay(NOW.getTime() - 7 * DAY)).length, contributors: new Set(VISITS.map((v) => v.user_id)).size,
    };
    const windowCount = since ? VISITS.filter((v) => v.outcome === "could_not_charge" && !v.hidden_at && v.visit_date >= since).length : null;
    return { ...pageOf(p, rows), summary: since ? { ...s, window: { since_days: Number(sinceDays), could_not_charge: windowCount } } : s };
  }
  if (name === "admin-submissions") {
    const status = p.get("status") ?? "pending";
    const rows = SUBMISSIONS.filter((s) => status === "all" || s.status === status);
    const counts = Object.fromEntries(["pending", "approved", "rejected"].map((k) => [k, SUBMISSIONS.filter((s) => s.status === k).length]));
    return { ...pageOf(p, rows), counts };
  }
  if (name === "admin-review-reports") {
    const status = p.get("status") ?? "open";
    const rows = REPORTS.filter((r) => status === "all" || r.resolved === (status === "resolved"));
    return { ...pageOf(p, rows), open: REPORTS.filter((r) => !r.resolved).length };
  }
  if (name === "admin-notifications") {
    const charger = p.get("charger_id");
    if (!charger) return NOTIFICATIONS;
    const own = (r) => r.charger_id === charger;
    return { ...NOTIFICATIONS, pending: NOTIFICATIONS.pending.filter(own), suggestions: NOTIFICATIONS.suggestions.filter(own), history: [], charger_id: charger };
  }
  if (name === "admin-users") {
    const lookup = p.get("user");
    const list = lookup ? USERS.filter((u) => u.id === lookup) : p.get("filter") === "engaged" ? USERS.filter((u) => u.visits_count > 0) : USERS;
    const page = Number(p.get("page") ?? 1), perPage = Number(p.get("perPage") ?? 25);
    return { users: list.slice((page - 1) * perPage, page * perPage), page, perPage, total: list.length };
  }
  return null;
};
const table = (path) => {
  if (path.endsWith("/rpc/search_chargers")) return CHARGERS;
  if (path.endsWith("/governorates")) return GOVS;
  if (path.endsWith("/cities")) return CITIES;
  if (path.endsWith("/ratings")) return RATINGS;
  if (path.endsWith("/chargers")) return CHARGERS.map(({ id, name }) => ({ id, name }));
  if (path.endsWith("/ev_models")) return MODELS;
  return null;
};

// ---- the views ----
const VIEWS = [
  "#/summary",
  "#/usage",
  ...["activity", "coming-back", "languages", "screens", "actions", "funnels", "cars", "routes", "android-auto", "users"].map((s) => `#/usage?section=${s}`),
  ...["feedback", "submissions", "reviews", "visits"].map((t) => `#/community?tab=${t}`),
  "#/chargers",
  "#/chargers?view=map",
  "#/chargers?view=stats",
  "#/notifications",
  "#/settings",
];
// One shot per page (390 light, 1440 dark), named after its route.
const SHOT_VIEWS = new Map([["#/summary", "summary"], ["#/usage", "usage"], ["#/community?tab=feedback", "community"], ["#/chargers", "chargers"], ["#/notifications", "notifications"], ["#/settings", "settings"]]);

// ---- harness ----
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || "chrome" });
let checks = 0;
const ok = (cond, msg, extra) => { assert.ok(cond, extra === undefined ? msg : `${msg}: ${JSON.stringify(extra)}`); checks += 1; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks += 1; };
const SESSION = JSON.stringify({
  access_token: "test.admin.session", refresh_token: "test-refresh", token_type: "bearer", expires_in: 3600, expires_at: 4102444800,
  user: { id: "a0000000-0000-4000-8000-000000000001", email: "admin@charj.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
});
const MAPS = /^https:\/\/maps\.googleapis\.com\//;
// The Maps loader's own module (Vite serves it from its dependency cache). Its
// "failed to load" message is logged through Vite's client, so the loader's URL
// is in the message's stack rather than in its location.
const MAPS_LOADER = /\/node_modules\/\.vite\/deps\/@vis_+gl_react-google-maps\.js/;

const open = async ({ width, height, colorScheme, rtl = false }) => {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme });
  await context.clock.setFixedTime(NOW);
  // The theme follows the system (no stored choice), so colorScheme is the theme.
  await context.addInitScript((session) => {
    if (location.protocol === "about:") return; // the blank page between views has no storage
    localStorage.setItem("charj-admin-auth", session);
    localStorage.removeItem("charj-admin:tweaks");
  }, SESSION);
  if (rtl) await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => { document.documentElement.dir = "rtl"; }));
  const unanswered = [];
  await context.route("**/auth/v1/**", (route) => route.abort());
  await context.route(MAPS, (route) => route.abort());
  await context.route("**/rest/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    const rows = table(path);
    if (rows === null) unanswered.push(path);
    return route.fulfill({ json: rows ?? [], headers: { "content-range": `0-${Math.max(0, (rows?.length ?? 0) - 1)}/${rows?.length ?? 0}` } });
  });
  await context.route("**/functions/v1/**", (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    const url = new URL(request.url());
    const name = url.pathname.split("/").pop();
    const body = request.method() === "GET" ? answer(name, url) : null;
    if (body === null) {
      unanswered.push(`${request.method()} ${name}${url.search}`);
      return route.fulfill({ status: 500, json: { error: "not mocked" } });
    }
    return route.fulfill({ json: body });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    const url = m.location()?.url ?? "";
    if (/Failed to load resource/.test(text) && MAPS.test(url)) return;
    if (/^The Google Maps JavaScript API (failed to load|could not load)/.test(text) && (MAPS_LOADER.test(url) || MAPS_LOADER.test(text))) return;
    errors.push(`${text} (${url})`);
  });
  return { context, page, errors, unanswered };
};

// WCAG contrast of an element's text against what is really behind it (alpha composed up the tree).
const contrastOf = (page, selector) => page.evaluate((sel) => {
  const el = [...document.querySelectorAll(sel)].find((e) => e.getClientRects().length);
  if (!el) return null;
  const parse = (c) => (c.match(/[\d.]+/g) ?? []).map(Number);
  const over = (top, under) => {
    const a = top[3] ?? 1;
    return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a)).concat(1);
  };
  const layers = [];
  for (let n = el; n; n = n.parentElement) {
    const bg = parse(getComputedStyle(n).backgroundColor);
    if (bg.length && (bg[3] ?? 1) > 0) layers.push(bg);
    if (bg.length === 3 || (bg[3] ?? 0) === 1) break;
  }
  let behind = document.documentElement.dataset.theme === "dark" ? [0, 0, 0, 1] : [255, 255, 255, 1];
  for (const layer of layers.reverse()) behind = over(layer, behind);
  const fg = over(parse(getComputedStyle(el).color), behind);
  const lum = ([r, g, b]) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const [a, b] = [lum(fg), lum(behind)].sort((x, y) => y - x);
  return +((a + 0.05) / (b + 0.05)).toFixed(2);
}, selector);

/** Load a view fresh and wait until every card has its data. */
const load = async (page, hash) => {
  await page.goto("about:blank");
  await page.goto(`${base}/${hash}`);
  await page.locator(".ui-lt h1").waitFor();
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]') && !/Loading…|Refreshing…|Checking for chargers/.test(document.body.innerText), null, { timeout: 15_000 })
    .catch(() => {});
  // Rings fill and cards rise; the tooltip of a stray hover would cover text.
  await page.mouse.move(1, 1);
  await page.waitForTimeout(700);
};

const inspect = (page) => page.evaluate(() => {
  const main = document.querySelector(".shell-main");
  const doc = document.documentElement;
  const words = [document.body.textContent ?? ""];
  for (const el of document.querySelectorAll("[aria-label], [title], [alt], [placeholder]")) {
    for (const a of ["aria-label", "title", "alt", "placeholder"]) if (el.hasAttribute(a)) words.push(el.getAttribute(a));
  }
  const bad = words.join("\n").match(/.{0,30}\b(NaN|Infinity)\b.{0,30}/);
  const h1 = document.querySelector(".ui-lt h1");
  const alerts = [...document.querySelectorAll('[role="alert"]')].filter((e) => e.getClientRects().length).map((e) => e.textContent.trim().slice(0, 120));
  return {
    mainOver: main ? main.scrollWidth - main.clientWidth : null,
    docOver: doc.scrollWidth - doc.clientWidth,
    bad: bad ? bad[0] : null,
    title: h1 && h1.getClientRects().length ? h1.textContent.trim() : "",
    loading: /Loading…/.test(document.body.innerText),
    alerts,
  };
});

const COMBOS = [
  ...["light", "dark"].flatMap((colorScheme) => [[375, 812], [768, 1024], [1440, 900]].map(([width, height]) => ({ width, height, colorScheme }))),
  { width: 375, height: 812, colorScheme: "light", rtl: true },
];
// Screenshot runs: the phone at 390 light and the desktop at 1440 dark.
if (shots) COMBOS.push({ width: 390, height: 844, colorScheme: "light", shotsOnly: true });

for (const combo of COMBOS) {
  const tag = `${combo.width} ${combo.colorScheme}${combo.rtl ? " rtl" : ""}`;
  const { context, page, errors, unanswered } = await open(combo);
  const views = combo.shotsOnly ? [...SHOT_VIEWS.keys()] : VIEWS;
  const folded = [];
  for (const hash of views) {
    const at = `${tag} ${hash}`;
    errors.length = 0;
    await load(page, hash);
    const shotName = SHOT_VIEWS.get(hash);
    if (shots && shotName && ((combo.width === 390 && combo.colorScheme === "light") || (combo.width === 1440 && combo.colorScheme === "dark"))) {
      const full = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, innerHeight));
      await page.setViewportSize({ width: combo.width, height: Math.min(full, 6000) });
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${shots}/t12-${shotName}-${combo.width}-${combo.colorScheme}.png` });
      await page.setViewportSize({ width: combo.width, height: combo.height });
    }
    if (combo.shotsOnly) continue;
    const r = await inspect(page);
    ok(r.mainOver !== null && r.mainOver <= 0, `${at}: main doesn't scroll sideways`, r.mainOver);
    ok(r.docOver <= 0, `${at}: the page doesn't scroll sideways`, r.docOver);
    eq(r.bad, null, `${at}: no NaN or Infinity in any text or label`);
    ok(r.title.length > 0, `${at}: the large title is there`, r.title);
    ok(!r.loading, `${at}: nothing is still loading`);
    eq(r.alerts, [], `${at}: no error line`);
    // The folded title: on a short window every view scrolls; the pinned bar
    // must span the whole main area (the padding however wide, the map view too).
    await page.setViewportSize({ width: combo.width, height: 480 });
    const pinned = await page.evaluate(async () => {
      const room = document.documentElement.scrollHeight - innerHeight;
      scrollTo(0, Math.min(room, 700));
      await new Promise((r) => setTimeout(r, 350));
      const el = document.querySelector(".ui-lt-bar");
      const bar = el.getBoundingClientRect();
      const main = document.querySelector(".shell-main").getBoundingClientRect();
      const result = { room, on: el.dataset.on, top: Math.round(bar.top), start: Math.round(bar.left - main.left), end: Math.round(main.right - bar.right) };
      scrollTo(0, 0);
      return result;
    });
    await page.setViewportSize({ width: combo.width, height: combo.height });
    if (pinned.room > 160) {
      ok(pinned.on === "true" && pinned.top === 0 && Math.abs(pinned.start) <= 1 && Math.abs(pinned.end) <= 1, `${at}: the folded title bar spans the main area`, pinned);
      folded.push(hash);
    }
    const nav = combo.width >= 768 ? ".ui-side .ui-nav-badge" : ".ui-tabs .ui-nav-badge";
    const ratio = await contrastOf(page, nav);
    ok(ratio !== null && ratio >= 4.5, `${at}: the nav badge reads at 4.5:1 or more`, ratio);
    eq(errors, [], `${at}: no console or page errors`);
  }
  eq(unanswered, [], `${tag}: every read was answered by the mock`);
  // Short pages (Settings on a desktop) can't scroll the title away; the wide map view must be among the checked.
  if (!combo.shotsOnly) ok(folded.length >= views.length / 2 && folded.includes("#/chargers?view=map"), `${tag}: the folded bar was checked on most views, the map view included`, views.filter((v) => !folded.includes(v)));
  console.log(`PASS ${tag}: ${views.length} views${combo.shotsOnly ? " (screenshots)" : `; the folded bar checked on ${folded.length} (too short to scroll: ${views.filter((v) => !folded.includes(v)).join(", ") || "none"})`}`);
  await context.close();
}

await browser.close();
console.log(`\n${checks} checks passed${shots ? `. Screenshots in ${shots}` : ""}`);
