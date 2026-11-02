// Notifications page + charger-drawer "Announce update", headless.
// Run against a local Vite server started with fake Supabase values, e.g.
//   VITE_SUPABASE_URL=https://fake.supabase.test VITE_SUPABASE_ANON_KEY=fake \
//     npx vite --port 5181 --strictPort &
//   NOTIFICATIONS_URL=http://127.0.0.1:5181 PLAYWRIGHT_MODULE=<…>/playwright/index.mjs \
//     node tests/notifications.browser.mjs
// All Supabase traffic is intercepted; this suite never reaches a real backend.
// Task 11 (Health look) adds: card colours, the under-10 open rate, open
// charger, the native dialog (backdrop, Not now, focus), loading and error
// states, light and dark at 375 / 768 / 1024 / 1440 (fits, nothing clipped,
// text at 4.5:1), RTL, and the t11-*.png screenshots (T11_SHOTS).
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const output = process.env.NOTIFICATIONS_ARTIFACTS || "/tmp/charj-notifications-browser";
const shots = process.env.T11_SHOTS || output;
await mkdir(output, { recursive: true });
await mkdir(shots, { recursive: true });
let checks = 0;
const ok = (cond, msg, extra) => { assert.ok(cond, extra === undefined ? msg : `${msg}: ${JSON.stringify(extra)}`); checks += 1; };

// Copied from tests/chargers.browser.mjs / community.browser.mjs: nothing pokes
// out of its card or the dialog, no text is cut off (one-line ellipsis aside).
const fits = (page) => page.evaluate(() => {
  const bad = [];
  const boxes = [...document.querySelectorAll(".notif .ui-card, .ui-lt"), ...document.querySelectorAll(".ui-dialog[open]")];
  for (const box of boxes) {
    const c = box.getBoundingClientRect();
    const name = box.querySelector("h2, h1")?.textContent ?? box.className;
    for (const el of box.querySelectorAll("*")) {
      // Visually hidden labels (.ui-sr, an icon-only button's name) are meant to be 1px.
      if (el.closest(".ui-sr") || getComputedStyle(el).clipPath === "inset(50%)" || el.closest("svg") || el.closest("details:not([open])")) continue;
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
  const dialog = document.querySelector(".ui-dialog[open]")?.getBoundingClientRect();
  if (dialog && (dialog.left < 0 || dialog.right > innerWidth || dialog.top < 0 || dialog.bottom > innerHeight + 0.5)) bad.push("the dialog leaves the viewport");
  // The large title stays one line: a word broken in two is cramped.
  const h1 = document.querySelector(".ui-lt h1");
  if (h1 && h1.getBoundingClientRect().height > parseFloat(getComputedStyle(h1).lineHeight) * 1.5) bad.push("the large title wraps");
  return { bad };
});
// Text cut short inside a control or a one-line label: its box scrolls, or
// (ellipsis) the text it holds is wider than the room inside its padding.
const clipped = (page) => page.evaluate(() => {
  const ctx = document.createElement("canvas").getContext("2d");
  const bad = [];
  const els = [...document.querySelectorAll(".ui-seg button, .ui-btn, .ui-link, .ui-pill, .ui-row-t, .ui-row-d, .ui-meta, .notif-when strong, .notif-flag, .notif-status, .ui-pager button, .ui-lt-bar span")]
    .filter((el) => el.getClientRects().length && !el.closest(".ui-lt-bar[data-on=false]"));
  for (const el of els) {
    const cs = getComputedStyle(el);
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const room = el.clientWidth - parseFloat(cs.paddingInlineStart) - parseFloat(cs.paddingInlineEnd);
    const need = cs.whiteSpace === "normal" ? Math.max(...el.textContent.split(/\s+/).map((w) => ctx.measureText(w).width)) : ctx.measureText(el.textContent).width;
    if (el.scrollWidth > el.clientWidth + 1 || need > room + 1) bad.push({ text: el.textContent.slice(0, 40), need: Math.round(need), room: Math.round(room) });
  }
  return { bad, checked: els.length };
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
  return [...document.querySelectorAll(sel)].filter((el) => el.getClientRects().length && el.textContent.trim()).map((el) => {
    const bg = behind(el);
    const fg = over(parse(getComputedStyle(el).color), bg);
    const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    return { text: el.textContent.trim().slice(0, 24), ratio: +((a + 0.05) / (b + 0.05)).toFixed(2) };
  });
}, selector);
const TEXT = [
  ".ui-lt h1", ".ui-lt p", ".notif-mode span", ".ui-seg button", ".ui-link", ".ui-btn", ".ui-meta", ".ui-ch h2", ".notif-lede",
  ".notif-name", ".notif-when", ".notif-when strong", ".ui-pill", ".notif-flag", ".notif-meta", ".notif-note", ".notif-diff dt",
  ".notif-diff dd", ".notif-diff .before", ".notif-table th", ".notif-table td", ".notif-status", ".notif-batch-t", ".ui-pager",
  ".ui-pager button", ".notif-stats b", ".notif-stats span", ".ui-lad-name", ".ui-lad-v", ".ui-details summary", ".ui-empty",
  ".ui-notice span", ".ui-error", ".notif-retry", ".notif-foot", ".ui-dialog h2", ".ui-dialog h3", ".ann-name", ".ann-meta",
  ".ann-lang", ".ann-title", ".ann-body", ".ann-line span",
].join(", ");
const lowContrast = async (page, selector = TEXT) => {
  await page.mouse.move(1, 1);
  await page.waitForTimeout(300);
  return (await contrasts(page, selector)).filter((c) => c.ratio < 4.5);
};
// A whole-page shot with the fixed tab bar at the bottom: grow the viewport to the page first.
const shot = async (page, name) => {
  const { width, height } = page.viewportSize();
  await page.setViewportSize({ width, height: Math.max(height, Math.min(6000, await page.evaluate(() => document.documentElement.scrollHeight))) });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${shots}/${name}` });
  await page.setViewportSize({ width, height });
};
const squareOf = (page, title) => page.locator(".notif .ui-card").filter({ has: page.getByRole("heading", { name: title, exact: true }) }).locator(".ui-sq").getAttribute("style");

const id = (n) => `c1000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CHARGERS = {
  hammamet: { id: id(1), name: "Shell Hammamet" },
  sousse: { id: id(2), name: "Total Sousse" },
  marsa: { id: id(3), name: "Ennakl La Marsa" },
  agareb: { id: id(4), name: "Ola Agareb" },
  drawer: { id: id(5), name: "Drawer Station" },
  quiet: { id: id(6), name: "Night Station" },
};
const EVENT = { hammamet: "e1000000-0000-4000-8000-000000000001", sousse: "e1000000-0000-4000-8000-000000000002", quiet: "e1000000-0000-4000-8000-000000000003" };
const UPDATE = { marsa: "f1000000-0000-4000-8000-000000000001", agareb: "f1000000-0000-4000-8000-000000000002", drawer: "f1000000-0000-4000-8000-000000000003" };
const NABEUL = { governorate_code: "TN-21", governorate_name_fr: "Nabeul", governorate_name_ar: "نابل", governorate_name_en: "Nabeul" };
const TUNIS = { governorate_code: "TN-11", governorate_name_fr: "Tunis", governorate_name_ar: "تونس", governorate_name_en: "Tunis" };

const iso = (ms) => new Date(ms).toISOString().replace("Z", "+00:00");
// The page clock is pinned to 11:00 Tunis so countdowns and quiet-hours
// notes don't depend on when the suite runs.
const now = Date.parse("2026-10-21T10:00:00Z");
// Next 08:00 Africa/Tunis (UTC+1, no DST) = 07:00 UTC: what the server puts
// on an ETA that falls in quiet hours.
const next0800 = (() => {
  const d = new Date(now);
  d.setUTCHours(7, 0, 0, 0);
  if (d.getTime() <= now) d.setUTCDate(d.getUTCDate() + 1);
  return iso(d.getTime());
})();

const pendingRow = (key, extra) => ({
  event_id: EVENT[key], kind: "charger_added", update_class: null, reason: "new_charger", state: "held",
  note: null, needs_review: null, charger_id: CHARGERS[key].id, charger_name: CHARGERS[key].name, ...NABEUL,
  queued_at: iso(now - 7 * 60_000), release_at: iso(now + 23 * 60_000), requested_by: null,
  eta: iso(now + 23 * 60_000), ...extra,
});
const suggestionRow = (key, extra) => ({
  update_event_id: UPDATE[key], charger_id: CHARGERS[key].id, charger_name: CHARGERS[key].name,
  occurred_at: iso(now - 3 * 3_600_000), changed_fields: ["status"],
  before: { status: "under_repair" }, after: { status: "operational" }, update_class: "back_in_service",
  ...TUNIS, recipient_estimate: 12, push_estimate: 7, ...extra,
});
const batches = Array.from({ length: 12 }, (_, i) => ({
  batch_id: `b1000000-0000-4000-8000-${String(i).padStart(12, "0")}`, source: i % 3 ? "auto" : "admin",
  status: i === 2 ? "failed" : "sent", claimed_at: iso(now - (i + 1) * 86_400_000),
  sent_at: i === 2 ? null : iso(now - (i + 1) * 86_400_000 + 5000),
  recipient_count: i === 1 ? 0 : i === 3 ? 5 : 40, device_count: 44, ticket_ok: 43, ticket_error: 1, receipt_ok: 42,
  receipt_error: i === 0 ? 2 : 0, opens: i === 1 ? 0 : i === 3 ? 2 : 10, event_count: 2,
}));

let state;
const reset = () => {
  state = {
    pending: [
      pendingRow("hammamet", { needs_review: true, note: "needs_review" }),
      pendingRow("sousse", { kind: "charger_updated", update_class: "back_in_service", reason: "update", state: "released", requested_by: "a0000000-0000-4000-8000-000000000001", eta: iso(now + 60_000) }),
      pendingRow("quiet", { eta: next0800 }),
    ],
    suggestions: [
      suggestionRow("marsa"),
      suggestionRow("agareb", {
        update_class: "power_upgrade", changed_fields: ["connectors"],
        before: { connectors: [{ type: "CCS", power_kw: 60, count: 1 }] },
        after: { connectors: [{ type: "CCS", power_kw: 120, count: 1 }] },
      }),
      suggestionRow("drawer", { update_class: "planned_to_operational", before: { status: "planned" } }),
    ],
  };
};
reset();
let empty = false;
// The next overview GET answers 500, or waits until released.
let failGets = 0;
let holdGets = null;
const overview = (chargerId) => {
  const own = (row) => !chargerId || row.charger_id === chargerId;
  return {
    pending: empty ? [] : state.pending.filter(own),
    suggestions: empty ? [] : state.suggestions.filter(own),
    history: empty || chargerId ? [] : batches,
    subscribers: [
      { governorate_code: "TN-11", name_fr: "Tunis", name_ar: "تونس", name_en: "Tunis", followers: empty ? 0 : 40, followers_with_push: empty ? 0 : 25 },
      { governorate_code: "TN-21", name_fr: "Nabeul", name_ar: "نابل", name_en: "Nabeul", followers: empty ? 0 : 18, followers_with_push: empty ? 0 : 6 },
      { governorate_code: "TN-51", name_fr: "Sousse", name_ar: "سوسة", name_en: "Sousse", followers: 0, followers_with_push: 0 },
    ],
    totals: {
      region_followers: 50, region_follows: 58, active_devices: 33, users_with_push: 31,
      pending: state.pending.length, suggestions: state.suggestions.length, batches: 12, announcements_24h: 2, quiet_now: false,
    },
    funnel: empty
      ? { region_prompt_shown: 0, region_prompt_accepted: 0, permission_granted: 0, regions_updated: 0 }
      : { region_prompt_shown: 100, region_prompt_accepted: 40, permission_granted: 30, regions_updated: 35 },
    server_time: iso(now),
    ...(chargerId ? { charger_id: chargerId } : {}),
  };
};
const preview = (body) => ({
  kind: body.event_id ? "charger_added" : "charger_updated",
  update_class: body.event_id ? null : "back_in_service",
  charger_id: id(3),
  url: `/charger/${id(3)}`,
  previews: {
    fr: { title: "Borne de nouveau en service", body: "Ennakl La Marsa fonctionne à nouveau." },
    ar: { title: "عادت المحطة للخدمة", body: "إنكال المرسى تعمل من جديد." },
    en: { title: "Charger back in service", body: "Ennakl La Marsa is working again." },
  },
  recipient_estimate: 12,
  push_estimate: 7,
  estimate_scope: body.event_id ? "region" : "region_and_charger",
});

// search_chargers rows for the drawer test.
const chargerRow = (c) => ({
  id: c.id, name: c.name, name_ar: "", name_fr: c.name, latitude: 36.4, longitude: 10.6, address: "", address_ar: "",
  city_id: null, highway_direction: null, city: "Nabeul", operator: "", status: "operational", source: "community", ocm_id: null,
  access_type: "public", connectors: [{ type: "Type 2", power_kw: 22, count: 2 }], working_hours: null, exclusive_to: [],
  amenities: [], photos: [], contact_id: null, contact_phone: null, is_verified: false, verified_by: null, verified_at: null,
  manual_overrides: {}, created_at: "2026-10-01T12:00:00Z", updated_at: "2026-10-20T08:00:00Z",
  city_fr: null, city_ar: null, city_en: null, governorate_code: "TN-21", governorate_fr: "Nabeul", governorate_ar: "نابل", governorate_en: "Nabeul",
});

const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || "chrome" });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.clock.setFixedTime(now);
  await context.addInitScript(() =>
    localStorage.setItem("charj-admin-auth", JSON.stringify({
      access_token: "test.admin.session", refresh_token: "test-refresh", token_type: "bearer", expires_in: 3600, expires_at: 4102444800,
      user: { id: "a0000000-0000-4000-8000-000000000001", email: "admin@charj.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
    })),
  );
  await context.route("**/auth/v1/**", (route) => route.abort());
  await context.route("https://maps.googleapis.com/**", (route) => route.abort());
  await context.route("**/rest/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const json = url.pathname.endsWith("/rpc/search_chargers")
      ? [chargerRow(CHARGERS.drawer), chargerRow(CHARGERS.hammamet)]
      : [];
    await route.fulfill({ json, headers: { "content-range": "0-0/1" } });
  });
  const gets = [], posts = [];
  await context.route("**/functions/v1/**", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    const url = new URL(request.url());
    if (!url.pathname.endsWith("/admin-notifications")) return route.fulfill({ json: {} });
    assert.equal(request.headers().authorization, "Bearer test.admin.session");
    if (request.method() === "GET") {
      gets.push(url.search);
      if (holdGets) await holdGets;
      if (failGets > 0) {
        failGets -= 1;
        return route.fulfill({ status: 500, json: { error: "internal_error" } });
      }
      return route.fulfill({ json: overview(url.searchParams.get("charger_id")) });
    }
    const body = request.postDataJSON();
    posts.push(body);
    if (body.action === "preview") return route.fulfill({ json: preview(body) });
    if (body.action === "announce" && body.update_event_id === UPDATE.agareb) {
      return route.fulfill({ status: 429, json: { error: "announce_rate_limited" } });
    }
    if (body.action === "cancel") state.pending = state.pending.filter((p) => p.event_id !== body.event_id);
    if (body.action === "release") state.pending = state.pending.map((p) => (p.event_id === body.event_id ? { ...p, state: "released" } : p));
    if (body.action === "announce" || body.action === "dismiss") {
      state.suggestions = state.suggestions.filter((s) => s.update_event_id !== body.update_event_id);
    }
    return route.fulfill({ json: { ok: true, result: {}, dispatch_requested: body.action !== "cancel" && body.action !== "dismiss" } });
  });

  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const until = async (fn, what) => {
    for (let i = 0; i < 100; i++) {
      if (fn()) return;
      await page.waitForTimeout(50);
    }
    throw new Error(`Timed out waiting for ${what}`);
  };
  const lastPost = () => posts.at(-1);
  const base = process.env.NOTIFICATIONS_URL || "http://127.0.0.1:5181";

  // ── Page renders the fixture ──────────────────────────────────────────
  await page.goto(`${base}/#/notifications`);
  await page.getByRole("heading", { name: "Notifications", exact: true }).waitFor();
  await page.getByRole("link", { name: "Notifications", exact: true }).waitFor(); // sidebar entry
  const mode = await page.getByRole("note", { name: "Mode" }).innerText();
  assert.match(mode, /every 5 min/);
  assert.match(mode, /22:00–08:00 \(Africa\/Tunis\)/);
  const pending = page.getByTestId("pending-item");
  await pending.first().waitFor();
  assert.equal(await pending.count(), 3);
  assert.equal(gets[0], "?days=30");
  const hammamet = pending.filter({ hasText: "Shell Hammamet" });
  await hammamet.getByText("Needs review", { exact: true }).waitFor();
  assert.match(await hammamet.locator(".notif-when strong").innerText(), /^in 2[23] min$/);
  // Released already: Send now does not apply, and says why.
  const sousse = pending.filter({ hasText: "Total Sousse" });
  const sousseSend = sousse.getByRole("button", { name: "Send now", exact: true });
  assert.equal(await sousseSend.isDisabled(), true);
  assert.match(await sousseSend.locator("xpath=..").getAttribute("title"), /Already released/);
  await sousse.getByText("Back in service", { exact: true }).waitFor();
  // ETA pushed to 08:00 by quiet hours is flagged.
  const quiet = pending.filter({ hasText: "Night Station" });
  await quiet.getByText("Waits for quiet hours to end (08:00).", { exact: true }).waitFor();
  assert.equal(await hammamet.getByText("Waits for quiet hours", { exact: false }).count(), 0);

  const suggestions = page.getByTestId("suggestion-item");
  assert.equal(await suggestions.count(), 3);
  const agareb = suggestions.filter({ hasText: "Ola Agareb" });
  assert.match(await agareb.locator(".notif-diff").innerText(), /Connectors\s+CCS 60 kW → CCS 120 kW/);
  await agareb.getByText("Power upgrade", { exact: true }).waitFor();
  await suggestions.filter({ hasText: "Ennakl La Marsa" }).getByText("12 recipients", { exact: true }).waitFor();

  // History: open rate is a lower bound with an explanation; paginated.
  const historyRows = page.locator(".notif-table tbody tr");
  assert.equal(await historyRows.count(), 10);
  const firstRate = historyRows.first().locator("td").nth(9).locator("span");
  assert.equal(await firstRate.innerText(), "≥ 25%");
  assert.match(await firstRate.getAttribute("title"), /analytics off/);
  assert.equal(await historyRows.nth(1).locator("td").nth(9).innerText(), "—"); // 0 recipients
  assert.equal(await historyRows.first().locator("td").nth(7).innerText(), "3"); // 1 ticket + 2 receipt errors
  await historyRows.nth(2).getByText("failed", { exact: true }).waitFor();
  // Under 10 recipients the rate is a count, never a percentage.
  ok((await historyRows.nth(3).locator("td").nth(9).innerText()) === "2 of 5", "history: under 10 recipients the open rate reads 2 of 5");
  await page.getByText("1–10 of 12", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  assert.equal(await historyRows.count(), 2);
  await page.getByRole("button", { name: "Previous", exact: true }).click();

  // Subscribers + funnel.
  await page.getByText("Subscribers by governorate", { exact: true }).waitFor();
  assert.equal(await page.getByText("Sousse", { exact: true }).count(), 0); // 0 followers: not charted
  await page.getByText("Map card shown", { exact: true }).waitFor();
  await page.getByText("Regions saved", { exact: true }).waitFor();
  ok((await page.locator(".ui-lad-v").allInnerTexts()).join("|") === "100|40|30|35", "opt-in: four counts, no percentage", await page.locator(".ui-lad-v").allInnerTexts());
  // The bars split each governorate's followers into with push + inbox only (they add up to the followers).
  await page.locator(".notif .ui-details summary").first().click();
  const subs = await page.locator(".notif .ui-details table tbody tr").allInnerTexts();
  ok(subs.length === 2 && /Tunis\s+25\s+15\s+40/.test(subs[0]) && /Nabeul\s+6\s+12\s+18/.test(subs[1]), "subscribers: with push + inbox only = followers", subs);
  await page.locator(".notif .ui-details summary").first().click();

  // ── Health look: colours, the title toggle, one heading per card ──────
  for (const [title, tone] of [["Pending", "screens"], ["Suggested updates", "needs-you"], ["History", "screens"], ["Subscribers by governorate", "users"], ["Reach", "users"], ["Opt-in funnel", "permissions"]]) {
    ok((await squareOf(page, title))?.includes(`--c-${tone}-fill`), `${title} wears ${tone}`);
  }
  ok((await page.locator(".ui-lt .ui-mode").count()) === 1, "the large title carries the theme toggle");
  ok((await page.locator(".notif .ui-card").filter({ hasText: "Pending" }).first().locator(".ui-meta").innerText()) === "3 queued", "pending meta counts the queue");
  ok((await page.locator(".notif-flag").innerText()) === "Needs review", "needs review is a flag");

  // ── Open charger: the name opens the charger's drawer ─────────────────
  const hammametLink = hammamet.getByRole("link", { name: "Shell Hammamet", exact: true });
  ok((await hammametLink.getAttribute("href")) === `#/chargers?id=${CHARGERS.hammamet.id}`, "open charger: the name links to chargers?id=", await hammametLink.getAttribute("href"));
  await hammametLink.click();
  await page.getByRole("complementary", { name: "Shell Hammamet, charger details" }).waitFor();
  ok(true, "open charger: the drawer opens");
  await page.goBack();
  await page.getByRole("heading", { name: "Notifications", exact: true }).waitFor();
  await pending.first().waitFor();

  // ── Responsive: no horizontal overflow ────────────────────────────────
  for (const width of [1440, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(100);
    const [scroll, client] = await page.evaluate(() => {
      const main = document.querySelector("main");
      return [main.scrollWidth, main.clientWidth];
    });
    assert.ok(scroll <= client + 1, `main overflows at ${width}px: ${scroll}/${client}`);
    await page.screenshot({ path: `${output}/notifications-${width}.png`, fullPage: true });
  }
  // Light and dark at every width: fits, nothing clipped, text at 4.5:1; the
  // history is a table from 900px of page and list rows below.
  for (const theme of ["light", "dark"]) {
    await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
    for (const width of [375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(150);
      const tag = `${width} ${theme}`;
      ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${tag}: no horizontal scroll`);
      const fit = await fits(page);
      ok(fit.bad.length === 0, `${tag}: everything fits`, fit);
      const cut = await clipped(page);
      ok(cut.bad.length === 0 && cut.checked > 10, `${tag}: no label clipped`, cut);
      const low = await lowContrast(page);
      ok(low.length === 0, `${tag}: every text at 4.5:1`, low);
      const table = await page.locator(".notif-history-table").isVisible();
      const list = await page.locator(".notif-history-list").isVisible();
      ok(table === width >= 1440 && list === !table, `${tag}: history ${table ? "table" : "rows"}`, { table, list });
    }
  }
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, "t11-notifications-390-light.png");
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await shot(page, "t11-notifications-390-dark.png");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await shot(page, "t11-notifications-1440-dark.png");
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  await shot(page, "t11-notifications-1440-light.png");
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  await page.screenshot({ path: `${output}/notifications-light-1440.png`, fullPage: true });
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));

  // ── Cancel ────────────────────────────────────────────────────────────
  await hammamet.getByRole("button", { name: "Cancel", exact: true }).click();
  await hammamet.getByRole("button", { name: "Yes, cancel it", exact: true }).click();
  await page.getByText("Cancelled the notification for Shell Hammamet.", { exact: true }).waitFor();
  assert.deepEqual(lastPost(), { action: "cancel", event_id: EVENT.hammamet });
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="pending-item"]').length === 2);

  // ── Send now: preview first, then release ─────────────────────────────
  await quiet.getByRole("button", { name: "Send now", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("region", { name: "Arabic preview" }).waitFor();
  assert.deepEqual(lastPost(), { action: "preview", event_id: EVENT.quiet });
  await dialog.getByText("≈ 12 people following this governorate · 7 with push enabled", { exact: true }).waitFor();
  ok(await dialog.evaluate((el) => el.tagName === "DIALOG" && el.open && el.matches(":modal")), "dialog: a native modal <dialog>");
  ok((await dialog.getByRole("heading", { level: 2 }).innerText()) === "Send now", "dialog: the action is its heading");
  ok(await dialog.getByRole("button", { name: "Not now", exact: true }).evaluate((b) => b === document.activeElement), "dialog: focus starts on Not now, not on the send");
  await page.setViewportSize({ width: 375, height: 800 });
  const [dScroll, dClient] = await dialog.evaluate((el) => [el.scrollWidth, el.clientWidth]);
  assert.ok(dScroll <= dClient + 1, `dialog overflows at 375px: ${dScroll}/${dClient}`);
  await page.screenshot({ path: `${output}/send-now-dialog-375.png` });
  for (const theme of ["light", "dark"]) {
    await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
    const fit = await fits(page);
    ok(fit.bad.length === 0, `dialog 375 ${theme}: fits`, fit);
    const low = await lowContrast(page, ".ui-dialog h2, .ui-dialog h3, .ann-name, .ann-meta, .ann-lang, .ann-title, .ann-body, .ann-line span, .ui-dialog .ui-btn");
    ok(low.length === 0, `dialog 375 ${theme}: text at 4.5:1`, low);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${shots}/t11-announce-dialog-390-light.png` });
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await dialog.getByRole("button", { name: "Send now", exact: true }).click();
  await page.getByText("Night Station released. The dispatcher sends it at its next run.", { exact: true }).waitFor();
  assert.deepEqual(lastPost(), { action: "release", event_id: EVENT.quiet });
  assert.equal(await page.getByRole("dialog").count(), 0);

  // ── The dialog closes on its backdrop and on Not now, sending nothing ──
  const postsBefore = posts.length;
  await suggestions.filter({ hasText: "Ennakl La Marsa" }).getByRole("button", { name: "Announce", exact: true }).click();
  await dialog.getByRole("region", { name: "English preview" }).waitFor();
  await page.mouse.click(8, 8);
  await page.waitForFunction(() => !document.querySelector("dialog"));
  await suggestions.filter({ hasText: "Ennakl La Marsa" }).getByRole("button", { name: "Announce", exact: true }).click();
  await dialog.getByRole("region", { name: "English preview" }).waitFor();
  await dialog.getByRole("button", { name: "Not now", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector("dialog"));
  // (Dev StrictMode runs the preview effect twice per open.)
  ok(posts.length > postsBefore && posts.slice(postsBefore).every((b) => b.action === "preview"), "backdrop and Not now close the dialog with only previews sent", posts.slice(postsBefore));
  ok(await suggestions.filter({ hasText: "Ennakl La Marsa" }).getByRole("button", { name: "Announce", exact: true }).evaluate((b) => b === document.activeElement), "focus returns to Announce");

  // ── Announce: preview shows FR / AR (rtl) / EN, then announce ─────────
  await suggestions.filter({ hasText: "Ennakl La Marsa" }).getByRole("button", { name: "Announce", exact: true }).click();
  await dialog.getByText("Charger back in service", { exact: true }).waitFor();
  assert.deepEqual(lastPost(), { action: "preview", update_event_id: UPDATE.marsa });
  for (const [language, text] of [["French", "Borne de nouveau en service"], ["Arabic", "عادت المحطة للخدمة"], ["English", "Charger back in service"]]) {
    await dialog.getByRole("region", { name: `${language} preview` }).getByText(text, { exact: true }).waitFor();
  }
  assert.equal(await dialog.getByRole("region", { name: "Arabic preview" }).locator("[dir]").getAttribute("dir"), "rtl");
  await dialog.getByText("≈ 12 people following this governorate or charger · 7 with push enabled", { exact: true }).waitFor();
  await page.screenshot({ path: `${output}/announce-dialog-1440.png` });
  await page.screenshot({ path: `${shots}/t11-announce-dialog-1440-dark.png` });
  await dialog.getByRole("button", { name: "Announce", exact: true }).click();
  await page.getByText("Announcement queued for Ennakl La Marsa. The dispatcher sends it at its next run.", { exact: true }).waitFor();
  assert.deepEqual(lastPost(), { action: "announce", update_event_id: UPDATE.marsa });

  // ── 429: rate limit surfaces in the dialog ────────────────────────────
  await agareb.getByRole("button", { name: "Announce", exact: true }).click();
  await dialog.getByRole("region", { name: "English preview" }).waitFor();
  await dialog.getByRole("button", { name: "Announce", exact: true }).click();
  await dialog.getByRole("alert").getByText("Already announced recently / daily limit reached", { exact: false }).waitFor();
  assert.deepEqual(lastPost(), { action: "announce", update_event_id: UPDATE.agareb });
  await page.screenshot({ path: `${output}/announce-429-1440.png` });
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);

  // ── Dismiss ───────────────────────────────────────────────────────────
  await agareb.getByRole("button", { name: "Dismiss", exact: true }).click();
  await page.getByText("Dismissed the power upgrade suggestion for Ola Agareb.", { exact: true }).waitFor();
  assert.deepEqual(lastPost(), { action: "dismiss", update_event_id: UPDATE.agareb });
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="suggestion-item"]').length === 1);

  // Period select re-fetches with the new window.
  await page.getByRole("group", { name: "History and opt-in period" }).getByRole("button", { name: "7 days", exact: true }).click();
  await until(() => gets.includes("?days=7"), "days=7 fetch");
  await page.getByText("Dispatcher runs in the last 7 days. One row per batch; a batch can carry several events.", { exact: true }).waitFor();

  // ── Charger drawer: Announce update ───────────────────────────────────
  await page.goto(`${base}/#/chargers?id=${CHARGERS.drawer.id}`);
  const announceBtn = page.getByRole("button", { name: "Announce update", exact: true });
  await announceBtn.waitFor();
  assert.ok(gets.includes(`?days=7&charger_id=${CHARGERS.drawer.id}`));
  await page.getByText("Planned → operational", { exact: true }).waitFor();
  await announceBtn.click();
  await dialog.getByRole("region", { name: "French preview" }).waitFor();
  assert.deepEqual(lastPost(), { action: "preview", update_event_id: UPDATE.drawer });
  // Escape closes the dialog, not the drawer behind it.
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  await announceBtn.waitFor();
  for (const width of [768, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: `${output}/drawer-announce-${width}.png` });
  }
  // Over the drawer on a phone: the dialog fits and its text reads.
  await page.setViewportSize({ width: 390, height: 844 });
  await announceBtn.click();
  await dialog.getByRole("region", { name: "Arabic preview" }).waitFor();
  {
    const fit = await fits(page);
    ok(fit.bad.length === 0, "drawer dialog 390: fits", fit);
    const low = await lowContrast(page, ".ui-dialog h2, .ui-dialog h3, .ann-name, .ann-meta, .ann-lang, .ann-title, .ann-body, .ann-line span, .ui-dialog .ui-btn");
    ok(low.length === 0, "drawer dialog 390: text at 4.5:1", low);
  }
  await page.screenshot({ path: `${shots}/t11-announce-drawer-390-dark.png` });
  await dialog.getByRole("button", { name: "Not now", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector("dialog"));
  await announceBtn.waitFor();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await announceBtn.click();
  await dialog.getByRole("region", { name: "Arabic preview" }).waitFor();
  await dialog.getByRole("button", { name: "Announce", exact: true }).click();
  await page.getByText("Announcement queued for Drawer Station. The dispatcher sends it at its next run.", { exact: true }).waitFor();
  assert.deepEqual(lastPost(), { action: "announce", update_event_id: UPDATE.drawer });
  await page.waitForFunction(() => ![...document.querySelectorAll("button")].some((b) => b.textContent?.includes("Announce update")));
  // A charger with nothing to announce shows no button.
  await page.goto(`${base}/#/chargers?id=${CHARGERS.hammamet.id}`);
  await page.getByRole("heading", { name: "Shell Hammamet", exact: true }).waitFor();
  await until(() => gets.includes(`?days=7&charger_id=${CHARGERS.hammamet.id}`), "drawer overview fetch");
  await page.waitForTimeout(200);
  assert.equal(await page.getByRole("button", { name: "Announce update", exact: true }).count(), 0);

  // ── Empty states ──────────────────────────────────────────────────────
  empty = true;
  await page.goto(`${base}/#/notifications`);
  for (const title of ["Nothing pending", "No updates to announce", "Nothing sent yet", "No region followers yet"]) {
    await page.getByText(title, { exact: true }).waitFor();
  }
  for (const width of [1440, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(100);
    const [scroll, client] = await page.evaluate(() => [document.querySelector("main").scrollWidth, document.querySelector("main").clientWidth]);
    assert.ok(scroll <= client + 1, `empty page overflows at ${width}px: ${scroll}/${client}`);
  }
  await page.screenshot({ path: `${output}/notifications-empty-375.png`, fullPage: true });
  {
    const fit = await fits(page);
    ok(fit.bad.length === 0, "empty 375: fits", fit);
    ok((await page.locator(".ui-lad-v").allInnerTexts()).join("|") === "0|0|0|0", "empty: the opt-in funnel shows real zeros");
  }
  empty = false;

  // ── Loading: card shells say Loading…, no numbers ─────────────────────
  let release;
  holdGets = new Promise((resolve) => { release = resolve; });
  await page.reload();
  await page.getByText("Loading…", { exact: true }).first().waitFor();
  ok((await page.locator(".notif .ui-card").count()) === 3, "loading: the card shells stay up");
  const metas = await page.locator(".notif .ui-card .ui-meta").allInnerTexts();
  ok(metas.join("|") === "30 days" && (await page.getByTestId("pending-item").count()) === 0, "loading: no counts while loading", metas);
  holdGets = null;
  release();
  await page.getByTestId("pending-item").first().waitFor();

  // ── Error: each card says why and offers Try again ────────────────────
  failGets = 1;
  await page.reload();
  await page.getByRole("alert").first().waitFor();
  const alerts = await page.locator(".notif .notif-retry").allInnerTexts();
  ok(alerts.length === 3 && alerts.every((t) => t.startsWith("Couldn't load.") && t.includes("Try again")), "error: Couldn't load + Try again, no numbers", alerts);
  await page.locator(".notif .notif-retry button").first().click();
  await page.getByTestId("pending-item").first().waitFor();
  ok(true, "error: Try again loads the page");
  // A refresh that fails keeps the data and says so.
  failGets = 1;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByText(/^Couldn't refresh:/).waitFor();
  ok((await page.getByTestId("pending-item").count()) > 0, "a failed refresh keeps the rows");

  // ── RTL at 390: everything still fits ─────────────────────────────────
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.dir = "rtl"; });
  await page.waitForTimeout(200);
  {
    const fit = await fits(page);
    ok(fit.bad.length === 0, "rtl 390: fits", fit);
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), "rtl 390: no horizontal scroll");
    const toggle = await page.locator(".ui-lt .ui-mode").boundingBox();
    ok(toggle.x < 100, "rtl 390: the theme toggle sits at the end edge (left)", toggle);
  }
  await page.evaluate(() => { document.documentElement.dir = "ltr"; });

  assert.deepEqual(errors, []);
  console.log(
    `PASS: notifications page (pending countdown, needs review, quiet hours, released Send now disabled, history open rate + pagination, subscribers + funnel), cancel/release/announce/dismiss payloads, 3-language preview with rtl Arabic, 429 message, drawer Announce update, empty states, 375/768/1440 without overflow, no page errors. ${posts.length} POSTs, ${gets.length} GETs.`,
  );
  console.log(`PASS: ${checks} Health-look checks (colours, under-10 rate, open charger, native dialog, loading, error, 375/768/1024/1440 light and dark fits + clipped + contrast, RTL).`);
} finally {
  await browser.close();
}
