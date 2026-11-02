// UI kit (src/ui) on the dev-only fixture tests/kit/, headless.
// Run against a local Vite server, e.g.
//   npx vite --port 5181 --strictPort &
//   KIT_URL=http://localhost:5181 PLAYWRIGHT_MODULE=<…>/playwright/index.mjs \
//     node tests/kit.browser.mjs
// Covers: theme (system, override, migration, theme-color), RTL (thumb, ladder,
// chart labels, tooltip side), hover / focus / tap tooltips, the folding large
// title, ring taps, reduced motion, no horizontal scroll, no page errors.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = `${process.env.KIT_URL || "http://localhost:5181"}/tests/kit/index.html`;
const output = process.env.KIT_ARTIFACTS || "/tmp/charj-kit-browser";
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || "chrome" });
let checks = 0;
const ok = (cond, msg, extra) => { assert.ok(cond, extra === undefined ? msg : `${msg}: ${JSON.stringify(extra)}`); checks += 1; console.log(`PASS ${msg}`); };
const errors = [];
const open = async (options = {}, query = "", init) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "light", ...options });
  const page = await context.newPage();
  if (init) await page.addInitScript(init);
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(base + query);
  await page.waitForSelector(".ui-chart svg");
  return { context, page };
};
const themeOf = (page) => page.evaluate(() => document.documentElement.dataset.theme);
const tipText = (page) => page.evaluate(() => document.querySelector(".ui-tip")?.textContent ?? null);

try {
  // ---- theme: system, migration, override, theme-color ----
  {
    const { context, page } = await open({ viewport: { width: 375, height: 800 } });
    await page.evaluate(() => localStorage.setItem("charj-admin:tweaks", JSON.stringify({ theme: "dark", density: "comfortable", accent: "#0BD8B6", numStyle: "tabular" })));
    await page.reload();
    await page.waitForTimeout(200);
    ok((await themeOf(page)) === "light", "old stored dark follows the (light) system");
    ok((await page.evaluate(() => localStorage.getItem("charj-admin:tweaks"))) === '{"v":2,"theme":"system","density":"comfortable"}', "storage migrates to v2 system");
    await page.emulateMedia({ colorScheme: "dark" });
    await page.waitForTimeout(200);
    ok((await themeOf(page)) === "dark", "a live system change is followed");
    await page.click(".kit-mode");
    await page.waitForTimeout(200);
    const st = await page.evaluate(() => ({ metas: [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.content), stored: localStorage.getItem("charj-admin:tweaks") }));
    ok((await themeOf(page)) === "light" && st.metas.every((c) => c === "#f2f2f7") && st.stored.includes('"theme":"light"'), "override to light on a dark system paints both theme-color metas", st);
    await page.reload();
    await page.waitForTimeout(200);
    ok((await themeOf(page)) === "light", "the override survives a reload (inline script)");
    await page.evaluate(() => localStorage.setItem("charj-admin:tweaks", JSON.stringify({ theme: "light", accent: "#0BD8B6" })));
    await page.reload();
    await page.waitForTimeout(200);
    ok((await themeOf(page)) === "light", "old stored light stays light");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForTimeout(200);
    const metas = await page.evaluate(() => [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.content));
    ok((await themeOf(page)) === "dark" && metas[0] === "#f2f2f7" && metas[1] === "#000000", "nothing stored follows the system; metas per scheme", metas);
    ok((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) === 0, "no horizontal scroll at 375");
    await context.close();
  }

  // ---- screenshots: 390 / 1440, light / dark ----
  for (const [width, height] of [[390, 844], [1440, 900]]) {
    for (const colorScheme of ["light", "dark"]) {
      const { context, page } = await open({ viewport: { width, height }, colorScheme, deviceScaleFactor: 2 });
      await page.waitForTimeout(2000);
      ok((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) === 0, `no horizontal scroll at ${width} ${colorScheme}`);
      await page.screenshot({ path: `${output}/kit-${width}-${colorScheme}.png`, fullPage: true });
      await context.close();
    }
  }

  // ---- LTR and RTL ----
  for (const dir of ["ltr", "rtl"]) {
    const { context, page } = await open({ viewport: { width: 1000, height: 900 } }, dir === "rtl" ? "?rtl" : "");
    await page.waitForTimeout(1500);
    const thumb = () => page.evaluate(() => {
      const host = document.querySelector(".ui-seg");
      const th = host.querySelector(".ui-seg-thumb").getBoundingClientRect();
      const on = host.querySelector('[aria-pressed="true"]');
      const r = on.getBoundingClientRect();
      return { dx: Math.abs(th.left - r.left), dw: Math.abs(th.width - r.width), label: on.textContent };
    });
    let t = await thumb();
    ok(t.dx < 1 && t.dw < 1, `${dir}: segmented thumb sits under the selected button`, t);
    await page.locator(".ui-seg").first().getByText("Production").click();
    await page.waitForTimeout(500);
    t = await thumb();
    ok(t.dx < 1 && t.label === "Production", `${dir}: thumb slides to the new choice`, t);

    const lad = await page.evaluate(() => {
      const i = document.querySelector(".ui-lad-tr i");
      const tr = i.parentElement.getBoundingClientRect();
      const r = i.getBoundingClientRect();
      return { origin: getComputedStyle(i).transformOrigin, startGap: Math.round(document.dir === "rtl" ? tr.right - r.right : r.left - tr.left), width: r.width };
    });
    ok(lad.startGap === 0 && Math.abs(parseFloat(lad.origin) - (dir === "rtl" ? lad.width : 0)) < 0.5, `${dir}: ladder bar sits and grows at the inline start`, lad);

    // Chart text must never sit on the marks: ticks in the gutter, row
    // labels before their bars, totals after them (on the reading side).
    const geo = await page.evaluate((rtl) => {
      const box = (el) => el.getBoundingClientRect();
      const out = { ticks: [], labels: [], totals: [] };
      // Every column chart (the Events one has 3-digit ticks).
      for (const cols of [...document.querySelectorAll(".ui-chart svg")].filter((s) => s.querySelector("line"))) {
        const grid = box(cols.querySelector("line"));
        // y-axis ticks: the texts centred on a gridline (x-axis labels sit lower).
        const lines = [...cols.querySelectorAll("line")].map((l) => box(l).top);
        for (const tx of cols.querySelectorAll(":scope > text.ui-tick")) {
          const b = box(tx);
          if (!lines.some((y) => Math.abs(b.top + b.height / 2 - y) < 6)) continue;
          out.ticks.push(rtl ? b.left - grid.right : grid.left - b.right);
        }
      }
      const hb = [...document.querySelectorAll(".ui-chart svg")].find((s) => s.querySelector(".ui-lbl"));
      const rows = [...hb.querySelectorAll(":scope > g > g")];
      const labels = [...hb.querySelectorAll("text.ui-lbl")];
      const totals = [...hb.querySelectorAll("text.ui-vl")];
      rows.forEach((g, i) => {
        const bars = [...g.querySelectorAll("path")].map(box);
        const left = Math.min(...bars.map((b) => b.left));
        const right = Math.max(...bars.map((b) => b.right));
        const l = box(labels[i]);
        const v = box(totals[i]);
        out.labels.push(rtl ? l.left - right : left - l.right);
        out.totals.push(rtl ? left - v.right : v.left - right);
      });
      return out;
    }, dir === "rtl");
    ok(geo.ticks.length >= 6 && geo.ticks.every((g) => g >= 0), `${dir}: y-axis ticks sit in the gutter, off the plot`, geo.ticks);
    ok(geo.labels.every((g) => g >= 4), `${dir}: hbar row labels sit before their bars`, geo.labels);
    ok(geo.totals.every((g) => g >= 4), `${dir}: hbar totals sit after their bars`, geo.totals);

    // Hover tooltip, on the reading side, placed logically.
    const hit = page.locator(".ui-chart rect.ui-hit").nth(29);
    await hit.scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);
    const hb = await hit.boundingBox();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.waitForTimeout(100);
    const tip = await page.evaluate(() => {
      const el = document.querySelector(".ui-tip");
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { text: el.textContent, left: r.left, right: r.right, vw: document.documentElement.clientWidth, inline: el.style.insetInlineStart, phys: el.style.left };
    });
    ok(tip && tip.text.includes("Active phones"), `${dir}: hover shows the tooltip`, tip);
    ok(tip.left >= 8 && tip.right <= tip.vw - 8 && tip.phys === "" && tip.inline !== "", `${dir}: tooltip inside the viewport, placed with inset-inline-start`, tip);
    await page.mouse.move(hb.x + hb.width / 2, hb.y - 60);
    await page.waitForTimeout(100);
    ok((await tipText(page)) === null, `${dir}: mouse leave hides the tooltip`);

    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(100);
    await hit.focus();
    await page.waitForTimeout(300);
    const ft = await page.evaluate(() => {
      const el = document.querySelector(".ui-tip");
      if (!el) return null;
      return { gap: Math.round(document.activeElement.getBoundingClientRect().top - el.getBoundingClientRect().bottom) };
    });
    ok(ft && ft.gap === 12, `${dir}: keyboard focus shows the tooltip above its column, after the focus scroll`, ft);
    await page.evaluate(() => document.activeElement.blur());
    ok((await tipText(page)) === null, `${dir}: blur hides the tooltip`);

    const timeline = await page.evaluate(() => {
      const hits = document.querySelectorAll(".ui-chart rect.ui-hit");
      return [hits[0].getBoundingClientRect().x, hits[29].getBoundingClientRect().x];
    });
    ok(dir === "rtl" ? timeline[0] > timeline[1] : timeline[0] < timeline[1], `${dir}: time runs from the inline start`, timeline);

    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(200);
    ok((await page.getAttribute(".ui-lt-bar", "data-on")) === "false", `${dir}: inline title bar hidden at the top`);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(300);
    const bar = await page.evaluate(() => { const b = document.querySelector(".ui-lt-bar"); return { on: b.dataset.on, top: Math.round(b.getBoundingClientRect().top) }; });
    ok(bar.on === "true" && bar.top === 0, `${dir}: large title folds into the pinned inline bar`, bar);
    await page.mouse.wheel(0, -2000);
    await page.waitForTimeout(300);
    ok((await page.getAttribute(".ui-lt-bar", "data-on")) === "false", `${dir}: and unfolds back at the top`);

    await page.evaluate(() => scrollTo(0, 3000));
    await page.waitForTimeout(100);
    await page.evaluate(() => document.querySelectorAll(".ui-legend button")[2].click());
    await page.waitForTimeout(900);
    const needs = await page.evaluate(() => { const r = document.getElementById("card-needs").getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: innerHeight }; });
    ok(needs.top >= 0 && needs.bottom <= needs.h, `${dir}: a ring legend tap brings its card into view`, needs);
    await context.close();
  }

  // ---- phone: tap tooltips ----
  {
    // iOS Safari doesn't focus a tapped SVG element, and touch fires
    // pointerleave as the finger lifts. Stop the compat mousedown from
    // focusing so the tooltip can't lean on focus, as on an iPhone.
    const noTapFocus = () => document.addEventListener("mousedown", (e) => e.preventDefault(), true);
    const { context, page } = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 }, "", noTapFocus);
    await page.waitForTimeout(800);
    const hits = page.locator(".ui-chart").first().locator("rect.ui-hit");
    await hits.nth(29).scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await hits.nth(29).tap();
    await page.waitForTimeout(400);
    ok((await tipText(page))?.includes("2 Nov") && (await page.evaluate(() => !document.activeElement?.classList.contains("ui-hit"))), "tap: the tooltip shows and stays after the finger lifts, without focus");
    await hits.nth(28).tap();
    await page.waitForTimeout(300);
    ok((await page.locator(".ui-tip").count()) === 1 && (await tipText(page)).includes("1 Nov"), "tap: another column moves the one tooltip");
    await page.locator(".ui-lt h1").tap();
    await page.waitForTimeout(300);
    ok((await tipText(page)) === null, "tap: a tap elsewhere closes it");
    await hits.nth(29).scrollIntoViewIfNeeded();
    await hits.nth(29).tap();
    await page.waitForTimeout(300);
    ok((await tipText(page)) !== null, "tap: shows again");
    await page.evaluate(() => scrollBy(0, 120));
    await page.waitForTimeout(300);
    ok((await tipText(page)) === null, "tap: a scroll closes it");
    await context.close();
  }

  // ---- reduced motion ----
  {
    const { context, page } = await open({ reducedMotion: "reduce" });
    await page.waitForTimeout(300);
    const rm = await page.evaluate(() => ({
      ring: getComputedStyle(document.querySelector(".ui-ring-arc")).transitionDuration,
      card: getComputedStyle(document.querySelector(".ui-card")).animationName,
      num: document.querySelector(".ui-val b span").textContent,
    }));
    ok(rm.ring === "0s" && rm.card === "none" && rm.num === "1.0", "reduced motion: no ring fill, no card rise, the number lands at once", rm);
    await context.close();
  }

  ok(errors.length === 0, "no page errors", errors);
  console.log(`\n${checks} checks passed. Screenshots in ${output}`);
} finally {
  await browser.close();
}
