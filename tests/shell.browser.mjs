// App shell (tab bar / sidebar / old-link redirects), headless.
// Run against a local Vite server started with fake Supabase values, e.g.
//   VITE_SUPABASE_URL=https://fake.supabase.test VITE_SUPABASE_ANON_KEY=fake \
//     npx vite --port 5181 --strictPort &
//   SHELL_URL=http://localhost:5181 PLAYWRIGHT_MODULE=<…>/playwright/index.mjs \
//     node tests/shell.browser.mjs
// All Supabase traffic is intercepted; this suite never reaches a real backend.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.SHELL_URL || "http://localhost:5181";
const output = process.env.SHELL_ARTIFACTS || "/tmp/charj-shell-browser";
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || "chrome" });
let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks += 1; console.log(`PASS ${msg}`); };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks += 1; console.log(`PASS ${msg}`); };

const open = async (width, height = 900, { rtl = false } = {}) => {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript(() =>
    localStorage.setItem("charj-admin-auth", JSON.stringify({
      access_token: "test.admin.session", refresh_token: "test-refresh", token_type: "bearer", expires_in: 3600, expires_at: 4102444800,
      user: { id: "a0000000-0000-4000-8000-000000000001", email: "admin@charj.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
    })),
  );
  await context.route("**/auth/v1/**", (route) => route.abort());
  await context.route("https://maps.googleapis.com/**", (route) => route.abort());
  await context.route("**/rest/v1/**", (route) => route.fulfill({ json: [], headers: { "content-range": "*/0" } }));
  await context.route("**/functions/v1/**", (route) => route.request().method() === "OPTIONS" ? route.fulfill({ status: 204 }) : route.fulfill({ json: {} }));
  const page = await context.newPage();
  if (rtl) await page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => { document.documentElement.dir = "rtl"; }));
  return { context, page };
};
const visible = (page, sel) => page.locator(sel).first().isVisible();
const hscroll = (page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
const hashOf = (page) => page.evaluate(() => location.hash);

try {
  for (const [width, phone] of [[375, true], [767, true], [768, false], [1440, false]]) {
    const { context, page } = await open(width);
    await page.goto(`${base}/#/summary`);
    await page.waitForSelector(".shell-main");
    eq([await visible(page, ".ui-tabs"), await visible(page, ".ui-side")], [phone, !phone], `${width}px: ${phone ? "tab bar only" : "sidebar only"}`);
    ok(!(await hscroll(page)), `${width}px: no horizontal scroll`);
    if (phone) {
      eq(await page.locator(".ui-tabs a").allInnerTexts(), ["Summary", "Usage", "Community", "Chargers", "Settings"], `${width}px: tab bar has the five tabs`);
      eq(await page.locator(".ui-tabs .ui-nav-badge").count(), 0, `${width}px: no Community badge while the queue is unknown`);
    } else {
      eq(await page.locator(".ui-side nav a").allInnerTexts(), ["Summary", "Usage", "Community", "Chargers", "Notifications", "Settings"], `${width}px: sidebar lists six pages`);
      ok((await page.locator(".ui-side-mail").innerText()) === "admin@charj.test", `${width}px: sidebar shows the session email`);
      ok(await page.getByRole("button", { name: "Sign out" }).isVisible(), `${width}px: sidebar has Sign out`);
    }
    if (width === 1440) await page.waitForTimeout(800);
    if (width === 1440) await page.screenshot({ path: `${output}/t6-1440-summary.png` });
    await context.close();
  }

  // Old links land on the new pages and the address bar is rewritten.
  {
    const { context, page } = await open(1440);
    const cases = [
      ["#/overview", "#/summary"],
      ["#/analytics", "#/usage"],
      ["#/users?user=abc", "#/usage?tab=users&user=abc"],
      ["#/vehicles", "#/usage?tab=catalog"],
      ["#/map", "#/chargers?view=map"],
      ["#/submissions", "#/community?tab=submissions"],
      ["#/feedback", "#/community?tab=feedback"],
      ["#/reviews", "#/community?tab=reviews"],
      ["#/visits", "#/community?tab=visits"],
      ["#/nonsense", "#/summary"],
      ["#/chargers?id=1&status=operational", "#/chargers?id=1&status=operational"],
      ["#/chargers?add=1", "#/chargers?add=1"],
      ["#/notifications", "#/notifications"],
    ];
    for (const [from, to] of cases) {
      await page.goto(`${base}/${from}`);
      await page.reload();
      await page.waitForSelector(".shell-main");
      eq(await hashOf(page), to, `old link ${from} -> ${to}`);
    }
    // Deep links keep their params (the page may consume ?id=, so check ?status=).
    await page.goto(`${base}/#/chargers?status=operational&q=shell`);
    await page.reload();
    await page.waitForSelector(".shell-main");
    ok((await hashOf(page)).includes("status=operational"), "chargers filter params survive a reload");

    // Navigation by clicking.
    await page.goto(`${base}/#/summary`);
    await page.reload();
    await page.locator(".ui-side nav a", { hasText: "Usage" }).click();
    eq(await hashOf(page), "#/usage", "sidebar link goes to Usage");
    eq(await page.locator(".ui-side nav a[aria-current=page]").allInnerTexts(), ["Usage"], "active sidebar link is marked");
    await page.locator(".ui-side nav a", { hasText: "Notifications" }).click();
    eq(await hashOf(page), "#/notifications", "sidebar reaches Notifications");

    // Global search + Cmd/Ctrl+K.
    await page.keyboard.press("Control+k");
    ok(await page.evaluate(() => document.activeElement?.getAttribute("aria-label") === "Search chargers and pages"), "Ctrl+K focuses the sidebar search");
    await page.keyboard.type("sett");
    ok(await page.getByRole("listbox").isVisible(), "search results open");
    await page.keyboard.press("Enter");
    eq(await hashOf(page), "#/settings", "search picks the Settings page");
    await context.close();
  }

  // Phone navigation.
  {
    const { context, page } = await open(390, 844);
    await page.goto(`${base}/#/summary`);
    await page.waitForSelector(".ui-tabs");
    await page.locator(".ui-tabs a", { hasText: "Chargers" }).click();
    eq(await hashOf(page), "#/chargers", "tab bar goes to Chargers");
    eq(await page.locator(".ui-tabs a[aria-current=page]").allInnerTexts(), ["Chargers"], "active tab is marked");
    const tabs = await page.locator(".ui-tabs").boundingBox();
    ok(Math.abs(tabs.y + tabs.height - 844) < 1, "tab bar sits at the bottom edge");
    await page.goto(`${base}/#/summary`);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${output}/t6-390-summary.png` });
    await context.close();
  }

  // RTL: the sidebar sits on the right, the tab bar still spans the width.
  {
    const { context, page } = await open(1440, 900, { rtl: true });
    await page.goto(`${base}/#/summary`);
    await page.waitForSelector(".ui-side");
    const side = await page.locator(".ui-side").boundingBox();
    ok(side.x > 1440 / 2, "RTL: sidebar is at the inline start (right)");
    const badge = await page.evaluate(() => getComputedStyle(document.querySelector(".ui-side")).borderInlineEndWidth);
    ok(parseFloat(badge) > 0, "RTL: sidebar keeps its inline-end border");
    ok(!(await hscroll(page)), "RTL: no horizontal scroll");
    await context.close();
    const phone = await open(390, 844, { rtl: true });
    await phone.page.goto(`${base}/#/summary`);
    await phone.page.waitForSelector(".ui-tabs");
    eq(await phone.page.locator(".ui-tabs a").first().innerText(), "Summary", "RTL: tab bar renders");
    const first = await phone.page.locator(".ui-tabs a").first().boundingBox();
    ok(first.x > 390 / 2, "RTL: first tab is on the right");
    await phone.context.close();
  }
  console.log(`\n${checks} checks passed`);
} finally {
  await browser.close();
}
