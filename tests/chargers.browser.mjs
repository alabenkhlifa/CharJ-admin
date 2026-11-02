// Chargers (list, map, About the network, detail drawer) on mocked Supabase
// and admin functions, headless. Run against a local Vite server started with
// fake Supabase values, e.g.
//   VITE_SUPABASE_URL=https://fake.supabase.test VITE_SUPABASE_ANON_KEY=fake \
//     npx vite --port 5181 --strictPort &
//   CHARGERS_URL=http://localhost:5181 PLAYWRIGHT_MODULE=<…>/playwright/index.mjs \
//     node tests/chargers.browser.mjs
// Google Maps is never loaded (its script is aborted): the map checks assert
// the container, its width and its overlays, not tiles. The Maps loader logs
// "could not load" when its script is aborted; that one console message is
// expected and ignored. Everything else is in-memory: actions change what the
// next read returns. This suite never reaches a real backend.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.CHARGERS_URL || "http://localhost:5181";
const output = process.env.CHARGERS_ARTIFACTS || "/tmp/charj-chargers-browser";
await mkdir(output, { recursive: true });

// ---- fixtures ----
const NOW = Date.parse("2026-11-02T10:00:00Z"); // a Monday, 11:00 in Tunis
const GOVS = [
  ["TN-11", "Tunis"], ["TN-12", "Ariana"], ["TN-13", "Ben Arous"], ["TN-14", "Manouba"], ["TN-21", "Nabeul"], ["TN-22", "Zaghouan"],
  ["TN-23", "Bizerte"], ["TN-31", "Béja"], ["TN-32", "Jendouba"], ["TN-33", "Le Kef"], ["TN-34", "Siliana"], ["TN-41", "Kairouan"],
  ["TN-42", "Kasserine"], ["TN-43", "Sidi Bouzid"], ["TN-51", "Sousse"], ["TN-52", "Monastir"], ["TN-53", "Mahdia"], ["TN-61", "Sfax"],
  ["TN-71", "Gafsa"], ["TN-72", "Tozeur"], ["TN-73", "Kébili"], ["TN-81", "Gabès"], ["TN-82", "Médenine"], ["TN-83", "Tataouine"],
].map(([code, name_fr]) => ({ code, name_fr, name_ar: "", name_en: name_fr }));
const cid = (n) => `c1000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CITIES = [
  { id: cid(1), slug: "la-marsa", governorate_code: "TN-11", name_fr: "La Marsa", name_ar: "المرسى", name_en: "La Marsa" },
  { id: cid(2), slug: "hammamet", governorate_code: "TN-21", name_fr: "Hammamet", name_ar: "الحمامات", name_en: "Hammamet" },
  { id: cid(3), slug: "sousse", governorate_code: "TN-51", name_fr: "Sousse", name_ar: "سوسة", name_en: "Sousse" },
  { id: cid(4), slug: "sfax", governorate_code: "TN-61", name_fr: "Sfax", name_ar: "صفاقس", name_en: "Sfax" },
  { id: cid(5), slug: "ariana", governorate_code: "TN-12", name_fr: "Ariana Ville", name_ar: "أريانة المدينة", name_en: "Ariana" },
  { id: cid(6), slug: "djerba", governorate_code: "TN-82", name_fr: "Djerba Houmt Souk", name_ar: "جربة حومة السوق", name_en: "Djerba" },
];
const chargerId = (n) => `ee000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const STATUSES = ["operational", "operational", "operational", "under_repair", "planned", "unknown"];
const ACCESS = ["public", "public", "customers_only", "brand_exclusive", "employees_only"];
const CONNS = [
  [{ type: "Type 2", power_kw: 22, count: 2 }],
  [{ type: "CCS", power_kw: 60, count: 1 }, { type: "Type 2", power_kw: 22, count: 1 }],
  [{ type: "CCS", power_kw: 150, count: 2 }],
  [{ type: "CHAdeMO", power_kw: 50, count: 1 }, { type: "CCS", power_kw: 50, count: 1 }],
  [{ type: "Type 2", power_kw: 11, count: 4 }],
  [{ type: "CCS", power_kw: 120, count: 1 }],
];
const WEEK = (from, to) => Object.fromEntries(["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => [d, [{ from, to }]]));
/** n chargers with every status, access, connector and city shape, plus hand-written edge cases. */
const makeChargers = (n) => {
  const rows = [];
  for (let i = 1; i <= n; i += 1) {
    const city = i % 7 === 0 ? null : CITIES[i % CITIES.length];
    rows.push({
      id: chargerId(i),
      name: `Borne ${String(i).padStart(2, "0")} ${["Shell", "Total", "Agil", "Ennakl", "Carrefour", "Hôtel"][i % 6]}`,
      name_ar: "", name_fr: "",
      latitude: 33 + (i % 10) * 0.4, longitude: 9 + (i % 5) * 0.4,
      address: i % 3 ? `Avenue ${i}` : "", address_ar: i % 4 === 0 ? `شارع ${i}` : "",
      city: city ? city.name_fr : "Nabeul", city_id: city ? city.id : null,
      highway_direction: null, operator: "", status: STATUSES[i % STATUSES.length], source: ["ocm", "curated", "community"][i % 3],
      ocm_id: i % 3 === 0 ? 300000 + i : null, access_type: ACCESS[i % ACCESS.length], connectors: CONNS[i % CONNS.length],
      working_hours: i % 2 ? { weekly: WEEK("00:00", "24:00") } : i % 4 === 0 ? { weekly: { ...WEEK("08:00", "18:00"), sun: [] } } : null,
      exclusive_to: [], amenities: i % 5 === 0 ? ["wifi", "cafe", "toilets"] : [], photos: [], contact_id: null, contact_phone: null,
      is_verified: i % 3 === 0, verified_by: i % 3 === 0 ? "ala" : null, verified_at: i % 3 === 0 ? "2026-09-17T12:00:00Z" : null,
      manual_overrides: {}, created_at: "2026-04-01T12:00:00Z",
      updated_at: new Date(NOW - i * 2 * 86_400_000).toISOString(),
    });
  }
  // Edge cases: a long unbroken name, an Arabic name and address, no connectors.
  if (rows[1]) rows[1].name = "StationDeRechargeUltraRapideAutorouteA1SortieHammametSudNumeroDeux";
  if (rows[2]) {
    rows[2].name = "محطة شحن المرسى الكبرى";
    rows[2].address_ar = "شارع الحبيب بورقيبة، المرسى، تونس العاصمة، قرب محطة القطار";
  }
  if (rows[4]) rows[4].connectors = [];
  return rows;
};
const readerRow = (c) => {
  const city = CITIES.find((v) => v.id === c.city_id);
  const gov = GOVS.find((g) => g.code === city?.governorate_code);
  return {
    ...c,
    city_fr: city?.name_fr ?? null, city_ar: city?.name_ar ?? null, city_en: city?.name_en ?? null,
    governorate_code: gov?.code ?? null, governorate_fr: gov?.name_fr ?? null, governorate_ar: gov?.name_ar ?? null, governorate_en: gov?.name_en ?? null,
  };
};
const UPDATE_ID = "f1000000-0000-4000-8000-000000000001";
const suggestion = (row) => ({
  update_event_id: UPDATE_ID, charger_id: row.id, charger_name: row.name, occurred_at: new Date(NOW - 3_600_000).toISOString(),
  changed_fields: ["status"], before: { status: "under_repair" }, after: { status: "operational" }, update_class: "back_in_service",
  governorate_code: "TN-11", governorate_name_fr: "Tunis", governorate_name_ar: "تونس", governorate_name_en: "Tunis",
  recipient_estimate: 12, push_estimate: 7,
});
const overview = (S, chargerId) => ({
  pending: [],
  suggestions: S.suggestions.filter((s) => !chargerId || s.charger_id === chargerId),
  history: [],
  subscribers: [],
  totals: { region_followers: 0, region_follows: 0, active_devices: 0, users_with_push: 0, pending: 0, suggestions: S.suggestions.length, batches: 0, announcements_24h: 0, quiet_now: false },
  funnel: null,
  server_time: new Date(NOW).toISOString(),
  ...(chargerId ? { charger_id: chargerId } : {}),
});
const preview = () => ({
  kind: "charger_updated", update_class: "back_in_service", charger_id: chargerId(1), url: `/charger/${chargerId(1)}`,
  previews: {
    fr: { title: "Borne de nouveau en service", body: "Elle fonctionne à nouveau." },
    ar: { title: "عادت المحطة للخدمة", body: "تعمل من جديد." },
    en: { title: "Charger back in service", body: "It is working again." },
  },
  recipient_estimate: 12, push_estimate: 7, estimate_scope: "region_and_charger",
});

// ---- harness ----
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || "chrome" });
let checks = 0;
const ok = (cond, msg, extra) => { assert.ok(cond, extra === undefined ? msg : `${msg}: ${JSON.stringify(extra)}`); checks += 1; console.log(`PASS ${msg}`); };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks += 1; console.log(`PASS ${msg}`); };
const errors = [];

const open = async ({ width = 390, height = 844, colorScheme = "light", n = 40, rtl = false, scale = 1, state = {} } = {}) => {
  const S = { rows: makeChargers(n), suggestions: [], posts: [], fail: false, rpcDelay: 0, govs: GOVS, ...state };
  const context = await browser.newContext({ viewport: { width, height }, colorScheme, deviceScaleFactor: scale, acceptDownloads: true });
  await context.clock.setFixedTime(NOW);
  await context.addInitScript(() =>
    localStorage.setItem("charj-admin-auth", JSON.stringify({
      access_token: "test.admin.session", refresh_token: "test-refresh", token_type: "bearer", expires_in: 3600, expires_at: 4102444800,
      user: { id: "a0000000-0000-4000-8000-000000000001", email: "admin@charj.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
    })),
  );
  if (rtl) await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => { document.documentElement.dir = "rtl"; }));
  await context.route("**/auth/v1/**", (route) => route.abort());
  // No Maps session in a test: the map is asserted by its container.
  await context.route("https://maps.googleapis.com/**", (route) => route.abort());
  const reads = [];
  await context.route("**/rest/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.split("/rest/v1/")[1];
    reads.push(path);
    if (path === "rpc/search_chargers") {
      if (S.rpcDelay) await new Promise((r) => setTimeout(r, S.rpcDelay));
      if (S.fail) {
        S.failed = true;
        return route.fulfill({ status: 500, json: { message: "search_chargers unavailable", code: "XX000" } });
      }
      return route.fulfill({ json: S.rows.map(readerRow) });
    }
    const json = path === "governorates" ? S.govs : path === "cities" ? CITIES : [];
    return route.fulfill({ json, headers: { "content-range": `0-${json.length}/${json.length}` } });
  });
  await context.route("**/functions/v1/**", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    const url = new URL(request.url());
    const name = url.pathname.split("/").pop();
    assert.equal(request.headers().authorization, "Bearer test.admin.session");
    const body = request.method() === "POST" ? request.postDataJSON() : null;
    if (body) S.posts.push({ name, body });
    const row = (id) => S.rows.find((r) => r.id === id);
    if (name === "admin-notifications") {
      if (request.method() === "GET") return route.fulfill({ json: overview(S, url.searchParams.get("charger_id")) });
      if (body.action === "preview") return route.fulfill({ json: preview() });
      S.suggestions = S.suggestions.filter((s) => s.update_event_id !== body.update_event_id);
      return route.fulfill({ json: { ok: true, result: {}, dispatch_requested: true } });
    }
    if (name === "admin-verify-charger") {
      const r = row(body.charger_id);
      Object.assign(r, { is_verified: true, verified_by: "admin@charj.test", verified_at: new Date(NOW).toISOString() });
      return route.fulfill({ json: { id: r.id, is_verified: true, verified_at: r.verified_at, verified_by: r.verified_by, name: r.name } });
    }
    if (name === "admin-set-charger-status") {
      const r = row(body.charger_id);
      r.status = body.status;
      return route.fulfill({ json: { id: r.id, status: r.status, name: r.name } });
    }
    if (name === "admin-update-charger" && request.method() === "GET") {
      return route.fulfill({ json: readerRow(row(url.searchParams.get("charger_id")) ?? S.rows[0]) });
    }
    return route.fulfill({ json: {} });
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  // Expected console errors only: the aborted Maps script (and the loader's
  // message about it), the aborted Auth calls, and the 500 a test asked for.
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    const url = m.location()?.url ?? "";
    if (/Failed to load resource/.test(text)) {
      if (/^https:\/\/maps\.googleapis\.com\//.test(url) || /\/auth\/v1\//.test(url)) return;
      if (S.failed && /\/rest\/v1\/rpc\/search_chargers/.test(url)) return;
    }
    if (/^The Google Maps JavaScript API (failed to load|could not load)/.test(text)) return;
    errors.push(`${text} (${url})`);
  });
  return { context, page, S, reads };
};

const hscroll = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const hashOf = (page) => page.evaluate(() => location.hash);
const hashParams = async (page) => Object.fromEntries(new URLSearchParams((await hashOf(page)).split("?")[1] ?? ""));
const ready = (page) => page.waitForFunction(() => !document.querySelector(".chg [aria-busy=true]") && !!document.querySelector(".chg .ui-card"));
const rowNames = (page) => page.$$eval(".chg-table tbody tr", (trs) => trs.map((tr) => tr.querySelector(".chg-c-name bdi").textContent));
const settle = (page) => page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))));
// A whole-page shot with the fixed tab bar at the bottom: grow the viewport to the page first.
const shot = async (page, name, { full = true } = {}) => {
  const { width, height } = page.viewportSize();
  if (full) await page.setViewportSize({ width, height: Math.max(height, Math.min(6000, await page.evaluate(() => document.documentElement.scrollHeight))) });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${output}/${name}` });
  if (full) await page.setViewportSize({ width, height });
};
// Copied from tests/summary.browser.mjs / community.browser.mjs: nothing pokes
// out of its card, the tab strip or the drawer, no text is cut off (one-line
// ellipsis aside); plus the drawer and any open menu inside the viewport.
const fits = (page) => page.evaluate(() => {
  const bad = [];
  const boxes = [...document.querySelectorAll(".chg .ui-card"), ...document.querySelectorAll(".chg-tabs a"), ...document.querySelectorAll(".chg-drawer")];
  for (const box of boxes) {
    const c = box.getBoundingClientRect();
    const name = box.querySelector("h2")?.textContent ?? box.textContent.slice(0, 20);
    for (const el of box.querySelectorAll("*")) {
      if (el.closest(".ui-sr") || el.closest("svg") || el.closest("details:not([open])") || el.closest(".chg-map > div:first-child")) continue;
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      if (r.left < c.left - 0.5 || r.right > c.right + 0.5) bad.push(`${name}: ${el.className || el.tagName} pokes out`);
      const cs = getComputedStyle(el);
      if (cs.display === "inline" || cs.textOverflow === "ellipsis" || el.tagName === "SELECT" || el.scrollWidth <= el.clientWidth + 1) continue;
      const clipped = cs.overflowX !== "visible";
      const runsOut = r.left + el.scrollWidth > c.right + 0.5;
      if (clipped || runsOut) bad.push(`${name}: ${el.className || el.tagName} is cut off`);
    }
  }
  const strip = document.querySelector(".chg-tabs")?.getBoundingClientRect();
  const page = document.querySelector(".chg")?.getBoundingClientRect();
  if (strip && page && (strip.left < page.left - 0.5 || strip.right > page.right + 0.5)) bad.push("the view tabs poke out of the page");
  for (const sel of [".chg-drawer", ".ms-pop", ".charger-editor"]) {
    const r = document.querySelector(sel)?.getBoundingClientRect();
    if (r && (r.left < -0.5 || r.right > innerWidth + 0.5)) bad.push(`${sel} leaves the viewport`);
  }
  return { bad };
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
      if ((bg[3] ?? 0) === 1 || bg.length === 3) break;
    }
    let color = document.documentElement.dataset.theme === "dark" ? [0, 0, 0, 1] : [255, 255, 255, 1];
    for (const layer of layers.reverse()) color = over(layer, color);
    return color;
  };
  const lum = ([r, g, b]) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  return [...document.querySelectorAll(sel)].filter((el) => el.getClientRects().length).map((el) => {
    const bg = behind(el);
    const fg = over(parse(getComputedStyle(el).color), bg);
    const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    return { text: el.textContent.trim().slice(0, 24), ratio: +((a + 0.05) / (b + 0.05)).toFixed(2) };
  });
}, selector);
const TEXT_SELECTORS = [
  ".chg-tabs a", ".ui-lt p", ".ms-label", ".ms-value", ".chg-sel > span", ".chg-sel select", ".chg-link", ".ui-btn",
  ".chg-table th", ".chg-c-city", ".chg-c-updated", ".chg-c-hours", ".chg-mark", ".chg-pill", ".ui-pager", ".ui-meta",
  ".chg-note", ".chg-lede", ".ui-val > span", ".ui-details summary", ".chg-count",
].join(", ");
// Measured at rest: the pointer parked off the rows, so no hover fade is mid-way.
const lowContrast = async (page, selector = TEXT_SELECTORS) => {
  await page.mouse.move(1, 1);
  await page.waitForTimeout(300);
  return (await contrasts(page, selector)).filter((c) => c.ratio < 4.5);
};

try {
  // ---- 1. List: filters, sort, search and page in the URL; reload lands on the same rows ----
  {
    const { context, page, reads } = await open({ width: 1440, height: 1000, scale: 2 });
    await page.goto(`${base}/#/chargers?status=operational,planned&sort=power:desc`);
    await ready(page);
    ok(reads.includes("rpc/search_chargers"), "list: the chargers come from search_chargers");
    eq(await page.locator(".ui-lt h1").innerText(), "Chargers", "list: large title");
    eq(await page.locator(".ui-lt p").innerText(), "40 chargers · 13 verified", "list: subtitle counts the catalogue and the verified");
    eq(await page.locator(".chg-tabs a[aria-current=page]").innerText(), "List", "list: the List view is current");
    eq(await page.locator(".chg-tabs a").evaluateAll((as) => as.map((a) => a.getAttribute("href"))), [
      "#/chargers?status=operational%2Cplanned&sort=power%3Adesc",
      "#/chargers?status=operational%2Cplanned&sort=power%3Adesc&view=map",
      "#/chargers?status=operational%2Cplanned&sort=power%3Adesc&view=stats",
    ], "list: view tabs keep the filters");
    const names = await rowNames(page);
    eq(names.length, 25, "list: 25 rows a page");
    const statusOf = await page.$$eval(".chg-table tbody tr .chg-c-status", (tds) => tds.map((t) => t.textContent));
    ok(statusOf.every((s) => s === "Operational" || s === "Planned"), "list: only operational and planned rows", statusOf);
    const powers = await page.$$eval(".chg-table tbody tr .chg-c-power b", (bs) => bs.map((b) => Number(b.textContent)));
    ok(powers.every((p, i) => i === 0 || p <= powers[i - 1]), "list: sorted by power, highest first", powers);
    eq(await page.locator("th[aria-sort=descending]").innerText(), "Power", "list: the Power header says it sorts descending");
    eq(await page.locator(".ms-chip", { hasText: "Status" }).locator(".ms-value").innerText(), "2 selected", "list: the Status chip reads the URL");
    eq(await page.locator("#chg-list .ui-meta").innerText(), "27 of 40", "list: the card counts what matches");
    eq(await page.locator(".ui-pager-range").innerText(), "1–25 of 27", "list: the pager counts the matches");

    // Tick Under repair: the URL gains it and the page resets.
    await page.goto(`${base}/#/chargers?status=operational,planned&sort=power:desc&page=2`);
    await ready(page);
    eq(await page.locator(".ui-pager-range").innerText(), "26–27 of 27", "list: ?page=2 opens the second page");
    await page.locator(".ms-chip", { hasText: "Status" }).click();
    await page.getByRole("group", { name: "Status" }).getByLabel("Under repair").check();
    await page.waitForFunction(() => location.hash.includes("under_repair"));
    let p = await hashParams(page);
    eq([p.status, p.page], ["operational,planned,under_repair", undefined], "list: a filter writes its param and goes back to page 1");
    const pop = await page.locator(".ms-pop").boundingBox();
    ok(pop.x >= 0 && pop.x + pop.width <= 1440, "list: the Status menu stays inside the viewport", pop);
    await page.keyboard.press("Escape");
    eq(await page.locator(".ms-pop").count(), 0, "list: Escape closes the menu");
    // A chip at the end of its row opens back toward the start.
    await page.locator(".ms-chip", { hasText: "City" }).click();
    const cityPop = await page.locator(".ms-pop").boundingBox();
    ok(cityPop.x >= 0 && cityPop.x + cityPop.width <= 1440, "list: the City menu stays inside the viewport", cityPop);
    await page.keyboard.press("Escape");

    // Search: debounced into ?q=, folded.
    await page.getByLabel("Search chargers", { exact: true }).fill("borne 1");
    await page.waitForFunction(() => location.hash.includes("q=borne"));
    p = await hashParams(page);
    eq(p.q, "borne 1", "list: search lands in ?q= after the debounce");
    ok((await rowNames(page)).every((n) => n.toLowerCase().startsWith("borne 1")), "list: search narrows the rows");
    eq(await page.locator("#chg-list h2").innerText(), "Matching chargers", "list: the card title says the rows are narrowed");
    // Power select.
    await page.getByRole("combobox", { name: "Power", exact: true }).selectOption("dc100");
    await page.waitForFunction(() => location.hash.includes("power=dc100"));
    ok((await page.$$eval(".chg-c-power b", (bs) => bs.map((b) => Number(b.textContent)))).every((kw) => kw >= 100 && kw < 150), "list: Power DC 100–150 kW narrows the rows");
    // Reload: the same rows.
    const before = await rowNames(page);
    await page.reload();
    await ready(page);
    eq(await rowNames(page), before, "list: a reload lands on the same rows");
    eq(await page.getByLabel("Search chargers", { exact: true }).inputValue(), "borne 1", "list: the search box reads the URL after a reload");
    // Clear.
    await page.getByRole("button", { name: /^Clear \d filters?$/ }).click();
    p = await hashParams(page);
    eq([p.q, p.status, p.power, p.sort], [undefined, undefined, undefined, "power:desc"], "list: Clear drops the search and filters, keeps the sort");
    eq(await page.locator("#chg-list .ui-meta").innerText(), "40", "list: 40 again");
    // Sort by a header.
    await page.locator("th", { hasText: "Name" }).locator("button").click();
    p = await hashParams(page);
    eq(p.sort, "name:asc", "list: a header click writes ?sort=");
    // Page size.
    await page.locator(".ui-pager select").selectOption("10");
    p = await hashParams(page);
    eq(p.per, "10", "list: rows per page lands in ?per=");
    eq(await page.locator(".chg-table tbody tr").count(), 10, "list: 10 rows");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    eq((await hashParams(page)).page, "2", "list: Next writes ?page=2");
    eq(await page.locator(".ui-pager-range").innerText(), "11–20 of 40", "list: the second page");
    // Export: the rows shown, in this order.
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export", exact: true }).click()]);
    const csv = await (await import("node:fs/promises")).readFile(await download.path(), "utf8");
    const lines = csv.replace(/^﻿/, "").split("\r\n");
    eq(lines[0].split(",").slice(0, 3), ["Name", "City", "Governorate"], "list: Export writes the CSV header");
    eq(lines.length, 41, "list: Export writes every matching row, not only the page");
    const sourceAt = lines[0].split(",").indexOf("Source");
    eq([...new Set(lines.slice(1).map((l) => l.split(",")[sourceAt]))].sort(), ["community", "curated", "ocm"], "list: Export keeps the raw source values");
    // Table rows show the facts.
    await page.goto(`${base}/#/chargers`);
    await ready(page);
    const row7 = page.getByRole("button", { name: "Open Borne 07 Total" });
    ok(/^Nabeul\s*no city$/.test(await row7.locator("td").nth(1).innerText()), "list: an unlinked charger keeps its text and says no city");
    ok((await page.getByRole("button", { name: "Open Borne 05 Hôtel" }).locator(".chg-c-power").innerText()).startsWith("—"), "list: no power listed reads —, never 0 kW");
    eq(await hscroll(page), 0, "list: no horizontal scroll at 1440");
    const bad = await lowContrast(page);
    ok(bad.length === 0, "list 1440 light: every text ≥ 4.5:1", bad);
    await context.close();
  }

  // ---- 2. ?id= opens the drawer; verify, status, announce; Escape closes ----
  {
    const { context, page, S } = await open({ width: 1440, height: 1000 });
    S.suggestions = [suggestion(S.rows[0])];
    const unverified = S.rows[0]; // Borne 01 Total: operational, not verified
    await page.goto(`${base}/#/chargers?status=operational&id=${unverified.id}`);
    await page.getByRole("heading", { name: unverified.name, exact: true }).waitFor();
    await page.waitForFunction(() => !location.hash.includes("id="));
    let p = await hashParams(page);
    eq([p.id, p.status], [undefined, "operational"], "drawer: ?id= opens it, then the id leaves the URL and the filters stay");
    const drawer = page.getByRole("complementary", { name: `${unverified.name}, charger details` });
    ok(await drawer.isVisible(), "drawer: a labelled side sheet");
    eq(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Close charger details", "drawer: focus moves into the sheet");
    eq(await page.locator(".chg-minimap").count(), 1, "drawer: the list view drawer has its mini map (the page's only map)");
    eq(await drawer.locator(".chg-days li[aria-current=date] span").innerText(), "Mon", "drawer: today (Monday in Tunis) is highlighted");
    eq(await drawer.getByText("Back in service", { exact: true }).count(), 1, "drawer: the announceable update shows");
    eq(await drawer.locator(".chg-announce-n").innerText(), "12 recipients · 7 with push", "drawer: the recipients estimate");
    // Verify.
    await drawer.getByRole("button", { name: "Verify", exact: true }).click();
    await drawer.getByText("Verified by admin@charj.test", { exact: true }).waitFor();
    eq(S.posts.find((x) => x.name === "admin-verify-charger").body, { charger_id: unverified.id }, "drawer: Verify posts the charger id");
    // Status.
    eq(await drawer.getByRole("button", { name: "Operational" }).getAttribute("aria-pressed"), "true", "drawer: the current status is pressed");
    await drawer.getByRole("button", { name: "Under repair" }).click();
    await page.waitForFunction(() => document.querySelector(".chg-status-btn[aria-pressed=true]")?.textContent.includes("Under repair"));
    eq(S.posts.find((x) => x.name === "admin-set-charger-status").body, { charger_id: unverified.id, status: "under_repair" }, "drawer: the status post");
    eq(await drawer.locator(".chg-d-tags .chg-mark").innerText(), "Under repair", "drawer: the status line follows");
    // Announce: the dialog opens over the drawer; Escape closes only the dialog.
    await drawer.getByRole("button", { name: "Announce update", exact: true }).click();
    await page.getByRole("dialog").getByRole("region", { name: "French preview" }).waitFor();
    await page.keyboard.press("Escape");
    eq(await page.getByRole("dialog").count(), 0, "drawer: Escape closes the announce dialog");
    ok(await drawer.isVisible(), "drawer: …and leaves the drawer open");
    await drawer.getByRole("button", { name: "Announce update", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Announce", exact: true }).click();
    await page.getByText(`Announcement queued for ${unverified.name}. The dispatcher sends it at its next run.`, { exact: true }).waitFor();
    ok(S.posts.some((x) => x.body.action === "announce" && x.body.update_event_id === UPDATE_ID), "drawer: the announce post");
    // Fits and contrast at 375 with the drawer open.
    await page.setViewportSize({ width: 375, height: 812 });
    await settle(page);
    let fit = await fits(page);
    ok(fit.bad.length === 0, "drawer 375: fits", fit);
    const low = await lowContrast(page, ".chg-drawer .chg-d-id, .chg-drawer dt, .chg-drawer h3, .chg-drawer .chg-days span, .chg-drawer .chg-days b, .chg-drawer .ui-btn, .chg-drawer .chg-pill, .chg-drawer .chg-d-done, .chg-drawer .chg-d-verified");
    ok(low.length === 0, "drawer 375: every text ≥ 4.5:1", low);
    await shot(page, "t10-390-drawer.png", { full: false });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.keyboard.press("Escape");
    eq(await page.locator(".chg-drawer").count(), 0, "drawer: Escape closes it");
    // A row opens it too; Enter on a focused row.
    await page.getByRole("button", { name: "Open Borne 06 Shell" }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("heading", { name: "Borne 06 Shell", exact: true }).waitFor();
    ok(true, "drawer: Enter on a row opens it");
    await page.locator(".chg-scrim").click({ position: { x: 20, y: 500 } });
    eq(await page.locator(".chg-drawer").count(), 0, "drawer: the scrim closes it");
    await context.close();
  }

  // ---- 3. ?id=&edit=1 opens the editor; an unknown id says so ----
  {
    const { context, page, S } = await open({ width: 1440, height: 1000 });
    const target = S.rows[5];
    await page.goto(`${base}/#/chargers?id=${target.id}&edit=1`);
    const editor = page.getByRole("dialog");
    await editor.getByLabel("Display name", { exact: true }).waitFor();
    eq(await editor.getByLabel("Display name", { exact: true }).inputValue(), target.name, "edit=1: the editor opens on that charger");
    await page.waitForFunction(() => !location.hash.includes("id=") && !location.hash.includes("edit="));
    ok(true, "edit=1: id and edit leave the URL once consumed");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Edit charger", exact: true }).waitFor();
    ok(true, "edit=1: closing the editor shows the drawer");
    await page.keyboard.press("Escape");
    await page.goto(`${base}/#/chargers?id=ee000000-0000-4000-8000-999999999999`);
    await page.locator(".chg-notice").waitFor();
    eq(await page.locator(".chg-notice").innerText(), "No charger with the id ee000000… is in the list. It may have been removed. Dismiss", "unknown id: says so plainly");
    await page.locator(".chg-notice").getByRole("button", { name: "Dismiss" }).click();
    eq(await page.locator(".chg-notice").count(), 0, "unknown id: Dismiss drops it");
    eq((await hashParams(page)).id, undefined, "unknown id: …and the id leaves the URL");
    // ?add=1 opens Add charger, as before.
    await page.goto(`${base}/#/chargers?add=1`);
    await page.getByRole("dialog").getByText("Add a charging station", { exact: true }).waitFor();
    ok(true, "add=1: opens the Add charger modal");
    await context.close();
  }

  // ---- 4. Map: full width, one map, the list's filters, its overlays ----
  {
    const { context, page } = await open({ width: 1920, height: 1080 });
    await page.goto(`${base}/#/chargers?view=map&status=under_repair`);
    await ready(page);
    eq(await page.locator(".chg-tabs a[aria-current=page]").innerText(), "Map", "map: the Map view is current");
    eq(await page.locator("main").getAttribute("data-wide"), "true", "map: the shell lifts the 1120px cap");
    const card = await page.locator("#chg-map").boundingBox();
    const main = await page.locator("main").evaluate((m) => ({ w: m.clientWidth, pad: parseFloat(getComputedStyle(m).paddingInlineStart) }));
    ok(card.width > 1120 && Math.abs(card.width - (main.w - 2 * main.pad)) < 1, "map: the card spans the page (wider than 1120px at 1920)", { card: card.width, main });
    const map = await page.locator(".chg-map").boundingBox();
    ok(Math.abs(map.width - card.width) < 1 && map.height >= 360, "map: the map bleeds to the card's edges and is at least 360px tall", map);
    eq(await page.locator(".chg-map").count(), 1, "map: one map container");
    eq(await page.locator(".chg-map-count").innerText(), "7 of 40 chargers", "map: the count follows the filters");
    eq(await page.locator(".chg-map-key li").allInnerTexts(), ["Operational\n0", "Under repair\n7", "Planned\n0", "Unknown\n0"], "map: the key counts the pins by status");
    // A drawer over the map leaves its mini map out: one Maps session.
    await page.goto(`${base}/#/chargers?view=map&id=${chargerId(3)}`);
    await page.locator(".chg-drawer").waitFor();
    eq([await page.locator(".chg-map").count(), await page.locator(".chg-minimap").count()], [1, 0], "map: a drawer over the map has no second map");
    eq((await hashParams(page)).view, "map", "map: the view stays when the id is consumed");
    await page.keyboard.press("Escape");
    // The list at 1920 stays capped.
    await page.goto(`${base}/#/chargers`);
    await ready(page);
    eq(await page.locator("main").getAttribute("data-wide"), null, "map: the list keeps the cap");
    ok((await page.locator("#chg-list").boundingBox()).width <= 1120.5, "map: the list card is at most 1120px wide");
    await page.goto(`${base}/#/chargers?view=map`);
    await ready(page);
    await shot(page, "t10-1920-map.png", { full: false });
    await context.close();
  }

  // ---- 5. About the network: charts with table views; shares only from 10 ----
  {
    const { context, page } = await open({ width: 1440, height: 1000, scale: 2 });
    await page.goto(`${base}/#/chargers?view=stats&q=borne`);
    await ready(page);
    await settle(page);
    eq(await page.locator(".chg-tabs a[aria-current=page]").innerText(), "Network", "stats: the Network view is current");
    eq(await page.locator(".chg-sec").innerText(), "About the network", "stats: section title");
    ok((await page.locator(".chg-lede").innerText()).includes("search and filters don't apply here"), "stats: says the list's filters don't apply");
    const titles = await page.locator(".chg-grid .ui-card h2").allInnerTexts();
    eq(titles, ["Needs a look", "Status", "Connectors", "Access", "Power", "Coverage"], "stats: the cards");
    const card = (t) => page.locator(".chg-grid .ui-card", { has: page.locator("h2", { hasText: t }) });
    const hero = (t) => card(t).locator(".ui-val").evaluate((v) => `${v.querySelector("b .ui-sr")?.textContent ?? v.querySelector("b").textContent} ${v.querySelector(":scope > span")?.textContent ?? ""}`.trim());
    eq(await hero("Status"), "50% 20 of 40 operational", "stats: operational share with its count");
    eq(await hero("Connectors"), "26 chargers offer CCS", "stats: CCS chargers");
    eq(await card("Connectors").locator(".ui-meta").innerText(), "87 plugs", "stats: every plug counted");
    eq(await hero("Access"), "40% 16 of 40 open to the public", "stats: public share");
    eq(await hero("Power"), "65% 26 of 40 DC, over 22 kW", "stats: DC share");
    eq(await hero("Coverage"), "6 of 24 governorates have a charger", "stats: coverage against the 24 governorates");
    const table = async (t) => {
      const c = card(t);
      await c.locator("summary").click();
      return c.locator(".ui-table tbody tr").evaluateAll((trs) => trs.map((tr) => [...tr.cells].map((td) => td.textContent).join(" ")));
    };
    eq(await table("Status"), ["Operational 20", "Under repair 7", "Planned 7", "Unknown 6"], "stats: status table view");
    eq(await table("Connectors"), ["Type 2 20", "CCS 26", "CHAdeMO 7"], "stats: connector table view");
    eq(await table("Access"), ["Public 16", "Customers 8", "Employees only 8", "Brand-only 8"], "stats: access table view");
    eq(await table("Power"), ["AC ≤22 kW 13", "DC 50 kW 14", "DC 100–150 kW 5", "DC 150 kW+ 7", "Not listed 1"], "stats: power table view");
    eq((await table("Coverage")).length, 6, "stats: coverage table, one row per governorate with chargers");
    const fills = await card("Status").locator(".ui-chart svg path").evaluateAll((ps) => ps.map((p) => p.style.fill));
    eq(fills, ["rgb(16, 185, 129)", "rgb(245, 158, 11)", "rgb(99, 102, 241)", "rgb(113, 113, 122)"], "stats: status bars keep their colours");
    const cfills = await card("Connectors").locator(".ui-chart svg path").evaluateAll((ps) => ps.map((p) => p.style.fill));
    eq(cfills, ["rgb(59, 130, 246)", "rgb(139, 92, 246)", "rgb(236, 72, 153)"], "stats: connector bars keep their colours");
    eq(await card("Needs a look").locator(".ui-row").evaluateAll((as) => as.map((a) => [a.getAttribute("href"), a.querySelector(".ui-bub").textContent])), [
      ["#/chargers?ver=no", "27"], ["#/chargers?cities=none", "5"], ["#/chargers?hours=missing", "10"],
    ], "stats: each gap opens the list already filtered");
    ok((await card("Coverage").innerText()).includes("No charger yet: Béja, Ben Arous, Bizerte"), "stats: the governorates with no charger are named");
    eq(await card("Coverage").locator(".chg-open-map a").getAttribute("href"), "#/chargers?view=map", "stats: Open the map");
    eq(await card("Coverage").locator(".ui-table tbody tr").count(), 6, "stats: the covered count is the number of bars");
    // Each chart downloads its rows, beside its table view; the section downloads everything.
    const csvOf = async (name) => {
      const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name, exact: true }).click()]);
      return { file: dl.suggestedFilename(), lines: (await (await import("node:fs/promises")).readFile(await dl.path(), "utf8")).replace(/^\uFEFF/, "").split("\r\n") };
    };
    const statusCsv = await csvOf("Download chargers by status as CSV");
    eq(statusCsv.lines, ["Status,Chargers", "Operational,20", "Under repair,7", "Planned,7", "Unknown,6"], "stats: Status downloads its rows");
    ok(/^charj-chargers-by-status-.*\.csv$/.test(statusCsv.file), "stats: …named like the old Overview export", statusCsv.file);
    eq((await csvOf("Download chargers by connector as CSV")).lines, ["Connector,Chargers", "Type 2,20", "CCS,26", "CHAdeMO,7"], "stats: Connectors download");
    eq((await csvOf("Download chargers by access as CSV")).lines[1], "Public,16", "stats: Access download");
    eq((await csvOf("Download chargers by power as CSV")).lines.at(-1), "Not listed,1", "stats: Power download");
    eq((await csvOf("Download chargers per governorate as CSV")).lines.length, 7, "stats: Coverage download");
    const all = await csvOf("Download every number on this page as CSV");
    eq(all.lines.slice(0, 4), ["Section,Metric,Value", "Catalogue,Chargers,40", "Catalogue,Verified,13", "Catalogue,Plugs,87"], "stats: the summary download starts with the catalogue");
    ok(all.lines.includes("Needs a look,No working hours,10") && all.lines.includes("Status,Operational,20"), "stats: …and holds every section");
    const beside = await card("Status").locator(".ui-details-row").evaluate((r) => {
      const [a, b] = [r.querySelector("summary").getBoundingClientRect(), r.querySelector(".chg-csv").getBoundingClientRect()];
      return { summary: Math.round(a.top + a.height / 2), csv: Math.round(b.top + b.height / 2), end: Math.round(r.getBoundingClientRect().right - b.right) };
    });
    ok(Math.abs(beside.summary - beside.csv) <= 3 && beside.end <= 1, "stats: Download CSV sits at the end of the Show table line", beside);
    // Tooltip on a bar (hover).
    await card("Status").locator("rect.ui-hit").first().hover();
    eq(await page.locator(".ui-tip-t").innerText(), "Operational", "stats: a bar's tooltip names its row");
    const text = await page.locator(".chg").innerText();
    ok(!/NaN|undefined|Infinity|null/.test(text), "stats: no NaN, undefined or Infinity");
    eq(await hscroll(page), 0, "stats: no horizontal scroll at 1440");
    const fit = await fits(page);
    ok(fit.bad.length === 0, "stats 1440: fits", fit);
    const bad = await lowContrast(page);
    ok(bad.length === 0, "stats 1440 light: every text ≥ 4.5:1", bad);
    await page.locator(".ui-tip").evaluate((t) => t.remove()).catch(() => {});
    await page.mouse.move(0, 0);
    await shot(page, "t10-1440-stats.png");
    // The same in a click from the Needs-a-look row.
    await card("Needs a look").locator(".ui-row").first().click();
    await ready(page);
    eq(await page.locator("#chg-list .ui-meta").innerText(), "27 of 40", "stats: Not verified opens the 27 unverified chargers");
    await context.close();
  }

  // ---- 6. Under 10, empty, loading and error ----
  {
    const small = await open({ width: 390, n: 5 });
    await small.page.goto(`${base}/#/chargers?view=stats`);
    await ready(small.page);
    const t = await small.page.locator(".chg").innerText();
    ok(!/%/.test(t), "under 10: no percentage anywhere, counts only", t.match(/.*%.*/g));
    const smallHero = await small.page.locator(".chg-grid .ui-card", { has: small.page.locator("h2", { hasText: "Status" }) }).locator(".ui-val").evaluate((v) => `${v.querySelector("b .ui-sr")?.textContent ?? v.querySelector("b").textContent} ${v.querySelector(":scope > span").textContent}`);
    eq(smallHero, "2 of 5 operational", "under 10: 2 of 5 operational, no share");
    await small.context.close();

    const empty = await open({ width: 390, n: 0, state: { govs: GOVS } });
    await empty.page.goto(`${base}/#/chargers?view=stats`);
    await ready(empty.page);
    const et = await empty.page.locator(".chg").innerText();
    ok(et.includes("No chargers in the database yet"), "empty: stats say there are no chargers yet");
    ok(!/NaN|undefined|Infinity/.test(et), "empty: no NaN in stats");
    ok((await empty.page.locator(".chg-grid .ui-sq").getAttribute("style")).includes("--c-idle-fill"), "empty: the square goes Idle Grey");
    await empty.page.goto(`${base}/#/chargers`);
    await ready(empty.page);
    ok((await empty.page.locator("#chg-list").innerText()).includes("No chargers in the database yet. Run the OCM sync"), "empty: the list says so");
    eq(await empty.page.locator(".ui-lt p").innerText(), "0 chargers · 0 verified", "empty: a real zero");
    await empty.page.goto(`${base}/#/chargers?view=map`);
    await ready(empty.page);
    eq(await empty.page.locator(".chg-map-count").innerText(), "0 chargers", "empty: the map says 0 chargers");
    // No match: Clear search and filters.
    await empty.context.close();
    const none = await open({ width: 390 });
    await none.page.goto(`${base}/#/chargers?q=zzzz`);
    await ready(none.page);
    ok((await none.page.locator("#chg-list").innerText()).includes("No chargers match this search and these filters."), "no match: says so");
    await none.page.getByRole("button", { name: "Clear search and filters" }).click();
    eq(await none.page.locator(".chg-table tbody tr").count(), 25, "no match: Clear brings the rows back");
    await none.context.close();

    const slow = await open({ width: 390, state: { rpcDelay: 1500 } });
    await slow.page.goto(`${base}/#/chargers?view=stats`);
    await slow.page.locator(".chg [aria-busy=true]").waitFor();
    ok(!/\d/.test(await slow.page.locator(".chg-grid").innerText()), "loading: no numbers while the chargers load");
    eq(await slow.page.locator(".ui-lt p").innerText(), "Loading…", "loading: the subtitle says so");
    await slow.context.close();

    const failing = await open({ width: 390, state: { fail: true } });
    await failing.page.goto(`${base}/#/chargers`);
    await failing.page.locator(".chg-retry").waitFor();
    ok((await failing.page.locator(".chg-retry").innerText()).startsWith("Couldn't load chargers: search_chargers unavailable"), "error: the list says what failed");
    eq(await failing.page.locator(".ui-lt p").innerText(), "Couldn't load the chargers.", "error: no made-up counts in the subtitle");
    failing.S.fail = false;
    await failing.page.getByRole("button", { name: "Try again" }).click();
    await failing.page.locator(".chg-table tbody tr").first().waitFor();
    ok(true, "error: Try again loads the list");
    failing.S.fail = true;
    await failing.page.goto(`${base}/#/chargers?view=stats`);
    await failing.page.reload();
    await failing.page.locator(".chg-retry").waitFor();
    const failText = await failing.page.locator(".chg-grid").innerText();
    ok(/^About the network\s+Couldn't load chargers: search_chargers unavailable Try again$/.test(failText.trim()), "error: the network view says what failed, with no numbers", failText);
    eq(await failing.page.locator(".chg-sec-row .chg-csv").count(), 0, "error: no download of numbers that didn't load");
    await failing.context.close();

    // At the read cap every count may run short, and each view says so.
    const capped = await open({ width: 390, n: 1000 });
    await capped.page.goto(`${base}/#/chargers?view=stats`);
    await ready(capped.page);
    const lede = await capped.page.locator(".chg-lede").innerText();
    ok(lede.startsWith("The first 1,000 chargers in the catalogue") && !/\bEvery\b/.test(lede) && lede.includes("may run short"), "cap: the network lede says the counts may run short", lede);
    await capped.page.goto(`${base}/#/chargers`);
    await ready(capped.page);
    ok((await capped.page.locator("#chg-list").innerText()).includes("The list reads the first 1,000 chargers"), "cap: the list says so too");
    await capped.page.goto(`${base}/#/chargers?view=map`);
    await ready(capped.page);
    ok((await capped.page.locator("#chg-map").innerText()).includes("The list reads the first 1,000 chargers"), "cap: and the map");
    await capped.context.close();
  }

  // ---- 7. Old links land somewhere sensible ----
  {
    const { context, page } = await open({ width: 1440, height: 900 });
    await page.goto(`${base}/#/map`);
    await page.locator(".chg-map").waitFor();
    eq(await hashOf(page), "#/chargers?view=map", "legacy: #/map lands on the Chargers map");
    // A fresh load, as from a bookmark.
    const fresh = await context.newPage();
    fresh.on("pageerror", (e) => errors.push(e.message));
    await fresh.goto(`${base}/#/overview`);
    await fresh.waitForFunction(() => location.hash === "#/summary");
    eq(await fresh.locator(".ui-lt h1").innerText(), "Summary", "legacy: #/overview lands on Summary (the old home)");
    await page.goto(`${base}/#/chargers?id=1&status=operational`);
    await ready(page);
    eq((await hashParams(page)).status, "operational", "legacy: #/chargers?id=…&status= keeps its filters");
    await context.close();
  }

// Text cut short inside a control: its box scrolls (scrollWidth past clientWidth),
// or the text it shows (a select's chosen option, an input's value or
// placeholder, a chip's value) is wider than the room inside its padding.
const clipped = (page) => page.evaluate(() => {
  const ctx = document.createElement("canvas").getContext("2d");
  const bad = [];
  const els = [...document.querySelectorAll(".chg-sel select, .chg-search input, .ms-value, .chg-legacy-v")].filter((el) => el.getClientRects().length);
  for (const el of els) {
    const cs = getComputedStyle(el);
    const text = el.tagName === "SELECT" ? el.options[el.selectedIndex]?.text ?? "" : el.tagName === "INPUT" ? el.value || el.placeholder : el.textContent;
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const room = el.clientWidth - parseFloat(cs.paddingInlineStart) - parseFloat(cs.paddingInlineEnd);
    const wraps = cs.whiteSpace === "normal";
    const need = wraps ? Math.max(...text.split(/\s+/).map((w) => ctx.measureText(w).width)) : ctx.measureText(text).width;
    if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1 || need > room + 1) {
      bad.push({ text, need: Math.round(need), room: Math.round(room), scroll: [el.scrollWidth, el.clientWidth] });
    }
  }
  // A stacked select chip is two lines (label, then value and chevron): a third line means the chevron wrapped.
  for (const chip of document.querySelectorAll(".chg-sel")) {
    const [label, select] = [chip.querySelector("span"), chip.querySelector("select")];
    if (!chip.getClientRects().length || label.getBoundingClientRect().bottom > select.getBoundingClientRect().top + 1) continue;
    const cs = getComputedStyle(chip);
    const lines = label.offsetHeight + select.offsetHeight + parseFloat(cs.paddingBlockStart) + parseFloat(cs.paddingBlockEnd);
    if (chip.offsetHeight > lines + 4) bad.push({ chip: label.textContent, height: chip.offsetHeight, lines });
  }
  return { bad, checked: els.length };
});

  // ---- 8a. Phones and 768: every chip shows its whole value, the search its whole placeholder,
  //          and a menu opens right under the chip that was tapped ----
  {
    const LONG = `power=dc100&upd=30&ver=yes&hours=missing&status=under_repair&access=employees_only&src=community&conn=chademo&gov=TN-82&cities=${cid(6)}&city=Sousse%20Corniche`;
    for (const [width, height] of [[375, 812], [768, 1024]]) {
      const { context, page } = await open({ width, height });
      for (const q of ["", `?${LONG}`]) {
        await page.goto(`${base}/#/chargers${q}`);
        await ready(page);
        if ((await page.locator(".chg-filters-toggle").getAttribute("aria-expanded")) !== "true") await page.locator(".chg-filters-toggle").click();
        await settle(page);
        const tag = `${width} ${q ? "long values" : "defaults"}`;
        const cut = await clipped(page);
        ok(cut.bad.length === 0 && cut.checked >= 11, `${tag}: no chip value or search text is cut short (${cut.checked} checked)`, cut);
        const fit = await fits(page);
        ok(fit.bad.length === 0, `${tag}: everything fits`, fit);
        eq(await hscroll(page), 0, `${tag}: no horizontal scroll`);
        if (q) await shot(page, `t10-${width === 375 ? 390 : width}-filters.png`, { full: false });
      }
      const search = await page.locator(".chg-search").boundingBox();
      const card = await page.locator("#chg-list").boundingBox();
      ok(search.width >= card.width - 32 - 1, `${width}: the search takes the card's whole row`, { search: search.width, card: card.width });
      for (const label of ["Status", "Governorate", "City"]) {
        const chip = await page.locator(".ms-chip", { hasText: label }).boundingBox();
        await page.locator(".ms-chip", { hasText: label }).click();
        const pop = await page.locator(".ms-pop").boundingBox();
        const panel = await page.locator(".chg-chips").boundingBox();
        ok(Math.abs(pop.y - (chip.y + chip.height + 4)) < 2, `${width}: the ${label} menu opens right under its chip`, { chip, pop });
        ok(Math.abs(pop.x - panel.x) < 1 && Math.abs(pop.width - panel.width) < 1, `${width}: …across the chip panel`, { pop, panel });
        await page.keyboard.press("Escape");
      }
      await context.close();
    }
    // RTL: Add charger slides in from the inline end (the left).
    const { context, page } = await open({ width: 390, rtl: true });
    await page.goto(`${base}/#/chargers?add=1`);
    const sheet = page.getByRole("dialog");
    await sheet.getByText("Add a charging station", { exact: true }).waitFor();
    eq(await sheet.evaluate((el) => getComputedStyle(el).animationName), "add-charger-in-rtl", "rtl: Add charger uses the RTL slide");
    await settle(page);
    ok((await sheet.boundingBox()).x < 1, "rtl: Add charger sits at the inline end (the left)");
    const remove = sheet.getByRole("button", { name: "Remove connector 1" });
    eq(await remove.evaluate((b) => [b.className, getComputedStyle(b).borderRadius, b.offsetWidth]), ["add-charger-icon-btn", "10px", 34], "add: Remove connector is the Fill icon button");
    await context.close();
  }

  // ---- 8. Widths: list (filters open), map, stats; light and dark; RTL ----
  for (const [width, height] of [[375, 812], [768, 1024], [1024, 900], [1440, 1000]]) {
    for (const colorScheme of width === 1440 || width === 375 ? ["light", "dark"] : ["light"]) {
      const { context, page } = await open({ width, height, colorScheme, scale: width === 375 ? 2 : 1 });
      const tag = `${width} ${colorScheme}`;
      for (const view of ["list", "map", "stats"]) {
        await page.goto(`${base}/#/chargers${view === "list" ? "" : `?view=${view}`}`);
        await ready(page);
        const toggle = page.locator(".chg-filters-toggle");
        if (view !== "stats" && (await toggle.isVisible())) {
          await toggle.click();
          eq(await toggle.getAttribute("aria-expanded"), "true", `${tag} ${view}: Filters opens the chips`);
        }
        await settle(page);
        eq(await hscroll(page), 0, `${tag} ${view}: no horizontal scroll`);
        const fit = await fits(page);
        ok(fit.bad.length === 0, `${tag} ${view}: everything fits`, fit);
        const bad = await lowContrast(page);
        ok(bad.length === 0, `${tag} ${view}: every text ≥ 4.5:1`, bad);
        if (view === "list") {
          const wide = await page.locator(".chg-table thead").isVisible();
          const room = await page.locator(".chg").evaluate((e) => e.clientWidth);
          eq(wide, room >= 860, `${tag}: a table from 860px of page, rows below (page ${room}px)`);
          if (!wide) {
            eq(await page.locator(".chg-sort").isVisible(), true, `${tag}: the Sort picker replaces the headers`);
            await page.getByRole("combobox", { name: "Sort", exact: true }).selectOption("power:desc");
            eq((await hashParams(page)).sort, "power:desc", `${tag}: the Sort picker writes ?sort=`);
          }
          // A menu opens inside the viewport.
          await page.locator(".ms-chip", { hasText: "Governorate" }).click();
          const pop = await page.locator(".ms-pop").boundingBox();
          ok(pop.x >= -0.5 && pop.x + pop.width <= width + 0.5, `${tag}: the Governorate menu stays on screen`, pop);
          await page.keyboard.press("Escape");
        }
        const name = { "375 light": "t10-390-light.png", "375 dark": "t10-390-dark.png", "768 light": "t10-768-light.png", "1440 light": "t10-1440-light.png", "1440 dark": "t10-1440-dark.png" }[tag];
        if (view === "list" && name) await shot(page, name);
        if (view === "stats" && tag === "375 light") await shot(page, "t10-390-stats.png");
        if (view === "map" && tag === "375 light") await shot(page, "t10-390-map.png", { full: false });
      }
      await context.close();
    }
  }
  {
    const { context, page } = await open({ width: 390, rtl: true });
    for (const view of ["", "?view=stats", "?view=map"]) {
      await page.goto(`${base}/#/chargers${view}`);
      await ready(page);
      await settle(page);
      eq(await hscroll(page), 0, `rtl ${view || "list"}: no horizontal scroll`);
      const fit = await fits(page);
      ok(fit.bad.length === 0, `rtl ${view || "list"}: fits`, fit);
    }
    await page.goto(`${base}/#/chargers?id=${chargerId(3)}`);
    await page.locator(".chg-drawer").waitFor();
    await settle(page);
    const d = await page.locator(".chg-drawer").boundingBox();
    ok(d.x < 1, "rtl: the drawer opens at the inline end (the left)", d);
    await context.close();
  }

  eq(errors, [], "no page or console errors");
  console.log(`\n${checks} checks passed`);
} finally {
  await browser.close();
}
