// Community (the queue page) on mocked admin functions, headless.
// Run against a local Vite server started with fake Supabase values, e.g.
//   VITE_SUPABASE_URL=https://fake.supabase.test VITE_SUPABASE_ANON_KEY=fake \
//     npx vite --port 5181 --strictPort &
//   COMMUNITY_URL=http://localhost:5181 PLAYWRIGHT_MODULE=<…>/playwright/index.mjs \
//     node tests/community.browser.mjs
// Every admin function is a small in-memory server (shapes from the Task 3 /
// Task 4 reports and admin-feedback HEAD), so actions change what the next
// read returns: the queue, the badges and the lists stay in step. All
// Supabase traffic is intercepted; this suite never reaches a real backend.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.COMMUNITY_URL || "http://localhost:5181";
const output = process.env.COMMUNITY_ARTIFACTS || "/tmp/charj-community-browser";
await mkdir(output, { recursive: true });

const NOW = new Date("2026-11-02T10:00:00Z");
const isoDaysAgo = (n) => {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};
const uuid = (prefix, n) => `${prefix}0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CATS = ["bug", "suggestion", "compliment", "charger_data", "other", "design"];

// ---- fixtures ----
const fb = (n, category, message, at, extra = {}) => ({
  id: uuid("f", n), device_id: "d", category, message, vote: null, email: "", app_version: "1.3.0", platform: "android", locale: "fr",
  resolved: false, resolved_at: null, resolved_by: null, created_at: at, ...extra,
});
const vote = (n, v, at, extra = {}) => fb(100 + n, "design", "", at, { vote: v, platform: "", ...extra });
const requests = () => [
  fb(1, "bug", "L'appli plante quand je planifie un trajet vers Sfax.\nÀ chaque fois.", "2026-11-01T20:05:59Z", { email: "driver@example.tn" }),
  fb(2, "suggestion", "Ajouter les bornes Tesla", "2026-10-30T10:00:00Z", { platform: "ios", app_version: "1.2.1" }),
  fb(3, "charger_data", "محطة توتال البحيرة معطلة منذ أسبوع", "2026-10-25T10:00:00Z", { locale: "ar" }),
  fb(4, "compliment", "Merci !", "2026-10-01T10:00:00Z", { resolved: true, resolved_at: "2026-10-02T10:00:00Z", resolved_by: "admin@charj.tn" }),
];
// Five votes (3 up, 2 down) with platforms: under 10, counts only.
const fewVotes = () => [
  vote(1, "up", "2026-11-02T08:00:00Z", { message: "Magnifique, enfin lisible la nuit", platform: "ios" }),
  vote(2, "down", "2026-11-02T07:00:00Z", { message: "Trop sombre pour moi", platform: "android", locale: "ar" }),
  vote(3, "up", "2026-11-01T09:00:00Z", { platform: "android" }),
  vote(4, "up", "2026-10-31T09:00:00Z", { platform: "android" }),
  vote(5, "down", "2026-10-30T09:00:00Z", { platform: "ios" }),
];
// Twelve votes (8 up, 4 down), no platform: a share with its count, no split.
const manyVotes = () => Array.from({ length: 12 }, (_, i) => vote(10 + i, i < 8 ? "up" : "down", `2026-10-${String(10 + i).padStart(2, "0")}T09:00:00Z`, { message: i === 0 ? "J'adore" : "" }));

const S1 = uuid("5", 1), S2 = uuid("5", 2), S3 = uuid("5", 3), S4 = uuid("5", 4);
const NEW = uuid("c", 900);
const SHELL = uuid("c", 1), FAR = uuid("c", 2);
const sub = (id, name, lat, lng, extra = {}) => ({
  id, submitted_by: "2c3e4f5a-aaaa-4bbb-8ccc-dddddddddddd", name, address: "", connectors: [{ type: "Type 2", power_kw: 22, count: 2 }],
  photos: [], notes: "", status: "pending", reviewed_at: null, reviewed_by: null, review_note: null, charger_id: null, app_version: "1.3.0",
  created_at: "2026-11-01T08:00:00+00:00", lat, lng, ...extra,
});
const submissions = () => [
  sub(S1, "Borne Lac 2", 36.8321, 10.2345, { notes: "Au parking du centre commercial,\nniveau -1", address: "Rue du Lac Léman", connectors: [{ type: "Type 2", power_kw: 22, count: 2 }, { type: "CCS", power_kw: 60, count: 1 }] }),
  sub(S2, "Hôtel Mouradi Gammarth", 36.92, 10.29, { created_at: "2026-10-31T08:00:00+00:00" }),
  sub(S3, "Station Agil Sousse", 35.83, 10.6, { created_at: "2026-10-30T08:00:00+00:00", connectors: "type2 x2" }),
  sub(S4, "Shell Sfax", 34.74, 10.76, { status: "approved", reviewed_at: "2026-10-20T08:00:00+00:00", reviewed_by: "admin@charj.tn", review_note: "Checked on Maps", charger_id: FAR, created_at: "2026-10-19T08:00:00+00:00" }),
];
const chargerRow = (id, name, lat, lng) => ({
  id, ocm_id: null, name, name_ar: "", name_fr: name, latitude: lat, longitude: lng, address: "", address_ar: "", city: "Tunis", city_id: null,
  highway_direction: null, connectors: [{ type: "Type 2", power_kw: 22, count: 2 }], operator: "", status: "operational", photos: [],
  source: "community", is_verified: false, verified_by: null, working_hours: null, access_type: "public", exclusive_to: [], amenities: [],
  contact_phone: null, created_at: "2026-04-01T12:00:00Z", updated_at: "2026-11-02T10:00:00.000000Z",
  city_fr: null, city_ar: null, city_en: null, governorate_code: null, governorate_fr: null, governorate_ar: null, governorate_en: null,
});
// Shell Lac sits 22 m north of Borne Lac 2: the nearby check must flag it.
const chargers = () => [chargerRow(SHELL, "Shell Lac", 36.8323, 10.2345), chargerRow(FAR, "Shell Sfax", 34.74, 10.76)];
const editorRow = (row) => ({ ...row, contact_id: null, verified_at: null, manual_overrides: {} });

const R1 = uuid("e", 1), R2 = uuid("e", 2), R3 = uuid("e", 3);
const reports = () => [
  { id: R1, reason: "spam", notes: "Il fait de la pub pour son garage", created_at: "2026-11-01T22:00:00+00:00", resolved: false, rating: { id: "g1", rating: 1, comment: "Visitez mon garage www.example.tn", created_at: "2026-11-01T21:00:00+00:00", charger_id: SHELL, charger_name: "Shell Hammamet" } },
  { id: R2, reason: "personal_info", notes: "", created_at: "2026-10-30T10:00:00+00:00", resolved: false, rating: { id: "g2", rating: 4, comment: "", created_at: "2026-10-29T10:00:00+00:00", charger_id: FAR, charger_name: "Total Lac" } },
  { id: R3, reason: "other", notes: "", created_at: "2026-10-01T10:00:00+00:00", resolved: true, rating: null },
];
const U1 = uuid("a", 11), U2 = uuid("a", 12);
const V1 = uuid("b", 1), V2 = uuid("b", 2), V3 = uuid("b", 3), V4 = uuid("b", 4);
const visit = (id, name, outcome, visit_date, extra = {}) => ({
  id, charger_id: SHELL, charger_name: name, charger_city: "La Marsa", user_id: U1, outcome, reason: outcome === "charged" ? null : "not_working",
  connector_type: "CCS", visit_date, submitted_at: `${visit_date}T19:32:16+00:00`, hidden_at: null, hidden_reason: null, ...extra,
});
const visits = () => [
  visit(V1, "Carrefour Marsa", "could_not_charge", "2026-11-01"),
  visit(V2, "Total Lac", "could_not_charge", "2026-10-31", { reason: "occupied", user_id: U2, connector_type: null }),
  visit(V3, "Shell Hammamet", "charged", "2026-10-28"),
  visit(V4, "Agil Sousse", "could_not_charge", "2026-09-01", { hidden_at: "2026-09-02T08:00:00Z", hidden_reason: "Test report" }),
];
const ratings = () => [
  { id: "g1", charger_id: SHELL, rater: "9f8e7d6c-1111", rating: 5, comment: "Rapide et propre", created_at: "2026-11-01T12:00:00Z" },
  { id: "g2", charger_id: FAR, rater: "1a2b3c4d-2222", rating: 2, comment: "", created_at: "2026-10-28T12:00:00Z" },
];

const state = (over = {}) => ({
  feedback: [...requests(), ...fewVotes()],
  feedbackDeployed: true,
  submissions: submissions(),
  chargers: chargers(),
  reports: reports(),
  visits: visits(),
  ratings: ratings(),
  reviewAnswer: null, // (body, S) => [status, json] | null — a one-off answer for a POST
  posts: [],
  ...over,
});

// ---- the in-memory admin functions ----
const handle = (name, method, url, body, S) => {
  const p = url.searchParams;
  const page = Number(p.get("page") ?? 1);
  const per = Number(p.get("perPage") ?? 25);
  const slice = (rows) => rows.slice((page - 1) * per, page * per);
  const newest = (key) => (a, b) => b[key].localeCompare(a[key]);
  if (name === "admin-feedback") {
    if (method === "POST") {
      const row = S.feedback.find((f) => f.id === body.id);
      if (!row) return [404, { error: "feedback_not_found" }];
      Object.assign(row, { resolved: body.resolved, resolved_at: body.resolved ? NOW.toISOString() : null, resolved_by: body.resolved ? "admin@charj.test" : null });
      return [200, { ok: true, item: row }];
    }
    const status = p.get("status") ?? "open";
    const category = p.get("category") ?? "all";
    // Before 4ca3ed2 is deployed the function knows no `requests` and sends no open_requests.
    if (category === "requests" && !S.feedbackDeployed) return [400, { error: "invalid_request" }];
    let rows = S.feedback.filter((f) => status === "all" || f.resolved === (status === "resolved"));
    if (category === "requests") rows = rows.filter((f) => f.category !== "design");
    else if (category !== "all") rows = rows.filter((f) => f.category === category);
    rows = [...rows].sort(newest("created_at"));
    const all = S.feedback;
    const summary = {
      total: all.length,
      open: all.filter((f) => !f.resolved).length,
      resolved: all.filter((f) => f.resolved).length,
      last_7_days: all.filter((f) => Date.parse(f.created_at) >= NOW.getTime() - 7 * 86_400_000).length,
      by_category: Object.fromEntries(CATS.map((c) => [c, all.filter((f) => f.category === c).length])),
    };
    if (S.feedbackDeployed) summary.open_requests = all.filter((f) => !f.resolved && f.category !== "design").length;
    return [200, { items: slice(rows), page, perPage: per, total: rows.length, summary }];
  }
  if (name === "admin-submissions") {
    if (method === "POST") {
      S.posts.push({ name, body });
      const once = S.reviewAnswer?.(body, S);
      if (once) return once;
      const row = S.submissions.find((s) => s.id === body.id);
      if (!row) return [404, { error: "submission_not_found" }];
      if (row.status !== "pending") return [409, { error: "already_reviewed" }];
      const approve = body.action === "approve";
      Object.assign(row, { status: approve ? "approved" : "rejected", reviewed_at: NOW.toISOString(), reviewed_by: "admin@charj.test", review_note: body.note ?? null, charger_id: approve ? NEW : null });
      if (approve) S.chargers.push({ ...chargerRow(NEW, row.name, row.lat, row.lng), name_ar: body.name_ar ?? "", operator: body.operator ?? "" });
      return [200, { ok: true, submission_id: row.id, status: row.status, charger_id: row.charger_id }];
    }
    const status = p.get("status") ?? "pending";
    const rows = S.submissions.filter((s) => status === "all" || s.status === status).sort(newest("created_at"));
    const counts = Object.fromEntries(["pending", "approved", "rejected"].map((k) => [k, S.submissions.filter((s) => s.status === k).length]));
    return [200, { items: slice(rows), page, perPage: per, total: rows.length, counts }];
  }
  if (name === "admin-review-reports") {
    if (method === "POST") {
      S.posts.push({ name, body });
      const row = S.reports.find((r) => r.id === body.id);
      if (!row) return [404, { error: "report_not_found" }];
      row.resolved = body.resolved;
      return [200, { ok: true, item: row }];
    }
    const status = p.get("status") ?? "open";
    const rows = S.reports.filter((r) => status === "all" || r.resolved === (status === "resolved")).sort(newest("created_at"));
    return [200, { items: slice(rows), page, perPage: per, total: rows.length, open: S.reports.filter((r) => !r.resolved).length }];
  }
  if (name === "admin-confirmations") {
    if (method === "POST") {
      S.posts.push({ name, body });
      const row = S.visits.find((v) => v.id === body.id);
      if (!row) return [500, { error: "not found" }];
      if (body.hidden && !body.reason) return [400, { error: "Hiding a report requires a reason of 1–500 characters." }];
      Object.assign(row, { hidden_at: body.hidden ? NOW.toISOString() : null, hidden_reason: body.hidden ? body.reason : null });
      return [200, { ok: true, report: row }];
    }
    const outcome = p.get("outcome") ?? "all";
    const visibility = p.get("visibility") ?? "visible";
    const since = p.get("since_days");
    const from = since ? isoDaysAgo(Number(since)) : null;
    const rows = S.visits
      .filter((v) => outcome === "all" || v.outcome === outcome)
      .filter((v) => (visibility === "visible" ? !v.hidden_at : visibility === "hidden" ? !!v.hidden_at : true))
      .filter((v) => !from || v.visit_date >= from)
      .sort(newest("visit_date"));
    const all = S.visits;
    const summary = {
      total: all.length,
      charged: all.filter((v) => v.outcome === "charged").length,
      could_not_charge: all.filter((v) => v.outcome === "could_not_charge").length,
      hidden: all.filter((v) => v.hidden_at).length,
      last_7_days: all.filter((v) => v.visit_date >= isoDaysAgo(6)).length,
      contributors: new Set(all.map((v) => v.user_id)).size,
    };
    if (from) summary.window = { since_days: Number(since), could_not_charge: all.filter((v) => v.outcome === "could_not_charge" && !v.hidden_at && v.visit_date >= from).length };
    return [200, { items: slice(rows), page, perPage: per, total: rows.length, summary }];
  }
  if (name === "admin-update-charger") {
    const row = S.chargers.find((c) => c.id === p.get("charger_id"));
    return row ? [200, editorRow(row)] : [404, { error: "not found" }];
  }
  return [200, {}];
};

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
const APP_PHOTO = (name) => `{SUPA}/storage/v1/object/public/charger-photos/${name}`;

// ---- harness ----
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || "chrome" });
let checks = 0;
const ok = (cond, msg, extra) => { assert.ok(cond, extra === undefined ? msg : `${msg}: ${JSON.stringify(extra)}`); checks += 1; console.log(`PASS ${msg}`); };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks += 1; console.log(`PASS ${msg}`); };
const errors = [];

const open = async ({ width = 390, height = 844, colorScheme = "light", S = state(), rtl = false, scale = 1, reducedMotion = "reduce" } = {}) => {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme, deviceScaleFactor: scale, reducedMotion });
  await context.clock.setFixedTime(NOW);
  await context.addInitScript(() => {
    localStorage.setItem("charj-admin-auth", JSON.stringify({
      access_token: "test.admin.session", refresh_token: "test-refresh", token_type: "bearer", expires_in: 3600, expires_at: 4102444800,
      user: { id: "a0000000-0000-4000-8000-000000000001", email: "admin@charj.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
    }));
    window.__hashes = [];
    window.addEventListener("hashchange", () => window.__hashes.push(location.hash));
  });
  if (rtl) await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => { document.documentElement.dir = "rtl"; }));
  await context.route("**/auth/v1/**", (route) => route.abort());
  await context.route("https://maps.googleapis.com/**", (route) => route.abort());
  await context.route("https://x.supabase.co/**", (route) => route.abort());
  const reads = [];
  await context.route("**/rest/v1/**", (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.split("/rest/v1/")[1];
    reads.push(path);
    if (path === "ratings" && S.ratingsFail) return route.fulfill({ status: 500, json: { message: "ratings unavailable", code: "XX000" } });
    const json = path === "rpc/search_chargers" ? S.chargers
      : path === "ratings" ? (S.ratingsFail ? null : S.ratings)
      : path === "chargers" ? S.chargers.map((c) => ({ id: c.id, name: c.name }))
      : [];
    return route.fulfill({ json, headers: { "content-range": `0-${json.length}/${json.length}` } });
  });
  const requests = [];
  await context.route("**/functions/v1/**", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    const url = new URL(request.url());
    const name = url.pathname.split("/").pop();
    requests.push(`${request.method() === "POST" ? "POST " : ""}${name}${url.search}`);
    assert.equal(request.headers().authorization, "Bearer test.admin.session");
    if (S.delay) await new Promise((r) => setTimeout(r, S.delay));
    if (S.postDelay && request.method() === "POST") await new Promise((r) => setTimeout(r, S.postDelay));
    const [status, json] = handle(name, request.method(), url, request.method() === "POST" ? request.postDataJSON() : null, S);
    // "{SUPA}" in a fixture is the project URL the dev server was started with (the app's own photo uploads).
    return route.fulfill({ status, json: JSON.parse(JSON.stringify(json).replaceAll("{SUPA}", url.origin)) });
  });
  // The app's own uploads: a 1×1 PNG. Every other photo host stays unrouted, so a request to one would show in `urls`.
  await context.route("**/storage/v1/object/public/charger-photos/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  const urls = [];
  context.on("request", (r) => urls.push(r.url()));
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  return { context, page, requests, reads, urls, S };
};

const hscroll = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const hashOf = (page) => page.evaluate(() => location.hash);
const tabs = (page) => page.$$eval(".com-tabs a", (as) => as.map((a) => ({
  label: a.querySelector("span").textContent,
  badge: a.querySelector(".com-badge")?.textContent ?? null,
  zero: !!a.querySelector(".com-badge-zero"),
  current: a.getAttribute("aria-current") === "page",
  href: a.getAttribute("href"),
})));
const navBadge = async (page) => {
  const sel = (await page.viewportSize()).width >= 768 ? ".ui-side .ui-nav-badge" : ".ui-tabs .ui-nav-badge";
  return (await page.locator(sel).count()) ? page.locator(sel).innerText() : null;
};
const stats = (page, card) => page.$$eval(`${card} .com-stats > div`, (ds) => ds.map((d) => `${d.querySelector("b").textContent} ${d.querySelector("span").textContent.trim()}`));
const items = (page, card) => page.locator(`${card} .com-list > .com-item`);
const selectIn = (page, card, label) => page.locator(`${card} .com-select`, { hasText: label }).locator("select");
const optionsOf = (page, card, label) => selectIn(page, card, label).locator("option").allInnerTexts();
const square = (page, card) => page.$eval(`${card} .ui-sq`, (q) => q.getAttribute("style") ?? "");
const ready = (page, card) => page.waitForFunction((c) => {
  const el = document.querySelector(c);
  return el && !el.querySelector("[aria-busy=true]");
}, card);
const queueSettled = (page) => page.waitForTimeout(250);
const count = (list, prefix) => list.filter((r) => r.startsWith(prefix)).length;
const shot = async (page, name) => {
  const { width, height } = page.viewportSize();
  await page.setViewportSize({ width, height: Math.max(height, await page.evaluate(() => document.documentElement.scrollHeight)) });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${output}/${name}` });
  await page.setViewportSize({ width, height });
};
// Copied from tests/summary.browser.mjs / usage.browser.mjs: no element pokes
// out of its card or the tab strip, no text is cut off (one-line ellipsis
// aside), no segmented label is clipped; plus the open dialog inside the viewport.
const fits = (page) => page.evaluate(() => {
  const bad = [];
  const boxes = [...document.querySelectorAll(".com .ui-card"), ...document.querySelectorAll(".com-tabs a"), ...document.querySelectorAll(".ui-dialog[open]")];
  for (const box of boxes) {
    const c = box.getBoundingClientRect();
    const name = box.querySelector("h2")?.textContent ?? box.textContent.slice(0, 20);
    for (const el of box.querySelectorAll("*")) {
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
  for (const b of document.querySelectorAll(".com .ui-seg button")) {
    if (b.scrollWidth > b.clientWidth + 1) bad.push(`segment "${b.textContent}" is clipped`);
  }
  const strip = document.querySelector(".com-tabs")?.getBoundingClientRect();
  const main = document.querySelector(".com")?.getBoundingClientRect();
  if (strip && main && (strip.left < main.left - 0.5 || strip.right > main.right + 0.5)) bad.push("the tab strip pokes out of the page");
  const dialog = document.querySelector(".ui-dialog[open]")?.getBoundingClientRect();
  if (dialog && (dialog.left < 0 || dialog.right > innerWidth || dialog.top < 0 || dialog.bottom > innerHeight + 0.5)) bad.push("the dialog leaves the viewport");
  const rows = [...document.querySelectorAll(".com-tabs a")].map((a) => Math.round(a.getBoundingClientRect().y));
  return { bad, tabRows: new Set(rows).size };
});
// WCAG contrast of each element's text against what is really behind it (alpha composed up the tree).
const contrasts = (page, selector) => page.evaluate((sel) => {
  const parse = (c) => (c.match(/[\d.]+/g) ?? []).map(Number);
  const over = (top, under) => {
    const a = top[3] ?? 1;
    return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a)).concat(1);
  };
  const behind = (el) => {
    const layers = [];
    for (let n = el; n; n = n.parentElement) {
      const bg = parse(getComputedStyle(n).backgroundColor);
      if (bg.length && (bg[3] ?? 1) > 0) layers.push(bg);
      if ((bg[3] ?? 0) === 1 || (bg.length === 3)) break;
    }
    let color = [255, 255, 255, 1];
    if (document.documentElement.dataset.theme === "dark") color = [0, 0, 0, 1];
    for (const layer of layers.reverse()) color = over(layer, color);
    return color;
  };
  const lum = ([r, g, b]) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  return [...document.querySelectorAll(sel)].map((el) => {
    const bg = behind(el);
    const fg = over(parse(getComputedStyle(el).color), bg);
    const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    return { text: el.textContent.trim().slice(0, 20), ratio: +((a + 0.05) / (b + 0.05)).toFixed(2) };
  });
}, selector);
const LINKS = {
  feedback: "#/community?tab=feedback&status=open",
  visits: "#/community?tab=visits&outcome=could_not_charge&since=7",
  submissions: "#/community?tab=submissions&status=pending",
  reviews: "#/community?tab=reviews&reports=open",
};

try {
  // ---- 1. Feedback, from Needs you: open requests, the design-votes tally under 10, resolve / reopen ----
  {
    const { context, page, requests, S } = await open({ scale: 2 });
    await page.goto(`${base}/${LINKS.feedback}`);
    await ready(page, "#com-feedback");
    await ready(page, "#com-votes");
    await queueSettled(page);
    eq(await page.locator(".ui-lt h1").innerText(), "Community", "feedback: the page title");
    eq(await hashOf(page), LINKS.feedback, "feedback: the Needs-you link stays as it is (defaults are not written in)");
    ok(requests.includes("admin-feedback?status=open&category=requests&page=1&perPage=25"), "feedback: open requests are asked for (design votes left out)", requests);
    eq(await tabs(page), [
      { label: "Feedback", badge: "3", zero: false, current: true, href: "#/community?tab=feedback" },
      { label: "Submissions", badge: "3", zero: false, current: false, href: "#/community?tab=submissions" },
      { label: "Reviews", badge: "2", zero: false, current: false, href: "#/community?tab=reviews" },
      { label: "Driver visits", badge: "2", zero: false, current: false, href: "#/community?tab=visits" },
    ], "feedback: four tabs, each badge its open count, Feedback current");
    eq(await navBadge(page), "10", "feedback: the nav badge is the queue total (3 + 3 + 2 + 2)");
    eq(await stats(page, "#com-feedback"), ["3 Open requests", "1 Resolved", "2 Received, 7 days", "4 Received, all time"], "feedback: stats count requests only (9 rows, 5 of them votes; 7 this week, 5 of them votes)");
    eq(await optionsOf(page, "#com-feedback", "Status"), ["Open (3)", "Resolved (1)", "All"], "feedback: the status filter carries its counts");
    eq(await page.locator("#com-feedback .com-refresh").innerText(), "Refresh", "feedback: a Refresh action in the filter bar");
    ok((await square(page, "#com-votes")).includes("--c-design-fill"), "votes: the card wears the design colour, not Contributions");
    ok((await square(page, "#com-feedback")).includes("--c-needs-you-fill"), "feedback: Needs Orange");
    eq(await page.locator("#com-feedback .ui-meta").innerText(), "3 open", "feedback: card meta");
    eq(await items(page, "#com-feedback").count(), 3, "feedback: three open requests, no vote among them");
    const first = items(page, "#com-feedback").first();
    eq(await first.locator(".com-text").innerText(), "L'appli plante quand je planifie un trajet vers Sfax.\nÀ chaque fois.", "feedback: the driver's words with their line break");
    ok((await first.locator(".com-meta").first().innerText()).startsWith("driver@example.tn · android · 1.3.0 · fr"), "feedback: contact and device");
    eq(await first.locator(".com-meta a").getAttribute("href"), "mailto:driver@example.tn", "feedback: the contact is a mail link");
    eq(await page.$$eval("#com-feedback .com-text bdi", (b) => b.length), 3, "feedback: drivers' text is isolated in <bdi>");

    // Design votes: 5 votes, under 10 → counts only.
    eq(await stats(page, "#com-votes"), ["3 Likes it", "2 Doesn't like it"], "votes: thumbs counted");
    eq(await page.locator("#com-votes [data-testid=vote-share]").innerText(), "3 of 5 like it. Counts only: under 10 votes is too few for a share.", "votes: under 10, counts only");
    ok(!(await page.locator("#com-votes").innerText()).includes("%"), "votes: no percentage under 10");
    eq(await page.$$eval("#com-votes .com-near-list li", (li) => li.map((l) => l.innerText.replace(/\s+/g, " "))), ["Android 2 like · 1 don't", "iOS 1 like · 1 don't"], "votes: the platform split, most votes first");
    eq(await page.$$eval("#com-votes .com-list .com-item", (li) => li.map((l) => l.innerText.replace(/\s+/g, " "))), [
      "Likes it fr 2h ago Magnifique, enfin lisible la nuit iOS · 1.3.0",
      "Doesn't like it ar 3h ago Trop sombre pour moi Android · 1.3.0",
    ], "votes: the latest comments with their vote, locale and date");
    eq(await page.locator("#com-votes .ui-meta").innerText(), "5 votes", "votes: card meta");
    ok(requests.includes("admin-feedback?status=all&category=design&page=1&perPage=100"), "votes: the tally reads every design vote");

    // Resolve: the row flips in place, the counts follow, the queue reloads.
    const before = count(requests, "admin-feedback?status=open&category=requests&page=1&perPage=3");
    await first.getByRole("button", { name: "Resolve" }).click();
    await first.getByRole("button", { name: "Reopen" }).waitFor();
    eq(await first.locator(".ui-pill").allInnerTexts(), ["Bug", "Resolved"], "resolve: the row says Resolved and stays for an undo");
    ok((await first.innerText()).includes("Resolved · by admin@charj.test · just now"), "resolve: who and when");
    eq(await stats(page, "#com-feedback"), ["2 Open requests", "2 Resolved", "2 Received, 7 days", "4 Received, all time"], "resolve: Open requests 3 → 2, Resolved 1 → 2");
    eq(await optionsOf(page, "#com-feedback", "Status"), ["Open (2)", "Resolved (2)", "All"], "resolve: the filter counts follow");
    await page.waitForFunction(() => document.querySelector(".com-tabs a .com-badge")?.textContent === "2");
    ok(count(requests, "admin-feedback?status=open&category=requests&page=1&perPage=3") > before, "resolve: the queue reloads (no timer)");
    eq((await tabs(page))[0].badge, "2", "resolve: the Feedback badge follows");
    eq(await navBadge(page), "9", "resolve: the nav badge follows");
    ok(requests.includes("POST admin-feedback"), "resolve: one POST");
    // While the flip is on its way, Refresh waits: a read started then could land after it with the old row.
    S.postDelay = 800;
    await first.getByRole("button", { name: "Reopen" }).click();
    await first.getByRole("button", { name: "Reopening…" }).waitFor();
    ok(await page.locator("#com-feedback .com-refresh").isDisabled(), "reopen: Refresh is off while the change is on its way");
    await first.getByRole("button", { name: "Resolve" }).waitFor();
    S.postDelay = 0;
    await page.waitForFunction(() => !document.querySelector("#com-feedback .com-refresh")?.disabled);
    ok(true, "reopen: Refresh is back once the change landed");
    await page.waitForFunction(() => document.querySelector(".com-tabs a .com-badge")?.textContent === "3");
    eq(await stats(page, "#com-feedback"), ["3 Open requests", "1 Resolved", "2 Received, 7 days", "4 Received, all time"], "reopen: back to 3");

    // Refresh: by hand, reads the list and the queue again and picks up what arrived.
    S.feedback.push(fb(50, "bug", "Nouveau bug arrivé entre-temps", "2026-11-02T09:30:00Z"));
    const [lists, queues] = [count(requests, "admin-feedback?status=open&category=requests&page=1&perPage=25"), count(requests, "admin-feedback?status=open&category=requests&page=1&perPage=3")];
    await page.locator("#com-feedback .com-refresh").click();
    await page.waitForFunction(() => document.querySelectorAll("#com-feedback .com-list > .com-item").length === 4);
    ok(count(requests, "admin-feedback?status=open&category=requests&page=1&perPage=25") > lists, "refresh: the list is read again");
    ok(count(requests, "admin-feedback?status=open&category=requests&page=1&perPage=3") > queues, "refresh: so is the queue");
    await page.waitForFunction(() => document.querySelector(".com-tabs a .com-badge")?.textContent === "4");
    eq(await stats(page, "#com-feedback"), ["4 Open requests", "1 Resolved", "3 Received, 7 days", "5 Received, all time"], "refresh: the new request counts");
    S.feedback.pop();
    await page.locator("#com-feedback .com-refresh").click();
    await page.waitForFunction(() => document.querySelectorAll("#com-feedback .com-list > .com-item").length === 3);
    eq(S.feedback.find((f) => f.id === uuid("f", 1)).resolved, false, "reopen: the server row is open again");

    // Filters live in the URL.
    await selectIn(page, "#com-feedback", "Show").selectOption("all");
    await page.waitForFunction(() => location.hash.includes("category=all"));
    await ready(page, "#com-feedback");
    eq(await items(page, "#com-feedback").count(), 8, "filter: All shows the requests and the votes");
    ok((await page.locator("#com-feedback").innerText()).includes("Doesn't like it"), "filter: a vote shows its thumb");
    ok((await page.locator("#com-feedback").innerText()).includes("No comment"), "filter: a vote without words reads No comment");
    ok((await page.locator("#com-feedback").innerText()).includes("Informational: not counted as waiting."), "filter: votes say they don't wait");
    eq(await optionsOf(page, "#com-feedback", "Status"), ["Open (8)", "Resolved (1)", "All"], "filter: with votes, the counts include them");
    await selectIn(page, "#com-feedback", "Status").selectOption("resolved");
    await page.waitForFunction(() => location.hash.includes("status=resolved"));
    await ready(page, "#com-feedback");
    eq(await items(page, "#com-feedback").count(), 1, "filter: Resolved");
    await page.reload();
    await ready(page, "#com-feedback");
    eq(await selectIn(page, "#com-feedback", "Status").inputValue(), "resolved", "filter: survives a reload");
    eq(await selectIn(page, "#com-feedback", "Show").inputValue(), "all", "filter: the category survives a reload");
    eq(await hscroll(page), 0, "feedback: no horizontal scroll at 390");
    await context.close();
  }

  // ---- 2. admin-feedback not deployed yet: category=requests → 400 ----
  {
    const { context, page, requests, S } = await open({ S: state({ feedbackDeployed: false }) });
    await page.goto(`${base}/${LINKS.feedback}`);
    await page.locator("#com-feedback .com-retry").waitFor();
    await ready(page, "#com-votes");
    await queueSettled(page);
    const text = await page.locator("#com-feedback").innerText();
    ok(text.includes("Couldn't load feedback. The feedback function refused this request (HTTP 400)."), "400: Couldn't load, said plainly", text);
    ok(text.includes("Requests needs the updated admin-feedback function; All works meanwhile."), "400: says why and what works");
    eq(await page.locator("#com-feedback .com-stats").count(), 0, "400: no stats drawn from nothing");
    eq(await page.locator("#com-feedback .ui-meta").count(), 0, "400: no open count in the header");
    ok(!/\b0 open\b|NaN|undefined/.test(text), "400: never a fake 0");
    eq((await tabs(page))[0].badge, null, "400: no Feedback badge (unknown, not 0)");
    eq(await navBadge(page), null, "400: no nav badge while a source is unknown");
    eq(await stats(page, "#com-votes"), ["3 Likes it", "2 Doesn't like it"], "400: the design votes still load");
    await page.locator("#com-feedback").getByRole("button", { name: "Show all" }).click();
    await page.waitForFunction(() => location.hash.includes("category=all"));
    await ready(page, "#com-feedback");
    ok(true, "400: Show all is one tap away");
    eq(await stats(page, "#com-feedback"), ["— Open requests", "— Resolved", "2 Received, 7 days", "4 Received, all time"], "old server: open requests unknown, not the open count with votes in it");
    ok((await page.locator("#com-feedback .com-note").first().innerText()).includes("need the updated admin-feedback"), "old server: says why");
    await selectIn(page, "#com-feedback", "Show").selectOption("requests");
    await page.locator("#com-feedback .com-retry").waitFor();
    S.feedbackDeployed = true;
    await page.locator("#com-feedback").getByRole("button", { name: "Try again" }).click();
    await page.waitForSelector("#com-feedback .com-stats");
    eq(await stats(page, "#com-feedback"), ["3 Open requests", "1 Resolved", "2 Received, 7 days", "4 Received, all time"], "400: Try again loads once deployed");
    ok(count(requests, "admin-feedback?status=open&category=requests&page=1&perPage=25") >= 2, "400: Try again asks again");
    await shot(page, "t9-390-feedback-after-retry.png");
    await context.close();
  }

  // ---- 3. Design votes from 10: a share with its count; no platform → no split ----
  {
    const { context, page } = await open({ S: state({ feedback: [...requests(), ...manyVotes()] }) });
    await page.goto(`${base}/#/community`);
    await ready(page, "#com-votes");
    eq(await stats(page, "#com-votes"), ["8 Likes it", "4 Doesn't like it"], "12 votes: thumbs counted");
    eq(await page.locator("#com-votes [data-testid=vote-share]").innerText(), "67% (8 of 12) like it.", "12 votes: a share, with its count");
    eq(await page.locator("#com-votes .com-near-list").count(), 0, "12 votes: no platform in the rows, no split");
    eq(await page.locator("#com-votes .com-list .com-item").count(), 1, "12 votes: only the one with words is a comment");
    eq((await tabs(page))[0].current, true, "no tab: Feedback is the default");
    await context.close();
  }

  // ---- 4. Submissions: nearby check, approve (422, then 200 → the editor), 409, reject with a note ----
  {
    const S = state();
    let first422 = true;
    S.reviewAnswer = (body, srv) => {
      if (body.id === S1 && first422) {
        first422 = false;
        return [422, { error: "city_not_found" }];
      }
      if (body.id === S2) {
        // Someone else approved it a moment ago.
        Object.assign(srv.submissions.find((s) => s.id === S2), { status: "approved", reviewed_by: "other@charj.tn", reviewed_at: NOW.toISOString(), charger_id: FAR });
        return [409, { error: "already_reviewed" }];
      }
      return null;
    };
    const { context, page, requests, reads } = await open({ S, scale: 2 });
    await page.goto(`${base}/${LINKS.submissions}`);
    await ready(page, "#com-submissions");
    await page.waitForFunction(() => document.querySelector("#com-submissions .com-near"));
    await queueSettled(page);
    eq((await tabs(page)).map((t) => t.current), [false, true, false, false], "submissions: the Needs-you link opens Submissions");
    ok(requests.includes("admin-submissions?status=pending&page=1&perPage=25"), "submissions: pending asked for");
    ok(reads.includes("rpc/search_chargers"), "submissions: the chargers the dashboard loads feed the nearby check");
    eq(await page.locator("#com-submissions .ui-meta").innerText(), "3 pending", "submissions: card meta");
    eq(await page.locator("#com-submissions > .com-meta").first().innerText(), "3 pending · 1 approved · 0 rejected", "submissions: counts per status");
    eq(await items(page, "#com-submissions").count(), 3, "submissions: three pending");
    const lac = items(page, "#com-submissions").first();
    eq(await lac.locator(".com-title").innerText(), "Borne Lac 2", "submissions: the name");
    eq(await lac.locator(".com-conns li").allInnerTexts(), ["2 × Type 2 · 22 kW", "1 × CCS · 60 kW"], "submissions: connectors");
    eq(await lac.locator(".com-meta a").first().getAttribute("href"), "https://www.google.com/maps/search/?api=1&query=36.8321%2C10.2345", "submissions: the pin opens Google Maps");
    eq(await lac.locator(".com-near").innerText(), "Possible duplicate: Shell Lac, 22 m away.", "submissions: a charger within 100 m is flagged on the card");
    eq(await items(page, "#com-submissions").nth(1).locator(".com-near").count(), 0, "submissions: nothing flagged where nothing is near");
    ok((await items(page, "#com-submissions").nth(2).innerText()).includes("Connectors couldn't be read: type2 x2"), "submissions: unreadable connectors are shown raw");

    // Approve: the confirm step.
    await lac.getByRole("button", { name: "Approve…" }).click();
    const dialog = page.locator(".ui-dialog[open]");
    await dialog.waitFor();
    eq(await dialog.locator("h2").innerText(), "Approve this charger?", "approve: a confirm step");
    eq(await dialog.locator("h3").first().innerText(), "Borne Lac 2", "approve: the charger name");
    eq(await dialog.locator("section").first().locator(".com-meta a").innerText(), "36.83210, 10.23450", "approve: the location as coordinates");
    eq(await dialog.locator(".com-conns li").allInnerTexts(), ["2 × Type 2 · 22 kW", "1 × CCS · 60 kW"], "approve: the connectors");
    eq(await dialog.locator(".com-near b").innerText(), "1 charger within 100 m.", "approve: the nearby check");
    eq(await dialog.locator(".com-near-list li").allInnerTexts().then((t) => t.map((x) => x.replace(/\s+/g, " "))), ["Shell Lac 22 m"], "approve: the nearby charger with its distance");
    eq(await dialog.locator(".com-near-list a").getAttribute("href"), `#/chargers?id=${SHELL}`, "approve: the nearby charger opens in Chargers");
    eq(await page.locator("gmp-map, .gm-style").count(), 0, "approve: no live map in the dialog");
    ok(await page.evaluate(() => document.activeElement?.closest(".ui-dialog") !== null), "approve: focus moves into the dialog");
    eq(await dialog.getByLabel("Arabic name").getAttribute("dir"), "rtl", "approve: the Arabic fields write right to left");
    await dialog.getByLabel("Arabic name").fill("بورن البحيرة 2");
    await dialog.getByLabel("Operator").fill("Lac Mall");
    const fitDialog = await fits(page);
    ok(fitDialog.bad.length === 0, "approve: the dialog fits at 390", fitDialog);
    await shot(page, "t9-390-approve.png");

    // 422: the reason in plain words; the dialog stays.
    await dialog.getByRole("button", { name: "Approve", exact: true }).click();
    await dialog.locator(".ui-error").waitFor();
    eq(await dialog.locator(".ui-error").innerText(), "No city matches this location. Check the pin, or add the city in Chargers first.", "422: the server's reason in plain words");
    eq(S.posts.at(-1).body, { id: S1, action: "approve", name_ar: "بورن البحيرة 2", operator: "Lac Mall" }, "approve: the POST carries the Arabic name and operator, nothing invented");
    eq(await page.locator(".ui-dialog[open]").count(), 1, "422: the dialog stays open");

    // 200: open the new charger in its editor; the queue reloads.
    const badgeBefore = await navBadge(page);
    await dialog.getByRole("button", { name: "Approve", exact: true }).click();
    await page.waitForFunction(() => location.hash.startsWith("#/chargers"));
    ok((await page.evaluate(() => window.__hashes)).includes(`#/chargers?id=${NEW}&edit=1`), "200: navigates to the new charger, editor first", await page.evaluate(() => window.__hashes));
    const editor = page.getByRole("dialog");
    await editor.getByLabel("Display name", { exact: true }).waitFor();
    eq(await editor.getByLabel("Display name", { exact: true }).inputValue(), "Borne Lac 2", "200: the editor opens on the new charger");
    await page.waitForFunction((b) => document.querySelector(".ui-tabs .ui-nav-badge")?.textContent !== b, badgeBefore);
    eq([badgeBefore, await navBadge(page)], ["10", "9"], "200: the nav badge drops by one");
    eq(await hashOf(page), "#/chargers", "200: the id is consumed, so Back doesn't reopen it");

    // Back on Submissions: 409 and reject.
    await page.goto(`${base}/${LINKS.submissions}`);
    await ready(page, "#com-submissions");
    await queueSettled(page);
    eq(await items(page, "#com-submissions").count(), 2, "after approve: two pending left");
    eq((await tabs(page))[1].badge, "2", "after approve: the Submissions badge is 2");
    const gammarth = items(page, "#com-submissions").first();
    await gammarth.getByRole("button", { name: "Approve…" }).click();
    await page.locator(".ui-dialog[open]").waitFor();
    eq(await page.locator(".ui-dialog[open] .com-near").innerText(), "No charger within 100 m.", "approve: nothing nearby says so");
    const gets = count(requests, "admin-submissions?status=pending&page=1&perPage=25");
    await page.locator(".ui-dialog[open]").getByRole("button", { name: "Approve", exact: true }).click();
    await page.locator("#com-submissions .com-notice").waitFor();
    eq(await page.locator("#com-submissions .com-notice").innerText(), "Someone already reviewed this. The list now shows where it stands.", "409: Someone already reviewed this");
    eq(await page.locator(".ui-dialog[open]").count(), 0, "409: the dialog closes");
    await page.waitForFunction(() => document.querySelectorAll("#com-submissions .com-list > .com-item").length === 1);
    ok(count(requests, "admin-submissions?status=pending&page=1&perPage=25") > gets, "409: the list is read again");
    await page.waitForFunction(() => document.querySelectorAll(".com-tabs a .com-badge")[1]?.textContent === "1");
    eq((await tabs(page))[1].badge, "1", "409: the badge follows what the server says");

    // Reject with a note.
    const agil = items(page, "#com-submissions").first();
    await agil.getByRole("button", { name: "Reject…" }).click();
    await agil.getByLabel(/Note/).fill("Doublon de la borne Agil existante");
    await agil.getByRole("button", { name: "Reject", exact: true }).click();
    await agil.locator(".com-meta", { hasText: "Rejected" }).waitFor();
    eq(S.posts.at(-1).body, { id: S3, action: "reject", note: "Doublon de la borne Agil existante" }, "reject: the POST carries the note");
    ok((await agil.innerText()).includes("Note: Doublon de la borne Agil existante"), "reject: the row shows the note");
    eq(await agil.getByRole("button", { name: "Approve…" }).count(), 0, "reject: no actions left on a reviewed row");
    eq(await page.locator("#com-submissions > .com-meta").first().innerText(), "0 pending · 3 approved · 1 rejected", "reject: the counts follow");
    await page.waitForFunction(() => document.querySelectorAll(".com-tabs a .com-badge")[1]?.textContent === "0");
    eq((await tabs(page))[1], { label: "Submissions", badge: "0", zero: true, current: true, href: "#/community?tab=submissions" }, "reject: a real zero badge, uncoloured");

    // Approved view: the reviewer, the note, the charger link.
    await page.locator("#com-submissions .ui-seg button", { hasText: "Approved" }).click();
    await page.waitForFunction(() => location.hash.includes("status=approved"));
    await ready(page, "#com-submissions");
    const sfax = items(page, "#com-submissions").filter({ hasText: "Shell Sfax" });
    ok((await sfax.innerText()).includes("Approved · by admin@charj.tn"), "approved: who approved it");
    eq(await sfax.getByRole("link", { name: "Open the charger" }).getAttribute("href"), `#/chargers?id=${FAR}`, "approved: opens its charger");
    ok((await sfax.innerText()).includes("Note: Checked on Maps"), "approved: the note");
    eq(await hscroll(page), 0, "submissions: no horizontal scroll at 390");
    await context.close();
  }

  // ---- 4b. 404 on approve or reject: like 409, the notice and a fresh list ----
  {
    const S = state();
    const { context, page, requests } = await open({ S });
    await page.goto(`${base}/${LINKS.submissions}`);
    await ready(page, "#com-submissions");
    await queueSettled(page);
    eq(await page.locator("#com-submissions .com-refresh").count(), 1, "submissions: a Refresh action in the filter bar");
    // Deleted on the server after the list was read.
    S.submissions = S.submissions.filter((x) => x.id !== S1);
    await items(page, "#com-submissions").first().getByRole("button", { name: "Approve…" }).click();
    await page.locator(".ui-dialog[open]").getByRole("button", { name: "Approve", exact: true }).click();
    await page.locator("#com-submissions .com-notice").waitFor();
    eq(await page.locator("#com-submissions .com-notice").innerText(), "This submission no longer exists. The list now shows where it stands.", "404 approve: said plainly");
    eq(await page.locator(".ui-dialog[open]").count(), 0, "404 approve: the dialog closes");
    await page.waitForFunction(() => document.querySelectorAll("#com-submissions .com-list > .com-item").length === 2);
    await page.waitForFunction(() => document.querySelectorAll(".com-tabs a .com-badge")[1]?.textContent === "2");
    ok(true, "404 approve: the list and the badge are read again");
    S.submissions = S.submissions.filter((x) => x.id !== S2);
    const gammarth = items(page, "#com-submissions").first();
    await gammarth.getByRole("button", { name: "Reject…" }).click();
    await gammarth.getByRole("button", { name: "Reject", exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll("#com-submissions .com-list > .com-item").length === 1);
    eq(await page.locator("#com-submissions .com-notice").innerText(), "This submission no longer exists. The list now shows where it stands.", "404 reject: the same");
    ok(requests.filter((r) => r === "POST admin-submissions").length === 2, "404: two POSTs, nothing else written");
    await context.close();
  }

  // ---- 4c. A dialog that closed while approving never navigates later ----
  {
    const S = state({ postDelay: 900 });
    const { context, page } = await open({ S });
    await page.goto(`${base}/${LINKS.submissions}`);
    await ready(page, "#com-submissions");
    await items(page, "#com-submissions").first().getByRole("button", { name: "Approve…" }).click();
    await page.locator(".ui-dialog[open]").getByRole("button", { name: "Approve", exact: true }).click();
    await page.locator(".ui-dialog[open]").getByRole("button", { name: "Approving…" }).waitFor();
    // Back button / another tab while the POST is out: the dialog goes with the tab.
    await page.evaluate(() => { location.hash = "#/community?tab=reviews"; });
    await page.waitForSelector("#com-reports");
    await page.waitForTimeout(1500);
    eq(await hashOf(page), "#/community?tab=reviews", "late answer: no navigation to the charger");
    ok(!(await page.evaluate(() => window.__hashes)).some((h) => h.startsWith("#/chargers")), "late answer: the editor never opened");
    eq(S.submissions.find((x) => x.id === S1).status, "approved", "late answer: the approval itself went through");
    await context.close();
  }

  // ---- 4d. Photos: only the app's own uploads load; any other URL is counted, never fetched or linked ----
  {
    const S = state();
    S.submissions[0].photos = [APP_PHOTO("s1/1.jpg"), "https://tracker.example/pixel.gif", APP_PHOTO("s1/2.jpg"), "https://x.supabase.co/storage/v1/object/public/charger-photos/a.jpg"];
    S.submissions[1].photos = ["https://tracker.example/only.gif"];
    const { context, page, urls } = await open({ S });
    await page.goto(`${base}/${LINKS.submissions}`);
    await ready(page, "#com-submissions");
    const lac = items(page, "#com-submissions").first();
    await page.waitForFunction(() => [...document.querySelectorAll("#com-submissions .com-photos img")].every((i) => i.complete));
    const imgs = await lac.locator(".com-photos img").evaluateAll((is) => is.map((i) => ({ src: i.getAttribute("src"), ref: i.getAttribute("referrerpolicy"), loaded: i.naturalWidth > 0 })));
    eq(imgs.length, 2, "photos: the two app uploads are shown");
    ok(imgs.every((i) => /^https?:\/\/[^/]+\/storage\/v1\/object\/public\/charger-photos\/s1\/[12]\.jpg$/.test(i.src) && i.ref === "no-referrer" && i.loaded), "photos: from this project's charger-photos bucket, loaded, no referrer", imgs);
    const links = await lac.locator(".com-photos a").evaluateAll((as) => as.map((a) => ({ label: a.getAttribute("aria-label"), ref: a.getAttribute("referrerpolicy"), rel: a.getAttribute("rel") })));
    eq(links.map((l) => l.label), ["Photo 1 of 2, opens in a new tab", "Photo 2 of 2, opens in a new tab"], "photos: numbered among the app's own");
    ok(links.every((l) => l.ref === "no-referrer" && l.rel.includes("noreferrer")), "photos: links send no referrer", links);
    const line = lac.locator(".com-meta", { hasText: "not from the app" });
    eq(await line.innerText(), "2 photos not from the app", "photos: the others are counted in a plain line");
    eq(await line.locator("a").count(), 0, "photos: that line is not a link");
    const gammarth = items(page, "#com-submissions").nth(1);
    eq(await gammarth.locator(".com-photos").count(), 0, "photos: no strip when none is the app's");
    eq(await gammarth.locator(".com-meta", { hasText: "not from the app" }).innerText(), "1 photo not from the app", "photos: one, singular");
    ok(!(await page.locator("#com-submissions").innerHTML()).includes("tracker.example"), "photos: an outside URL is nowhere in the page");
    const outside = urls.filter((u) => /tracker\.example|x\.supabase\.co/.test(u));
    eq(outside, [], "photos: no request goes to an outside photo host");
    const appPhotos = urls.filter((u) => u.includes("/storage/v1/object/public/charger-photos/s1/"));
    eq(appPhotos.length, 2, "photos: the two app uploads were the only photos fetched");
    await context.close();
  }

  // ---- 5. Reviews: reports open first, Show review, resolve flips the row ----
  {
    const { context, page, requests, S } = await open();
    await page.goto(`${base}/${LINKS.reviews}`);
    await ready(page, "#com-reports");
    await ready(page, "#com-reviews");
    await queueSettled(page);
    ok(requests.includes("admin-review-reports?status=open&page=1&perPage=25"), "reports: open asked for");
    eq(await page.locator("#com-reports .ui-meta").innerText(), "2 open", "reports: card meta");
    eq(await items(page, "#com-reports").count(), 2, "reports: the two open ones");
    const spam = items(page, "#com-reports").first();
    eq(await spam.locator(".com-title").innerText(), "Spam", "reports: the reason in words");
    ok((await spam.innerText()).includes("A review of Shell Hammamet"), "reports: which charger");
    eq(await spam.locator(":scope > .com-text").innerText(), "Il fait de la pub pour son garage", "reports: the reporter's note");
    eq(await spam.locator("details").getAttribute("open"), null, "reports: the review is behind Show review");
    await spam.locator("summary", { hasText: "Show review" }).click();
    eq(await spam.locator("details .com-stars").getAttribute("aria-label"), "1 of 5 stars", "show review: its stars");
    eq(await spam.locator("details .com-text").innerText(), "Visitez mon garage www.example.tn", "show review: its words");
    await items(page, "#com-reports").nth(1).locator("summary").click();
    ok((await items(page, "#com-reports").nth(1).innerText()).includes("No comment, stars only."), "show review: a stars-only review says so");

    await spam.getByRole("button", { name: "Resolve" }).click();
    await spam.getByRole("button", { name: "Reopen" }).waitFor();
    eq(await spam.locator(".ui-pill").allInnerTexts(), ["Resolved"], "resolve: the row flips to Resolved, in place");
    eq(await page.locator("#com-reports .ui-meta").innerText(), "1 open", "resolve: 2 → 1 open");
    eq(S.posts.at(-1).body, { id: R1, resolved: true }, "resolve: the POST");
    await page.waitForFunction(() => document.querySelectorAll(".com-tabs a .com-badge")[2]?.textContent === "1");
    eq((await tabs(page))[2].badge, "1", "resolve: the Reviews badge follows");
    eq(await navBadge(page), "9", "resolve: the nav badge follows");
    // While a reopen is on its way, Refresh waits: a read started then could land after it with the old row.
    S.postDelay = 800;
    await spam.getByRole("button", { name: "Reopen" }).click();
    await spam.getByRole("button", { name: "Reopening…" }).waitFor();
    ok(await page.locator("#com-reports .com-refresh").isDisabled(), "reopen report: Refresh is off while the change is on its way");
    await spam.getByRole("button", { name: "Resolve" }).waitFor();
    S.postDelay = 0;
    await page.waitForFunction(() => !document.querySelector("#com-reports .com-refresh")?.disabled);
    ok(true, "reopen report: Refresh is back once the change landed");
    eq(S.posts.at(-1).body, { id: R1, resolved: false }, "reopen report: the POST");
    await page.waitForFunction(() => document.querySelectorAll(".com-tabs a .com-badge")[2]?.textContent === "2");
    eq(await page.locator("#com-reports .ui-meta").innerText(), "2 open", "reopen report: back to 2 open");
    await spam.getByRole("button", { name: "Resolve" }).click();
    await spam.getByRole("button", { name: "Reopen" }).waitFor();
    await page.waitForFunction(() => document.querySelectorAll(".com-tabs a .com-badge")[2]?.textContent === "1");

    // Recent reviews (anon ratings) below.
    eq(await items(page, "#com-reviews").count(), 2, "recent reviews: listed");
    eq(await items(page, "#com-reviews").first().locator(".com-stars").getAttribute("aria-label"), "5 of 5 stars", "recent reviews: stars");
    ok((await items(page, "#com-reviews").first().innerText()).includes("Rapide et propre"), "recent reviews: words");
    ok((await items(page, "#com-reviews").nth(1).innerText()).includes("No comment, stars only."), "recent reviews: stars only");

    await page.locator("#com-reports .ui-seg button", { hasText: "Resolved" }).click();
    await page.waitForFunction(() => location.hash.includes("reports=resolved"));
    await ready(page, "#com-reports");
    eq(await items(page, "#com-reports").count(), 2, "reports: Resolved lists the two resolved");
    ok((await page.locator("#com-reports").innerText()).includes("The review no longer exists."), "reports: a deleted review says so");
    eq(await hscroll(page), 0, "reviews: no horizontal scroll at 390");
    await context.close();
  }

  // ---- 5b. Recent reviews that fail: Couldn't load, Try again ----
  {
    const S = state({ ratingsFail: true });
    const { context, page, reads } = await open({ S });
    await page.goto(`${base}/${LINKS.reviews}`);
    await page.locator("#com-reviews .com-retry").waitFor();
    ok((await page.locator("#com-reviews .com-retry").innerText()).startsWith("Couldn't load reviews."), "recent reviews: a failed read says so");
    eq(await page.locator("#com-reviews .ui-meta").count(), 0, "recent reviews: no count from nothing");
    eq(await page.locator("#com-reports .com-refresh").count(), 1, "reports: a Refresh action in the filter bar");
    S.ratingsFail = false;
    const before = reads.filter((r) => r === "ratings").length;
    await page.locator("#com-reviews").getByRole("button", { name: "Try again" }).click();
    await page.waitForFunction(() => document.querySelectorAll("#com-reviews .com-list > .com-item").length === 2);
    ok(reads.filter((r) => r === "ratings").length > before, "recent reviews: Try again reads again and loads");
    await context.close();
  }

  // ---- 6. Driver visits: the Needs-you filters, hide with a reason, unhide, open the driver ----
  {
    const { context, page, requests, S } = await open();
    await page.goto(`${base}/${LINKS.visits}`);
    await ready(page, "#com-visits");
    await queueSettled(page);
    ok(requests.includes("admin-confirmations?page=1&perPage=25&outcome=could_not_charge&visibility=visible&since_days=7"), "visits: the Needs-you filters reach the server", requests);
    eq(await page.locator("#com-visits select").inputValue(), "could_not_charge", "visits: the outcome shows as picked");
    eq(await page.$$eval("#com-visits .ui-seg button[aria-pressed=true]", (b) => b.map((x) => x.textContent)), ["Visible", "7 days"], "visits: visibility and window show as picked");
    eq(await items(page, "#com-visits").count(), 2, "visits: the two in the last 7 days");
    eq(await stats(page, "#com-visits"), ["4 Reports, all time", "3 Couldn't charge", "3 Last 7 days", "2 Drivers"], "visits: all-time stats");
    ok((await page.locator("#com-visits > .com-meta").innerText()).includes("2 couldn't charge in the last 7 days (hidden ones left out)."), "visits: the window count, as the queue counts it");
    ok((await page.locator("#com-visits > .com-meta").innerText()).startsWith("Visits that ended charged: 1 of 4."), "visits: under 10, counts only");
    eq(await page.locator("#com-visits .com-stats .com-alarm").innerText(), "3", "visits: Couldn't charge in Alarm text (broken, above zero)");
    const marsa = items(page, "#com-visits").first();
    eq(await marsa.locator(".com-failed").innerText(), "Couldn't charge", "visits: the outcome");
    ok((await marsa.innerText()).includes("Charger not working"), "visits: the reason");
    ok((await marsa.innerText()).includes("visited 1 Nov 2026"), "visits: the visit date");

    await marsa.getByRole("button", { name: "Hide…" }).click();
    eq(await marsa.getByRole("button", { name: "Hide", exact: true }).isDisabled(), true, "hide: needs a reason first");
    await marsa.getByLabel(/Why hide it/).fill("Doublon");
    await marsa.getByRole("button", { name: "Hide", exact: true }).click();
    await marsa.getByRole("button", { name: "Unhide" }).waitFor();
    eq(S.posts.at(-1).body, { id: V1, hidden: true, reason: "Doublon" }, "hide: the POST carries the reason");
    ok((await marsa.innerText()).includes("Hidden: Doublon"), "hide: the row says why, in place");
    await page.waitForFunction(() => document.querySelectorAll(".com-tabs a .com-badge")[3]?.textContent === "1");
    eq((await tabs(page))[3].badge, "1", "hide: the Driver visits badge follows (hidden reports don't wait)");
    ok((await page.locator("#com-visits > .com-meta").innerText()).includes("1 couldn't charge in the last 7 days"), "hide: the window line agrees with the badge (2 → 1)");
    S.postDelay = 800;
    await marsa.getByRole("button", { name: "Unhide" }).click();
    await marsa.getByRole("button", { name: "Unhiding…" }).waitFor();
    ok(await page.locator("#com-visits .com-refresh").isDisabled(), "unhide: Refresh is off while the change is on its way");
    await marsa.getByRole("button", { name: "Hide…" }).waitFor();
    S.postDelay = 0;
    await page.waitForFunction(() => !document.querySelector("#com-visits .com-refresh")?.disabled);
    ok(true, "unhide: Refresh is back once the change landed");
    eq(S.posts.at(-1).body, { id: V1, hidden: false }, "unhide: the POST");
    await page.waitForFunction(() => document.querySelectorAll(".com-tabs a .com-badge")[3]?.textContent === "2");
    ok(true, "unhide: the badge goes back to 2");
    ok((await page.locator("#com-visits > .com-meta").innerText()).includes("2 couldn't charge in the last 7 days"), "unhide: the window line goes back to 2 with it");

    // Refresh: a report sent meanwhile shows up, in the list, the line and the badge.
    S.visits.push(visit(uuid("b", 5), "Shell Lac", "could_not_charge", "2026-11-02", { user_id: U2 }));
    await page.locator("#com-visits .com-refresh").click();
    await page.waitForFunction(() => document.querySelectorAll("#com-visits .com-list > .com-item").length === 3);
    await page.waitForFunction(() => document.querySelectorAll(".com-tabs a .com-badge")[3]?.textContent === "3");
    ok((await page.locator("#com-visits > .com-meta").innerText()).includes("3 couldn't charge in the last 7 days"), "refresh: list, line and badge all read 3");
    S.visits.pop();

    await page.locator("#com-visits .ui-seg button", { hasText: "All time" }).click();
    await page.waitForFunction(() => !location.hash.includes("since="));
    await ready(page, "#com-visits");
    eq(await items(page, "#com-visits").count(), 2, "visits: all time, visible couldn't-charge reports");
    await page.locator("#com-visits .ui-seg button", { hasText: "Hidden" }).click();
    await ready(page, "#com-visits");
    ok((await page.locator("#com-visits").innerText()).includes("Hidden: Test report"), "visits: hidden reports with their reason");

    await items(page, "#com-visits").first().getByRole("button", { name: /^a0000000/ }).click();
    await page.waitForFunction(() => location.hash.startsWith("#/usage"));
    eq(await hashOf(page), `#/usage?section=users&user=${U1}`, "open driver: Usage → Users for that driver");
    await context.close();
  }

  // ---- 7. Widths: every tab and the dialog at 375 / 768 / 1024 / 1440, long text ----
  {
    const long = "Super".repeat(60);
    const S = state();
    S.feedback.push(fb(9, "other", `Un mot sans fin ${long} et la suite du message, avec une adresse https://example.tn/${long}`, "2026-11-02T09:00:00Z", { email: `${"tres.long".repeat(8)}@example.tn` }));
    S.submissions.push(sub(uuid("5", 9), `Station ${"Électrique".repeat(12)}`, 36.8, 10.18, { address: `Avenue ${"Habib".repeat(20)}`, notes: long, photos: [APP_PHOTO("w/a.jpg"), APP_PHOTO("w/b.jpg"), "https://x.supabase.co/a.jpg"] }));
    S.reports.push({ ...reports()[0], id: uuid("e", 9), notes: long, rating: { ...reports()[0].rating, charger_name: `Borne ${"Longue".repeat(15)}`, comment: long } });
    S.visits.push(visit(uuid("b", 9), `Parking ${"Souterrain".repeat(10)}`, "could_not_charge", "2026-11-02", { charger_city: "Sidi Bou Saïd" }));
    S.reviewAnswer = () => [422, { error: "connectors_invalid" }];
    for (let i = 0; i < 120; i += 1) S.feedback.push(fb(200 + i, "other", `Ancien message ${i}`, "2026-09-01T10:00:00Z", { resolved: true, resolved_at: "2026-09-02T10:00:00Z" }));
    for (const [width, height] of [[375, 812], [768, 1024], [1024, 900], [1440, 900]]) {
      for (const colorScheme of width === 1440 ? ["light", "dark"] : ["light"]) {
        const { context, page } = await open({ width, height, colorScheme, S, scale: width === 1440 ? 1 : 2 });
        for (const tab of ["feedback", "submissions", "reviews", "visits"]) {
          await page.goto(`${base}/#/community?tab=${tab}`);
          const card = { feedback: "#com-feedback", submissions: "#com-submissions", reviews: "#com-reports", visits: "#com-visits" }[tab];
          await ready(page, card);
          if (tab === "feedback") await ready(page, "#com-votes");
          if (tab === "reviews") {
            await ready(page, "#com-reviews");
            for (const s of await page.locator("#com-reports summary").all()) await s.click();
          }
          await queueSettled(page);
          const tag = `${width} ${colorScheme} ${tab}`;
          eq(await hscroll(page), 0, `${tag}: no horizontal scroll`);
          const fit = await fits(page);
          ok(fit.bad.length === 0, `${tag}: everything fits, long text wraps`, fit);
          eq(fit.tabRows, width >= 1024 ? 1 : 2, `${tag}: tabs ${width >= 1024 ? "in one row" : "two by two"}`);
          const badgeContrast = await contrasts(page, ".com-tabs .com-badge, .com-tabs a > span:first-child");
          ok(badgeContrast.every((c) => c.ratio >= 4.5), `${tag}: tab labels and badges reach 4.5:1`, badgeContrast);
          if (tab === "submissions") {
            const btn = await contrasts(page, ".ui-btn-primary");
            ok(btn.every((c) => c.ratio >= 4.5), `${tag}: the primary button reaches 4.5:1`, btn);
            await items(page, card).first().getByRole("button", { name: "Approve…" }).click();
            await page.locator(".ui-dialog[open]").waitFor();
            await page.locator(".ui-dialog[open]").getByRole("button", { name: "Approve", exact: true }).click();
            await page.locator(".ui-dialog[open] .ui-error").waitFor();
            const dfit = await fits(page);
            ok(dfit.bad.length === 0, `${tag}: the dialog fits, with an error`, dfit);
            if (width === 1440 && colorScheme === "light") await page.screenshot({ path: `${output}/t9-1440-approve.png` });
            await page.keyboard.press("Escape");
            await page.locator(".ui-dialog[open]").waitFor({ state: "detached" }).catch(() => {});
            eq(await page.locator(".ui-dialog[open]").count(), 0, `${tag}: Escape closes the dialog`);
          }
          if (width === 768 && tab === "submissions") await shot(page, "t9-768-light.png");
          if (width === 1440 && tab === "feedback") await shot(page, `t9-1440-${colorScheme}.png`);
          if (width === 1440 && colorScheme === "dark" && tab === "reviews") await shot(page, "t9-1440-dark-reviews.png");
        }
        await context.close();
      }
    }
  }

  // ---- 8. 390 light / dark screenshots of each tab ----
  for (const colorScheme of ["light", "dark"]) {
    const { context, page } = await open({ colorScheme, scale: 2 });
    for (const tab of ["feedback", "submissions", "reviews", "visits"]) {
      await page.goto(`${base}/#/community?tab=${tab}`);
      const card = { feedback: "#com-feedback", submissions: "#com-submissions", reviews: "#com-reports", visits: "#com-visits" }[tab];
      await ready(page, card);
      if (tab === "feedback") await ready(page, "#com-votes");
      if (tab === "submissions") await page.waitForFunction(() => document.querySelector("#com-submissions .com-near"));
      await queueSettled(page);
      const fit = await fits(page);
      ok(fit.bad.length === 0, `390 ${colorScheme} ${tab}: fits`, fit);
      const all = await contrasts(page, ".com .com-meta, .com .com-when, .com .ui-pill, .com .com-badge, .com .com-stats span, .com .ui-btn, .com .com-near-list span");
      const low = all.filter((c) => c.ratio < 4.5);
      ok(low.length === 0, `390 ${colorScheme} ${tab}: secondary text, pills, badges and buttons reach 4.5:1`, low);
      if (tab === "feedback") await shot(page, `t9-390-${colorScheme}.png`);
      else if (colorScheme === "light") await shot(page, `t9-390-${tab}.png`);
    }
    await context.close();
  }

  // ---- 9. Loading and empty: no numbers before the data, honest empties ----
  {
    const S = state({ feedback: [], submissions: [], reports: [], visits: [], ratings: [], delay: 600 });
    const { context, page } = await open({ S });
    await page.goto(`${base}/#/community?tab=feedback`);
    await page.locator("#com-feedback [aria-busy=true]").waitFor();
    eq(await page.locator("#com-feedback .com-stats").count(), 0, "loading: no numbers yet");
    eq(await page.locator(".com-tabs .com-badge").count(), 0, "loading: no badges while the queue is unknown");
    await ready(page, "#com-feedback");
    await ready(page, "#com-votes");
    ok((await page.locator("#com-feedback").innerText()).includes("Nothing waiting."), "empty: Nothing waiting");
    ok((await page.locator("#com-votes").innerText()).includes("No design votes yet."), "empty: no votes yet");
    await page.waitForFunction(() => document.querySelectorAll(".com-tabs .com-badge-zero").length === 4);
    eq((await tabs(page)).map((t) => [t.badge, t.zero]), [["0", true], ["0", true], ["0", true], ["0", true]], "empty: four real zero badges, none coloured");
    await page.locator(".com-tabs a:not([aria-current])").first().hover();
    await page.waitForTimeout(300);
    const hovered = await contrasts(page, ".com-tabs a:hover > span:first-child, .com-tabs a:hover .com-badge");
    ok(hovered.length === 2 && hovered.every((c) => c.ratio >= 4.5), "hover: a hovered tab's label and zero badge keep 4.5:1", hovered);
    eq(await navBadge(page), null, "empty: no nav badge at 0");
    for (const [tab, card, text] of [["submissions", "#com-submissions", "Nothing waiting."], ["reviews", "#com-reports", "Nothing waiting."], ["visits", "#com-visits", "No visit reports match."]]) {
      await page.goto(`${base}/#/community?tab=${tab}`);
      await ready(page, card);
      ok((await page.locator(card).innerText()).includes(text), `empty: ${tab} says so`);
    }
    ok(!/NaN|undefined|Infinity/.test(await page.locator(".com").innerText()), "empty: no NaN anywhere");
    await context.close();
  }

  // ---- 10. RTL ----
  {
    const { context, page } = await open({ rtl: true });
    await page.goto(`${base}/#/community?tab=feedback`);
    await ready(page, "#com-feedback");
    await ready(page, "#com-votes");
    await queueSettled(page);
    eq(await hscroll(page), 0, "rtl: no horizontal scroll at 390");
    const fit = await fits(page);
    ok(fit.bad.length === 0, "rtl: fits", fit);
    const geo = await page.evaluate(() => {
      const row = document.querySelector("#com-feedback .com-top").getBoundingClientRect();
      const when = document.querySelector("#com-feedback .com-when").getBoundingClientRect();
      return { whenAtEnd: when.left - row.left < row.right - when.right };
    });
    ok(geo.whenAtEnd, "rtl: the time sits at the inline end (left)", geo);
    await page.screenshot({ path: `${output}/t9-390-rtl.png`, fullPage: true });
    await context.close();
  }

  ok(errors.length === 0, "no page or console errors", errors);
  console.log(`\n${checks} checks passed`);
} finally {
  await browser.close();
}
