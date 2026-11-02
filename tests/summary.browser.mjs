// Summary (Home) on mocked admin functions, headless.
// Run against a local Vite server started with fake Supabase values, e.g.
//   VITE_SUPABASE_URL=https://fake.supabase.test VITE_SUPABASE_ANON_KEY=fake \
//     npx vite --port 5181 --strictPort &
//   SUMMARY_URL=http://localhost:5181 PLAYWRIGHT_MODULE=<…>/playwright/index.mjs \
//     node tests/summary.browser.mjs
// Fixtures: an all-zero report, and the approved mock's snapshot DATA
// (docs/mockups/admin-dashboard.html) shaped as admin-usage / queue responses.
// All Supabase traffic is intercepted; this suite never reaches a real backend.
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.SUMMARY_URL || "http://localhost:5181";
const output = process.env.SUMMARY_ARTIFACTS || "/tmp/charj-summary-browser";
await mkdir(output, { recursive: true });

// ---- fixtures ----
const html = await readFile(new URL("../docs/mockups/admin-dashboard.html", import.meta.url), "utf8");
const DATA = JSON.parse(html.match(/^const DATA = (\{.*\});$/m)[1]);
const NOW = new Date("2026-11-02T01:23:38Z"); // the snapshot time (02:23 Tunis)
const round2 = (n) => Math.round(n * 100) / 100;
const lastDays = (rows, n, key) => rows.slice(-n).reduce((a, r) => a + r[key], 0) / n;
const prod = DATA.production_overview;

// Production: the mock's production overview. Its cohorts are not in the
// snapshot (the mock shows "—"), so the cohort is null. same_day_last_week and
// languages are not in the snapshot either; they come from the Task 1 / 1b
// live production samples of the same day.
const production = () => ({
  generated_at: DATA.generated_at,
  timezone: DATA.tz,
  environment: "production",
  today: { active: prod.active_today },
  avg7: round2(lastDays(prod.dau_30d, 7, "dau")),
  daily: prod.dau_30d.map((d) => ({ day: d.day, active: d.dau })),
  cohort: null,
  versions: prod.versions_with_ui.map((v) => ({ platform: v.platform, app_version: v.app_version, ui: v.ui ?? "unknown", users: v.users })),
  dropped_7d: DATA.ingestion.filter((i) => i.environment === "production").slice(-7).reduce((a, i) => a + i.dropped, 0),
  same_day_last_week: { active: 1 },
  languages: [{ language: "fr", users: 25 }, { language: "en", users: 13 }],
});
// Development: the two test phones.
const finished = DATA.cohorts.weeks.filter((w) => w.window_7d_finished).at(-1);
const development = () => ({
  generated_at: DATA.generated_at,
  timezone: DATA.tz,
  environment: "development",
  today: { active: DATA.activity.today.phones },
  avg7: DATA.activity.avg7_distinct_phones,
  daily: DATA.activity.days.map((d) => ({ day: d.day, active: d.phones_opened })),
  cohort: { install_week: finished.install_week, installed: finished.installed, back_7d: finished.back_7d },
  versions: DATA.versions.map((v) => ({ platform: v.platform, app_version: v.app_version, ui: v.ui.startsWith("none") ? "unknown" : v.ui, users: v.phones.length })),
  dropped_7d: 0,
  same_day_last_week: { active: DATA.activity.days.at(-8).phones_opened },
  languages: [],
});
const zeroUsage = (environment = "production") => ({
  ...production(),
  environment,
  today: { active: 0 },
  avg7: 0,
  daily: prod.dau_30d.map((d) => ({ day: d.day, active: 0 })),
  cohort: null,
  versions: [],
  dropped_7d: 0,
  same_day_last_week: { active: 0 },
  languages: [],
});

const todo = DATA.todo;
const queueBodies = (zero = false) => ({
  "admin-feedback": {
    items: zero ? [] : todo.feedback.newest.map((f, i) => ({ id: `f${i}`, device_id: "d", category: f.category, message: f.message_80, email: "", app_version: "1.3.0", platform: "ios", locale: "fr", resolved: false, resolved_at: null, resolved_by: null, created_at: f.created_at })),
    total: zero ? 0 : todo.feedback.open,
    summary: { total: 9, open: zero ? 0 : todo.feedback.open, resolved: 6, last_7_days: 1, by_category: { bug: 1, suggestion: 1, compliment: 1, charger_data: 0, other: 0 } },
  },
  "admin-confirmations": {
    items: zero ? [] : todo.could_not_charge_7d.newest.map((v, i) => ({ id: `v${i}`, charger_id: "c1", charger_name: v.charger, charger_city: "La Marsa", user_id: "u1", outcome: "could_not_charge", reason: v.reason, connector_type: v.connector_type, visit_date: v.submitted_at.slice(0, 10), submitted_at: v.submitted_at, hidden_at: null, hidden_reason: null })),
    page: 1, perPage: 3, total: zero ? 0 : todo.could_not_charge_7d.count,
    summary: { total: 12, charged: 9, could_not_charge: 3, hidden: 0, last_7_days: 2, contributors: 4, window: { since_days: 7, could_not_charge: zero ? 0 : todo.could_not_charge_7d.count } },
  },
  "admin-submissions": { items: [], page: 1, perPage: 3, total: todo.community_submissions.pending, counts: { pending: todo.community_submissions.pending, approved: 4, rejected: 2 } },
  "admin-review-reports": { items: [], page: 1, perPage: 3, total: todo.review_reports.unresolved, open: todo.review_reports.unresolved },
});

// ---- harness ----
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || "chrome" });
let checks = 0;
const ok = (cond, msg, extra) => { assert.ok(cond, extra === undefined ? msg : `${msg}: ${JSON.stringify(extra)}`); checks += 1; console.log(`PASS ${msg}`); };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks += 1; console.log(`PASS ${msg}`); };
const errors = [];

/** `server` is read on every request, so a test can change answers mid-run. */
const open = async ({ width = 390, height = 844, colorScheme = "light", server, rtl = false, scale = 1 } = {}) => {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme, deviceScaleFactor: scale });
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
  await context.route("**/rest/v1/**", (route) => route.fulfill({ json: [], headers: { "content-range": "*/0" } }));
  const requests = [];
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
      if (server.delay?.[environment]) await new Promise((r) => setTimeout(r, server.delay[environment]));
      return route.fulfill({ json: server.usage(environment) });
    }
    if (server.fail?.includes(name)) return route.fulfill({ status: 500, json: { error: "boom" } });
    const body = server.queue[name];
    return body ? route.fulfill({ json: body }) : route.fulfill({ json: {} });
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  return { context, page, requests };
};

const hscroll = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
// "Label value unit" as seen (TickNumber also carries a screen-reader copy of the value).
const legend = (page) => page.$$eval(".ui-legend > *", (els) => els.map((e) => {
  const b = e.querySelector("b");
  const value = b.querySelector(".ui-num")?.textContent ?? [...b.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("");
  return `${e.querySelector("small").textContent} ${value} ${b.querySelector("em").textContent}`;
}));
// Visible text of a hero value, without the screen-reader copy.
const hero = (page, sel) => page.$eval(`${sel} .ui-val`, (v) => {
  const b = v.querySelector("b");
  return `${b.querySelector(".ui-num")?.textContent ?? b.textContent} ${v.querySelector(":scope > span")?.textContent ?? ""}`.trim();
});
const rows = (page) => page.$$eval("#card-needs .ui-rows li", (els) => els.map((li) => ({
  title: li.querySelector(".ui-row-t").textContent,
  detail: li.querySelector(".ui-row-d")?.textContent ?? "",
  bubble: li.querySelector(".ui-bub")?.textContent ?? null,
  zero: !!li.querySelector(".ui-bub-zero"),
  href: li.querySelector("a")?.getAttribute("href") ?? null,
})));
// Fill of each continuous arc (1 = closed), by ring order among the continuous ones.
const arcs = (page) => page.$$eval(".ui-rings .ui-ring-arc", (els) => els.map((c) => {
  const len = parseFloat(c.getAttribute("stroke-dasharray"));
  return +(1 - parseFloat(c.getAttribute("stroke-dashoffset")) / len).toFixed(4);
}));
// A whole-page shot with the fixed tab bar at the bottom: grow the viewport to the page first.
const shot = async (page, name) => {
  const { width, height } = page.viewportSize();
  await page.setViewportSize({ width, height: await page.evaluate(() => document.documentElement.scrollHeight) });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${output}/${name}` });
  await page.setViewportSize({ width, height });
};
const square = (page, card) => page.$eval(`${card} .ui-sq`, (q) => q.getAttribute("style") ?? "");
// Every card's content stays inside it: no element pokes out, no text is cut
// off (one-line ellipsis rows aside), and the Today legend keeps its room.
const fits = (page) => page.evaluate(() => {
  const bad = [];
  for (const card of document.querySelectorAll(".sum .ui-card, .sum .sum-warn")) {
    const c = card.getBoundingClientRect();
    const name = card.querySelector("h2")?.textContent ?? card.className;
    for (const el of card.querySelectorAll("*")) {
      if (el.closest(".ui-sr") || el.closest("svg")) continue;
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      if (r.left < c.left - 0.5 || r.right > c.right + 0.5) bad.push(`${name}: ${el.className || el.tagName} pokes out`);
      const cs = getComputedStyle(el);
      if (cs.display === "inline" || cs.textOverflow === "ellipsis" || el.scrollWidth <= el.clientWidth + 1) continue;
      // Content wider than its box: cut off when the box clips it, or when it runs past the card
      // (where the next card paints over it). A row's hover bleed inside the card padding is fine.
      const clipped = cs.overflowX !== "visible";
      const runsOut = r.left + el.scrollWidth > c.right + 0.5;
      if (clipped || runsOut) bad.push(`${name}: ${el.className || el.tagName} is cut off`);
    }
  }
  const legend = document.querySelector(".ui-legend")?.getBoundingClientRect().width ?? 0;
  if (legend < 140) bad.push(`legend only ${Math.round(legend)}px`);
  const cards = [...document.querySelectorAll(".sum-grid > .ui-card")].map((x) => Math.round(x.getBoundingClientRect().x));
  const rings = document.querySelector(".ui-rings svg")?.getBoundingClientRect();
  const beside = !!rings && document.querySelector(".ui-legend").getBoundingClientRect().top < rings.bottom;
  return { bad, columns: new Set(cards).size, legend: Math.round(legend), beside };
});
const settle = (page) => page.waitForTimeout(1600); // rings 1.2s, numbers 0.7s
const LINKS = [
  "#/community?tab=feedback&status=open",
  "#/community?tab=visits&outcome=could_not_charge&since=7",
  "#/community?tab=submissions&status=pending",
  "#/community?tab=reviews&reports=open",
];

try {
  // ---- 1. An all-zero report: no NaN, rings empty, "Nothing waiting" ----
  {
    const server = { usage: (env) => zeroUsage(env), queue: queueBodies(true) };
    const { context, page } = await open({ server, scale: 2 });
    await page.goto(`${base}/#/summary`);
    await page.waitForSelector(".ui-rings");
    await settle(page);
    const text = await page.locator(".sum").innerText();
    ok(!/NaN|undefined|Infinity|null/.test(text), "zero: no NaN, undefined or Infinity anywhere");
    eq(await legend(page), ["Active 0 goal 1 (7-day avg)", "Came back — no full week yet", "Queue clear 0 nothing waiting"], "zero: legend reads 0 / — / nothing waiting");
    eq(await page.locator(".ui-ring-tick").count(), 0, "zero: the Active ring lights no tick");
    const fill = await arcs(page);
    ok(fill[0] < 0.001, "zero: the Came back ring is empty (a dot)", fill);
    ok(fill[1] === 1, "zero: Queue clear closes at 0 waiting", fill);
    const r = await rows(page);
    eq(r.map((x) => x.detail), ["Nothing waiting", "Nothing waiting", "Nothing waiting", "Nothing waiting"], "zero: every Needs-you row says Nothing waiting");
    ok(r.every((x) => x.zero && x.bubble === "0"), "zero: zero bubbles, never coloured", r);
    eq(await page.locator("#card-needs .ui-meta").innerText(), "0 waiting", "zero: Needs you meta");
    eq(await page.locator(".sum-hl").innerText(), "", "zero: no highlight sentence when both days are 0 (its line stays)");
    eq(await hero(page, "#card-active"), "0.0 avg / day, last 7 days", "zero: 0.0 avg / day, named for its window");
    eq(await page.locator("#card-active .ui-bars i").count(), 30, "zero: 30 bars");
    eq(await page.locator("#card-active .ui-bars i.ui-bar-zero").count(), 30, "zero: every day is a Fill stub");
    ok((await page.locator("#card-back").innerText()).includes("Fills in once an install week has had its 7 days"), "zero: Came back explains when it fills in");
    ok((await square(page, "#card-back")).includes("--c-idle-fill"), "zero: the Came back square goes Idle Grey with no cohort");
    ok((await page.getByText("No one opened the app in the last 30 days.").count()) === 1, "zero: Versions empty state");
    eq(await page.locator(".sum-warn").count(), 0, "zero: no dropped warning");
    eq(await page.locator(".ui-nav-badge").count(), 0, "zero: no Community badge");
    eq(await hscroll(page), 0, "zero: no horizontal scroll at 390");
    await shot(page, "t7-390-empty.png");
    await context.close();
  }

  // ---- 2. The mock's snapshot: real numbers, 390 / 1440, light / dark ----
  for (const [width, height] of [[390, 844], [1440, 900]]) {
    for (const colorScheme of ["light", "dark"]) {
      const server = { usage: (env) => (env === "development" ? development() : production()), queue: queueBodies() };
      const { context, page, requests } = await open({ width, height, colorScheme, server, scale: 2 });
      await page.goto(`${base}/#/summary`);
      await page.waitForSelector(".ui-rings");
      await settle(page);
      const tag = `${width} ${colorScheme}`;
      if (width === 390 && colorScheme === "light") {
        ok(requests.includes("admin-usage?view=summary&days=30&environment=production"), "snapshot: production by default", requests);
        for (const q of ["admin-feedback?status=open", "admin-confirmations?since_days=7&outcome=could_not_charge", "admin-submissions?status=pending", "admin-review-reports?status=open"]) {
          ok(requests.some((x) => x.startsWith(q)), `snapshot: queue reads ${q}`);
        }
        eq(await page.locator(".ui-lt p").innerText(), "Monday 2 November", "snapshot: the date is the report's Tunis day");
        eq(await page.locator(".sum-hl").innerText(), "1 active phone today, same as last Monday.", "snapshot: highlight sentence");
        eq(await legend(page), ["Active 1 goal 3 (7-day avg)", "Came back — no full week yet", "Queue clear 4 waiting"], "snapshot: legend values");
        eq(await page.locator(".ui-ring-tick").count(), 1, "snapshot: Active is 3 ticks with 1 lit (goal round(3.43))");
        eq(await page.$$eval(".ui-rings svg > g", (g) => g.length), 3, "snapshot: Active ring drawn as 3 segments");
        const fill = await arcs(page);
        ok(fill.every((f) => f < 0.001), "snapshot: Came back empty, Queue open (4 waiting)", fill);
        const r = await rows(page);
        eq(r.map((x) => [x.title, x.bubble, x.detail]), [
          ["Open feedback", "3", "“Test du merci - revue Lune” · 1d ago"],
          ["Couldn't charge", "1", "Carrefour Marsa · 1d ago"],
          ["Charger submissions", "0", "Nothing waiting"],
          ["Review reports", "0", "Nothing waiting"],
        ], "snapshot: Needs-you rows");
        eq(r.map((x) => x.href), LINKS, "snapshot: each row links to its Community tab");
        eq(await page.locator("#card-needs .ui-meta").innerText(), "4 waiting", "snapshot: Needs you meta");
        eq(await page.locator(".ui-tabs .ui-nav-badge").innerText(), "4", "snapshot: Community tab badge is the queue total");
        eq(await hero(page, "#card-active"), "3.4 avg / day, last 7 days", "snapshot: 3.4 avg / day, last 7 days (the 7-day average, not the 30 days)");
        eq(await page.locator("#card-active .ui-bars").getAttribute("aria-label"), "Phones that opened the app per day, last 30 days: 1 phone today, 3.4 a day over the last 7 days, peak 6.", "snapshot: the sparkline's label carries its numbers");
        eq(await page.locator("#card-active .ui-bars i:not(.ui-bar-zero)").count(), prod.dau_30d.filter((d) => d.dau).length, "snapshot: a bar per day with phones");
        eq(await page.locator("#card-active .ui-ax").innerText(), "4 Oct\nToday", "snapshot: axis from 4 Oct to Today");
        eq(await page.locator("#card-active").getAttribute("href"), "#/usage?env=production", "snapshot: Active phones opens Usage for the same data");
        eq(await page.$$eval(".sum-vers li", (li) => li.map((l) => `${l.querySelector("span").firstChild.textContent} [${l.querySelector(".ui-pill").textContent}] ${l.querySelector("em").textContent}`)), ["Android 1.2.1 [no label] 19 users", "iOS 1.2.1 [no label] 19 users"], "snapshot: versions");
        eq(await page.locator(".ui-card", { hasText: "Versions in use" }).locator(".ui-meta").innerText(), "2 versions", "snapshot: 2 versions");
        eq((await page.locator(".sum-lang").innerText()).replace(/\s+/g, " "), "Users per language FR 25 · AR 0 · EN 13", "snapshot: users per language, counts only");
        ok(!/%/.test(await page.locator(".sum").innerText()), "snapshot: no percentage anywhere (every group is under 10 or a count)");
      }
      if (width === 1440) {
        eq(await page.locator(".ui-side .ui-nav-badge").innerText(), "4", `${tag}: sidebar Community badge`);
        const [today, needs] = await Promise.all([page.locator(".ui-card").nth(0).boundingBox(), page.locator("#card-needs").boundingBox()]);
        ok(Math.abs(today.y - needs.y) < 1 && needs.x > today.x, `${tag}: Needs you sits beside the rings`, { today, needs });
      }
      eq(await hscroll(page), 0, `${tag}: no horizontal scroll`);
      const fit = await fits(page);
      ok(fit.bad.length === 0, `${tag}: every card's content fits inside it`, fit);
      await shot(page, `t7-${width}-${colorScheme}.png`);
      await context.close();
    }
  }

  // ---- 3. Environment switch, ring taps, links ----
  {
    const server = { usage: (env) => (env === "development" ? development() : production()), queue: queueBodies(), delay: { development: 1200 } };
    const { context, page, requests } = await open({ server });
    await page.goto(`${base}/#/summary`);
    await page.waitForSelector(".ui-rings");
    await settle(page);
    const tall = await page.evaluate(() => document.querySelector(".sum-grid").offsetHeight);
    await page.locator(".ui-seg button", { hasText: "Development" }).click();
    await page.waitForFunction(() => document.querySelector(".ui-card .ui-meta")?.textContent === "development");
    // While the development report loads: the same five cards, no numbers from production.
    eq(await page.locator(".sum-grid > .ui-card").count(), 5, "env: the card shells stay while the report loads");
    eq(await page.$$eval("#card-active .sum-wait, #card-back .sum-wait", (w) => w.map((x) => x.textContent)), ["Loading…", "Loading…"], "env: the cards say Loading…");
    eq(await page.locator(".sum .ui-rings, .sum .ui-val, .sum .ui-bars, .sum .sum-vers").count(), 0, "env: never the previous environment's numbers");
    const loadingTall = await page.evaluate(() => document.querySelector(".sum-grid").offsetHeight);
    ok(loadingTall >= tall * 0.85, "env: the page keeps its height while loading", { tall, loadingTall });
    await page.waitForSelector(".ui-rings");
    await settle(page);
    ok((await page.evaluate(() => location.hash)) === "#/summary?env=development", "env: the choice is in the URL");
    ok(requests.includes("admin-usage?view=summary&days=30&environment=development"), "env: the report is asked for that environment");
    eq(await legend(page), ["Active 2 goal 1 (7-day avg)", "Came back 1 of 1 in 7 days", "Queue clear 4 waiting"], "env: test-phone numbers (goal round(1.0) = 1, 1 of 1 came back)");
    eq(await page.locator(".ui-ring-tick").count(), 2, "env: 1 of 1 is one lit tick, never a closed ring");
    ok((await page.locator("#card-back").innerText()).includes("Counts only, since under 10 installs"), "env: Came back says why it shows counts");
    eq(await hero(page, "#card-back"), "1 of 1", "env: Came back 1 of 1");
    eq(await page.$$eval(".sum-vers li", (li) => li.length), 4, "env: four test-phone builds");
    eq(await page.locator("#card-active").getAttribute("href"), "#/usage?env=development", "env: the cards keep the environment");
    await page.reload();
    await page.waitForSelector(".ui-rings");
    eq(await page.locator(".ui-seg button[aria-pressed=true]").innerText(), "Development", "env: survives a reload");

    // Ring legend and arcs scroll to their card.
    await page.locator(".ui-legend button", { hasText: "Queue clear" }).click();
    await page.waitForTimeout(900);
    const inView = (sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }, sel);
    ok(await inView("#card-needs"), "tap: Queue clear brings Needs you into view");
    await page.evaluate(() => scrollTo(0, 0));
    await page.locator(".ui-legend button", { hasText: "Came back" }).click();
    await page.waitForTimeout(900);
    ok(await inView("#card-back"), "tap: Came back brings its card into view");

    // A row opens its Community tab; coming back reloads the queue.
    const before = requests.filter((x) => x.startsWith("admin-feedback")).length;
    await page.locator("#card-needs a", { hasText: "Open feedback" }).click();
    ok((await page.evaluate(() => location.hash)) === "#/community?tab=feedback&status=open", "link: Open feedback lands on its tab");
    await page.waitForSelector(".sum", { state: "detached" });
    await page.goBack();
    await page.waitForSelector(".ui-rings");
    await page.waitForTimeout(500);
    ok(requests.filter((x) => x.startsWith("admin-feedback")).length > before, "link: the queue reloads after a page change", { before, requests });
    eq(await hscroll(page), 0, "env: no horizontal scroll");
    await context.close();
  }

  // ---- 3b. Narrow and middle widths: 768 (sidebar + one column) and 1024 ----
  {
    const big = () => ({
      ...production(),
      today: { active: 1234 },
      daily: production().daily.map((d) => ({ ...d, active: d.active * 300 })),
      cohort: { install_week: "2026-10-19", installed: 1234, back_7d: 1000 },
      versions: [{ platform: "android", app_version: "1.10.12", ui: "classic", users: 12345 }, ...production().versions],
      dropped_7d: 12345,
      languages: [{ language: "fr", users: 12345 }, { language: "ar", users: 2345 }, { language: "en", users: 345 }],
    });
    const many = { ...queueBodies(), "admin-review-reports": { items: [], page: 1, perPage: 3, total: 1234, open: 1234 } };
    for (const [width, fixture, queue] of [[375, production, queueBodies()], [375, big, many], [768, production, queueBodies()], [1024, production, queueBodies()], [1100, production, queueBodies()], [768, big, many], [1024, big, many], [1100, big, many]]) {
      const server = { usage: fixture, queue };
      const { context, page } = await open({ width, height: 1000, server });
      await page.goto(`${base}/#/summary`);
      await page.waitForSelector(".ui-rings");
      await settle(page);
      const tag = `${width} ${fixture === big ? "4-digit numbers" : "snapshot"}`;
      const fit = await fits(page);
      ok(fit.bad.length === 0, `${tag}: every card's content fits inside it`, fit);
      eq(fit.columns, width >= 1100 ? 2 : 1, `${tag}: ${width >= 1100 ? "two columns" : "one column, too narrow to pair cards"}`);
      ok(fit.beside, `${tag}: the legend sits beside the rings`, fit);
      eq(await hscroll(page), 0, `${tag}: no horizontal scroll`);
      if (width === 768 && fixture === production) await shot(page, "t7-768-light.png");
      await context.close();
    }
  }

  // ---- 3c. Came back with 10 or more installs: a percentage with its count ----
  {
    const server = { usage: () => ({ ...production(), cohort: { install_week: "2026-10-19", installed: 12, back_7d: 3 } }), queue: queueBodies() };
    const { context, page } = await open({ server });
    await page.goto(`${base}/#/summary`);
    await page.waitForSelector(".ui-rings");
    await settle(page);
    eq((await legend(page))[1], "Came back 3 of 12 in 7 days", "12 installs: the legend keeps counts");
    eq(await hero(page, "#card-back"), "25% 3 of 12", "12 installs: the card shows the percentage with its count");
    ok(!(await page.locator("#card-back").innerText()).includes("Counts only"), "12 installs: no small-sample note");
    ok((await square(page, "#card-back")).includes("--c-came-back-fill"), "12 installs: the square is Came back green");
    eq(await page.$$eval(".ui-rings svg > g", (g) => g.length), 3, "12 installs: only Active is segmented (goal 3)");
    const fill = await arcs(page);
    ok(fill.length === 2 && Math.abs(fill[0] - 0.25) < 0.001, "12 installs: Came back is a continuous ring at 3/12", fill);
    await context.close();
  }

  // ---- 4. Dropped events ----
  {
    const server = { usage: () => ({ ...production(), dropped_7d: 12 }), queue: queueBodies() };
    const { context, page } = await open({ width: 1440, height: 900, server });
    await page.goto(`${base}/#/summary`);
    await page.waitForSelector(".sum-warn");
    await settle(page);
    eq(await page.locator(".sum-warn").innerText(), "12 events dropped in the last 7 days: the ingestion cap was hit, so this week's numbers run low.", "dropped: a warning only when the cap was hit");
    await page.screenshot({ path: `${output}/t7-1440-dropped.png` });
    await context.close();
  }

  // ---- 5. Errors: the report fails; one queue source fails ----
  {
    const server = { usage: () => production(), usageStatus: 503, queue: queueBodies(), fail: ["admin-review-reports"] };
    const { context, page } = await open({ server });
    await page.goto(`${base}/#/summary`);
    await page.getByText("Couldn't load today's numbers.", { exact: false }).waitFor();
    ok((await page.locator(".ui-card").first().innerText()).includes("Usage reporting is unavailable right now."), "error: the report error is said plainly");
    eq(await page.$$eval("#card-active, #card-back, .ui-card:has(.sum-wait-versions)", (c) => c.map((x) => x.querySelector(".sum-wait")?.textContent)), ["Couldn't load.", "Couldn't load.", "Couldn't load."], "error: the usage cards stay, saying they couldn't load");
    eq(await page.locator(".sum .ui-val, .sum .ui-bars, .sum .sum-vers").count(), 0, "error: no numbers drawn from nothing");
    await page.waitForSelector("#card-needs .ui-bub");
    const r = await rows(page);
    eq([r[3].detail, r[3].bubble], ["Couldn't load", null], "error: a failed source is not a zero");
    eq(r.slice(0, 3).map((x) => x.bubble), ["3", "1", "0"], "error: the other sources still show");
    eq(await page.locator("#card-needs .ui-meta").count(), 0, "error: no total while a source is unknown");
    eq(await page.locator(".ui-nav-badge").count(), 0, "error: no badge while a source is unknown");
    ok((await page.locator("#card-needs .sum-retry").innerText()).includes("Try again"), "error: Needs you offers a retry");
    server.usageStatus = 0;
    server.fail = [];
    await page.locator(".ui-card").first().getByRole("button", { name: "Try again" }).click();
    await page.waitForSelector(".ui-rings");
    ok(true, "error: Try again loads the report");
    await page.locator("#card-needs").getByRole("button", { name: "Try again" }).click();
    await page.waitForFunction(() => document.querySelector("#card-needs .ui-meta")?.textContent === "4 waiting");
    ok(true, "error: Try again reloads the queue");
    await page.waitForTimeout(1500);
    eq((await legend(page))[2], "Queue clear 4 waiting", "error: the queue ring fills in once known");
    await context.close();
  }

  // ---- 6. RTL ----
  {
    const server = { usage: () => production(), queue: queueBodies() };
    const { context, page } = await open({ server, rtl: true });
    await page.goto(`${base}/#/summary`);
    await page.waitForSelector(".ui-rings");
    await settle(page);
    eq(await hscroll(page), 0, "rtl: no horizontal scroll at 390");
    const geo = await page.evaluate(() => {
      const row = document.querySelector("#card-needs .ui-row").getBoundingClientRect();
      const bub = document.querySelector("#card-needs .ui-bub").getBoundingClientRect();
      const svg = document.querySelector(".ui-rings svg").getBoundingClientRect();
      const lg = document.querySelector(".ui-legend").getBoundingClientRect();
      return { bubbleAtEnd: bub.left - row.left < row.right - bub.right, legendStart: lg.right <= svg.left };
    });
    ok(geo.bubbleAtEnd, "rtl: bubbles sit at the inline end (left)", geo);
    ok(geo.legendStart, "rtl: the rings lead from the inline start (right)", geo);
    eq(await page.$$eval("#card-needs .ui-row-d bdi", (b) => b.map((x) => x.textContent)), ["“Test du merci - revue Lune”", "Carrefour Marsa"], "rtl: drivers' text is isolated in <bdi>");
    await page.screenshot({ path: `${output}/t7-390-rtl.png` });
    await context.close();
  }

  ok(errors.length === 0, "no page or console errors", errors);
  console.log(`\n${checks} checks passed`);
} finally {
  await browser.close();
}
