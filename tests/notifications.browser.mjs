// Notifications page + charger-drawer "Announce update", headless.
// Run against a local Vite server started with fake Supabase values, e.g.
//   VITE_SUPABASE_URL=https://fake.supabase.test VITE_SUPABASE_ANON_KEY=fake \
//     npx vite --port 5181 --strictPort &
//   NOTIFICATIONS_URL=http://127.0.0.1:5181 PLAYWRIGHT_MODULE=<…>/playwright/index.mjs \
//     node tests/notifications.browser.mjs
// All Supabase traffic is intercepted; this suite never reaches a real backend.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const output = process.env.NOTIFICATIONS_ARTIFACTS || "/tmp/charj-notifications-browser";
await mkdir(output, { recursive: true });

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
  recipient_count: i === 1 ? 0 : 40, device_count: 44, ticket_ok: 43, ticket_error: 1, receipt_ok: 42,
  receipt_error: i === 0 ? 2 : 0, opens: i === 1 ? 0 : 10, event_count: 2,
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
  await page.getByRole("button", { name: "Notifications", exact: true }).waitFor(); // sidebar entry
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
  await page.getByText("1–10", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  assert.equal(await historyRows.count(), 2);

  // Subscribers + funnel.
  await page.getByText("Subscribers by governorate", { exact: true }).waitFor();
  assert.equal(await page.getByText("Sousse", { exact: true }).count(), 0); // 0 followers: not charted
  await page.getByText("Map card shown", { exact: true }).waitFor();
  await page.getByText("Regions saved", { exact: true }).waitFor();

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
  await page.setViewportSize({ width: 375, height: 800 });
  const [dScroll, dClient] = await dialog.evaluate((el) => [el.scrollWidth, el.clientWidth]);
  assert.ok(dScroll <= dClient + 1, `dialog overflows at 375px: ${dScroll}/${dClient}`);
  await page.screenshot({ path: `${output}/send-now-dialog-375.png` });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await dialog.getByRole("button", { name: "Send now", exact: true }).click();
  await page.getByText("Night Station released. The dispatcher sends it at its next run.", { exact: true }).waitFor();
  assert.deepEqual(lastPost(), { action: "release", event_id: EVENT.quiet });
  assert.equal(await page.getByRole("dialog").count(), 0);

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
  await page.locator(".notif-controls select").selectOption("7");
  await until(() => gets.includes("?days=7"), "days=7 fetch");

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

  assert.deepEqual(errors, []);
  console.log(
    `PASS: notifications page (pending countdown, needs review, quiet hours, released Send now disabled, history open rate + pagination, subscribers + funnel), cancel/release/announce/dismiss payloads, 3-language preview with rtl Arabic, 429 message, drawer Announce update, empty states, 375/768/1440 without overflow, no page errors. ${posts.length} POSTs, ${gets.length} GETs.`,
  );
} finally {
  await browser.close();
}
