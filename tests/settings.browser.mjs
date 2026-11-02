// Settings page + the shared theme (large-title toggle ↔ Settings), headless.
// Run against a local Vite server started with fake Supabase values, e.g.
//   VITE_SUPABASE_URL=https://fake.supabase.test VITE_SUPABASE_ANON_KEY=fake \
//     npx vite --port 5181 --strictPort &
//   SETTINGS_URL=http://localhost:5181 PLAYWRIGHT_MODULE=<…>/playwright/index.mjs \
//     node tests/settings.browser.mjs
// All Supabase traffic is intercepted; this suite never reaches a real backend.
// Covers: the theme control and the title toggle agreeing, applying at once
// on every page, surviving a reload; System following prefers-color-scheme;
// the old stored-prefs migration; the phone Notifications row (below 768
// only); sign out (and a sign out that can't reach the server); build info;
// 375 / 768 / 1024 / 1440 light and dark (fits, nothing clipped, 4.5:1); RTL;
// one toggle in every page's large title, which stays one line.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.SETTINGS_URL || "http://localhost:5181";
const output = process.env.SETTINGS_ARTIFACTS || "/tmp/charj-settings-browser";
const shots = process.env.T11_SHOTS || output;
await mkdir(output, { recursive: true });
await mkdir(shots, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || "chrome" });
let checks = 0;
const ok = (cond, msg, extra) => { assert.ok(cond, extra === undefined ? msg : `${msg}: ${JSON.stringify(extra)}`); checks += 1; console.log(`PASS ${msg}`); };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks += 1; console.log(`PASS ${msg}`); };
const errors = [];
const KEY = "charj-admin:tweaks";
const SESSION = JSON.stringify({
  access_token: "test.admin.session", refresh_token: "test-refresh", token_type: "bearer", expires_in: 3600, expires_at: 4102444800,
  user: { id: "a0000000-0000-4000-8000-000000000001", email: "admin@charj.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
});

/**
 * A signed-in context. `stored` seeds the tweaks once (null clears them);
 * `logout` answers the sign-out call: 'ok' (204) or 'down' (network error).
 */
const open = async ({ width = 390, height = 844, colorScheme = "light", stored, logout = "ok", rtl = false } = {}) => {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme, deviceScaleFactor: 2 });
  await context.addInitScript(([session, key, seed]) => {
    // Seed once per context, so a reload keeps what the page wrote.
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("charj-admin-auth", session);
    if (seed === null) localStorage.removeItem(key);
    else if (seed !== undefined) localStorage.setItem(key, seed);
  }, [SESSION, KEY, stored === undefined ? undefined : stored]);
  const logouts = [];
  await context.route("**/auth/v1/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/logout")) {
      logouts.push(url.search);
      return logout === "ok" ? route.fulfill({ status: 204, body: "" }) : route.abort();
    }
    return route.abort();
  });
  await context.route("https://maps.googleapis.com/**", (route) => route.abort());
  await context.route("**/rest/v1/**", (route) => route.fulfill({ json: [], headers: { "content-range": "*/0" } }));
  await context.route("**/functions/v1/**", (route) => (route.request().method() === "OPTIONS" ? route.fulfill({ status: 204 }) : route.fulfill({ json: {} })));
  const page = await context.newPage();
  if (rtl) await page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => { document.documentElement.dir = "rtl"; }));
  page.on("pageerror", (e) => errors.push(e.message));
  return { context, page, logouts };
};
const go = async (page, hash) => {
  await page.goto(`${base}/${hash}`);
  await page.locator(".ui-lt h1").waitFor();
};
const themeOf = (page) => page.evaluate(() => document.documentElement.dataset.theme);
const stored = (page) => page.evaluate((k) => localStorage.getItem(k), KEY);
const pressed = (page) => page.getByRole("group", { name: "Theme" }).locator('[aria-pressed="true"]').innerText();
const toggle = (page) => page.locator(".ui-lt .ui-mode");
const cardBg = (page) => page.evaluate(() => getComputedStyle(document.querySelector(".ui-card")).backgroundColor);

// Copied from tests/chargers.browser.mjs / community.browser.mjs: nothing pokes
// out of its card, no text is cut off (one-line ellipsis aside); the large title stays one line.
const fits = (page) => page.evaluate(() => {
  const bad = [];
  for (const box of document.querySelectorAll(".shell-main .ui-card, .ui-lt")) {
    if (!box.getClientRects().length) continue;
    const c = box.getBoundingClientRect();
    const name = box.querySelector("h2, h1")?.textContent ?? box.className;
    for (const el of box.querySelectorAll("*")) {
      // Visually hidden labels (.ui-sr, an icon-only button's name) are meant to be 1px.
      if (el.closest(".ui-sr") || getComputedStyle(el).clipPath === "inset(50%)" || el.closest("svg")) continue;
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
  const h1 = document.querySelector(".ui-lt h1");
  if (h1 && h1.getBoundingClientRect().height > parseFloat(getComputedStyle(h1).lineHeight) * 1.5) bad.push("the large title wraps");
  return { bad };
});
// Text cut short: the box scrolls, or (ellipsis) the text is wider than the room inside its padding.
const clipped = (page) => page.evaluate(() => {
  const ctx = document.createElement("canvas").getContext("2d");
  const bad = [];
  const els = [...document.querySelectorAll(".shell-main .ui-seg button, .shell-main .ui-btn, .ui-row-t, .ui-row-d, .set-label, .set-value, .set-mail")].filter((el) => el.getClientRects().length);
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
const lowContrast = async (page) => {
  await page.mouse.move(1, 1);
  await page.waitForTimeout(300);
  return page.evaluate(() => {
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
    const sel = ".ui-lt h1, .set-h, .ui-seg button, .set-note, .set-label, .set-value, .ui-btn, .ui-row-t, .ui-row-d, .ui-error";
    return [...document.querySelectorAll(sel)].filter((el) => el.getClientRects().length && el.textContent.trim()).map((el) => {
      const bg = behind(el);
      const fg = over(parse(getComputedStyle(el).color), bg);
      const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
      return { text: el.textContent.trim().slice(0, 24), ratio: +((a + 0.05) / (b + 0.05)).toFixed(2) };
    }).filter((c) => c.ratio < 4.5);
  });
};
const shot = async (page, name) => {
  const { width, height } = page.viewportSize();
  await page.setViewportSize({ width, height: Math.max(height, await page.evaluate(() => document.documentElement.scrollHeight)) });
  await page.waitForTimeout(700); // cards rise over 0.5s
  await page.screenshot({ path: `${shots}/${name}` });
  await page.setViewportSize({ width, height });
};

try {
  // ---- 1. Theme: Settings and the title toggle are one state, applied at once, kept on reload ----
  {
    const { context, page } = await open({ stored: null });
    await go(page, "#/settings");
    eq(await page.locator(".ui-lt h1").innerText(), "Settings", "settings: large title");
    eq(await pressed(page), "System", "nothing stored: System is selected");
    eq(await themeOf(page), "light", "System on a light device: light");
    eq(await toggle(page).getAttribute("aria-label"), "Switch to dark appearance", "the title toggle offers dark");
    const lightCard = await cardBg(page);

    await toggle(page).click();
    eq(await themeOf(page), "dark", "the title toggle applies at once");
    eq(await pressed(page), "Dark", "…and Settings shows Dark without a reload");
    ok((await cardBg(page)) !== lightCard, "cards repaint in the dark tokens", await cardBg(page));
    eq(await toggle(page).getAttribute("aria-label"), "Switch to light appearance", "the toggle now offers light");
    eq(JSON.parse(await stored(page)), { v: 2, theme: "dark", density: "comfortable" }, "the choice is stored");

    await page.getByRole("group", { name: "Theme" }).getByRole("button", { name: "Light", exact: true }).click();
    eq(await themeOf(page), "light", "Settings Light applies at once");
    eq(await toggle(page).getAttribute("aria-label"), "Switch to dark appearance", "…and the title toggle agrees");

    // Across pages without a reload: Summary's toggle reads the same store.
    await page.locator(".ui-tabs a", { hasText: "Summary" }).click();
    await page.getByRole("heading", { name: "Summary", exact: true }).waitFor();
    eq(await themeOf(page), "light", "another page keeps the choice");
    await toggle(page).click();
    eq(await themeOf(page), "dark", "a toggle on another page applies");
    await page.locator(".ui-tabs a", { hasText: "Settings" }).click();
    await page.getByRole("heading", { name: "Settings", exact: true }).waitFor();
    eq(await pressed(page), "Dark", "Settings shows what the Summary toggle chose");

    await page.reload();
    await page.locator(".ui-lt h1").waitFor();
    eq([await themeOf(page), await pressed(page)], ["dark", "Dark"], "Dark survives a reload");
    eq(await page.evaluate(() => [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.content)), ["#000000", "#000000"], "an override paints both theme-color metas");

    // System follows prefers-color-scheme, live.
    await page.getByRole("group", { name: "Theme" }).getByRole("button", { name: "System", exact: true }).click();
    eq(await themeOf(page), "light", "System on a light device: light again");
    ok((await page.locator(".set-note").innerText()).includes("light right now"), "the note says what System gives now");
    await page.emulateMedia({ colorScheme: "dark" });
    await page.waitForTimeout(150);
    eq(await themeOf(page), "dark", "System follows a live switch to dark");
    eq(await toggle(page).getAttribute("aria-label"), "Switch to light appearance", "the toggle follows the system too");
    ok((await page.locator(".set-note").innerText()).includes("dark right now"), "the note follows the system");
    await page.reload();
    await page.locator(".ui-lt h1").waitFor();
    eq([await themeOf(page), await pressed(page)], ["dark", "System"], "System survives a reload on a dark device");
    eq(JSON.parse(await stored(page)).theme, "system", "System is stored");
    await context.close();
  }

  // ---- 2. Old stored prefs migrate ----
  {
    const { context, page } = await open({ colorScheme: "light", stored: JSON.stringify({ theme: "dark", density: "comfortable", accent: "#0BD8B6", numStyle: "tabular" }) });
    await go(page, "#/settings");
    eq([await pressed(page), await themeOf(page)], ["System", "light"], "old stored dark (the old default) becomes System");
    eq(await stored(page), '{"v":2,"theme":"system","density":"comfortable"}', "storage migrates to v2");
    await context.close();
  }
  {
    const { context, page } = await open({ colorScheme: "dark", stored: JSON.stringify({ theme: "light", accent: "#0BD8B6" }) });
    await go(page, "#/settings");
    eq([await pressed(page), await themeOf(page)], ["Light", "light"], "old stored light stays Light on a dark device");
    await context.close();
  }

  // ---- 3. Notifications row: phones only ----
  for (const [width, phone] of [[375, true], [767, true], [768, false], [1440, false]]) {
    const { context, page } = await open({ width, height: 900 });
    await go(page, "#/settings");
    const row = page.getByRole("link", { name: /^Notifications/ }).and(page.locator(".set-phone a"));
    eq(await row.isVisible(), phone, `${width}px: the Notifications row is ${phone ? "shown" : "absent"}`);
    if (phone) {
      eq(await row.getAttribute("href"), "#/notifications", `${width}px: the row links to Notifications`);
      await row.click();
      await page.getByRole("heading", { name: "Notifications", exact: true }).waitFor();
      ok(true, `${width}px: the row opens Notifications`);
    } else {
      ok(await page.locator(".ui-side nav a", { hasText: "Notifications" }).isVisible(), `${width}px: the sidebar lists Notifications instead`);
    }
    await context.close();
  }

  // ---- 4. Session: email and Sign out ----
  {
    const { context, page, logouts } = await open();
    await go(page, "#/settings");
    eq(await page.locator(".set-mail").innerText(), "admin@charj.test", "the signed-in email shows");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.getByText("Sign in to continue", { exact: true }).waitFor();
    ok(logouts.length === 1, "Sign out asks the server to end the session", logouts);
    eq(await page.evaluate(() => localStorage.getItem("charj-admin-auth")), null, "the stored session is gone");
    await context.close();
  }
  {
    const { context, page } = await open({ logout: "down" });
    await go(page, "#/settings");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    const alert = page.getByRole("alert");
    await alert.waitFor();
    ok((await alert.innerText()).startsWith("Couldn't sign out:"), "an unreachable server says so", await alert.innerText());
    ok(await page.getByRole("button", { name: "Sign out", exact: true }).isEnabled(), "…and Sign out can be tried again");
    ok((await page.evaluate(() => localStorage.getItem("charj-admin-auth"))) !== null, "…and the session is still there");
    await context.close();
  }
  {
    // The sidebar's sign out (768px and up) says the same when it fails.
    const { context, page } = await open({ width: 1440, height: 900, logout: "down" });
    await go(page, "#/summary");
    await page.locator(".ui-side-foot").getByRole("button", { name: "Sign out", exact: true }).click();
    const alert = page.locator(".ui-side [role=alert]");
    await alert.waitFor();
    ok((await alert.innerText()).startsWith("Couldn't sign out:"), "sidebar: an unreachable server says so", await alert.innerText());
    ok(await page.locator(".ui-side-foot").getByRole("button", { name: "Sign out", exact: true }).isEnabled(), "sidebar: …and sign out can be tried again");
    ok((await page.evaluate(() => localStorage.getItem("charj-admin-auth"))) !== null, "sidebar: …and the session is still there");
    const fit = await page.evaluate(() => {
      const side = document.querySelector(".ui-side").getBoundingClientRect();
      const a = document.querySelector(".ui-side [role=alert]").getBoundingClientRect();
      return a.left >= side.left - 0.5 && a.right <= side.right + 0.5 && a.bottom <= side.bottom + 0.5;
    });
    ok(fit, "sidebar: the reason fits inside the sidebar");
    await context.close();
  }

  // ---- 5. Build info: real version and commit ----
  {
    const { context, page } = await open();
    await go(page, "#/settings");
    const [version, commit] = await page.locator(".set-build dd").allInnerTexts();
    const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
    eq(version, pkg.version, "the version is package.json's");
    // A short hash, "+dirty" when the bundle was built from uncommitted changes.
    const built = /^([0-9a-f]{7,12})(\+dirty)?$/.exec(commit);
    ok(built !== null, "the commit is a short hash, maybe marked +dirty", commit);
    // A commit this repo really has (the server may have started on an earlier HEAD).
    const type = execFileSync("git", ["cat-file", "-t", built[1]], { cwd: new URL("..", import.meta.url) }).toString().trim();
    eq(type, "commit", "the commit exists in this repo");
    await context.close();
  }

  // ---- 6. Widths and modes: fits, nothing clipped, text at 4.5:1 ----
  for (const colorScheme of ["light", "dark"]) {
    for (const [width, height] of [[375, 812], [768, 1024], [1024, 900], [1440, 900]]) {
      const { context, page } = await open({ width, height, colorScheme, stored: null });
      await go(page, "#/settings");
      await page.waitForTimeout(700);
      const tag = `${width} ${colorScheme}`;
      ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${tag}: no horizontal scroll`);
      const fit = await fits(page);
      ok(fit.bad.length === 0, `${tag}: everything fits`, fit);
      const cut = await clipped(page);
      ok(cut.bad.length === 0 && cut.checked >= 6, `${tag}: no label clipped`, cut);
      const low = await lowContrast(page);
      ok(low.length === 0, `${tag}: every text at 4.5:1`, low);
      await context.close();
    }
  }
  for (const [width, colorScheme] of [[390, "light"], [390, "dark"], [1440, "light"], [1440, "dark"]]) {
    const { context, page } = await open({ width, height: width === 390 ? 844 : 900, colorScheme, stored: null });
    await go(page, "#/settings");
    await shot(page, `t11-settings-${width}-${colorScheme}.png`);
    await context.close();
  }

  // ---- 7. RTL: logical layout ----
  {
    const { context, page } = await open({ width: 390, rtl: true });
    await go(page, "#/settings");
    await page.waitForTimeout(700);
    const fit = await fits(page);
    ok(fit.bad.length === 0, "rtl 390: fits", fit);
    const box = await toggle(page).boundingBox();
    ok(box.x < 100, "rtl 390: the toggle sits at the end edge (left)", box);
    const signOut = await page.getByRole("button", { name: "Sign out", exact: true }).boundingBox();
    ok(signOut.x < 195, "rtl 390: Sign out sits at the end edge (left)", signOut);
    await context.close();
  }

  // ---- 8. Every page's large title: one toggle, one line ----
  for (const width of [375, 1440]) {
    const { context, page } = await open({ width, height: 900 });
    for (const hash of ["#/summary", "#/usage", "#/community", "#/chargers", "#/notifications", "#/settings"]) {
      await go(page, hash);
      const count = await toggle(page).count();
      const h1 = await page.locator(".ui-lt h1").evaluate((el) => ({ h: el.getBoundingClientRect().height, lh: parseFloat(getComputedStyle(el).lineHeight) }));
      const row = await page.locator(".ui-lt").evaluate((el) => {
        const r = el.getBoundingClientRect();
        return [...el.querySelectorAll("*")].every((c) => { const b = c.getBoundingClientRect(); return !b.width || (b.left >= r.left - 0.5 && b.right <= r.right + 0.5); });
      });
      ok(count === 1 && h1.h <= h1.lh * 1.5 && row, `${width} ${hash}: one toggle, the title on one line, nothing out of the header`, { count, h1, row });
    }
    await context.close();
  }

  eq(errors, [], "no page errors");
  console.log(`PASS: ${checks} settings checks`);
} finally {
  await browser.close();
}
