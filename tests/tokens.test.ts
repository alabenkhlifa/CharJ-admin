// The CSS tokens must carry DESIGN.md's colours verbatim, per theme.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CATEGORIES } from "../src/ui/category.ts";

const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
const design = readFileSync(new URL("../DESIGN.md", import.meta.url), "utf8");

const block = (selector: string): Record<string, string> => {
  const at = css.indexOf(`${selector} {`);
  assert.ok(at >= 0, `missing block ${selector}`);
  const body = css.slice(at, css.indexOf("}", at));
  const vars: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) vars[m[1]] = m[2].trim();
  return vars;
};
const root = block(":root");
const light = block(':root,\nhtml[data-theme="light"]');
const dark = block('html[data-theme="dark"]');
const resolve = (theme: Record<string, string>, name: string): string => {
  const v = theme[name] ?? root[name];
  assert.ok(v, `${name} is not defined`);
  const ref = /^var\((--[\w-]+)\)$/.exec(v);
  return ref ? resolve(theme, ref[1]) : v.toLowerCase().replace(/\s+/g, " ");
};

const colors: Record<string, string> = {};
for (const m of design.matchAll(/^ {2}([\w-]+): "([^"]+)"$/gm)) colors[m[1]] = m[2].toLowerCase();
const d = (key: string) => {
  assert.ok(colors[key], `DESIGN.md has no colour ${key}`);
  return colors[key].replace(/\s+/g, " ");
};

// DESIGN.md colour → [theme, css var]. This table is the token map.
const MAP: [string, "light" | "dark" | "both", string][] = [
  ...CATEGORIES.map((c) => [c, "both", `--c-${c}`] as [string, "both", string]),
  ["active-text-light", "light", "--c-active-text"],
  ["came-back-text-light", "light", "--c-came-back-text"],
  ["queue-text-light", "light", "--c-queue-text"],
  ["needs-you-text-light", "light", "--c-needs-you-text"],
  ["alarm-text-light", "light", "--c-alarm-text"],
  ["screens-text-light", "light", "--c-screens-text"],
  ["actions-text-light", "light", "--c-actions-text"],
  ["routes-text-light", "light", "--c-routes-text"],
  ["active-text-dark", "dark", "--c-active-text"],
  ["came-back-text-dark", "dark", "--c-came-back-text"],
  ["queue-text-dark", "dark", "--c-queue-text"],
  ["needs-you-text-dark", "dark", "--c-needs-you-text"],
  ["alarm-text-dark", "dark", "--c-alarm-text"],
  ["screens-text-dark", "dark", "--c-screens-text"],
  ["actions-text-dark", "dark", "--c-actions-text"],
  ["routes-text-dark", "dark", "--c-routes-text"],
  // Light fills (squares, bubbles) from the category colour map.
  ["active", "light", "--c-active-fill"],
  ["came-back-text-light", "light", "--c-came-back-fill"],
  ["queue-text-light", "light", "--c-queue-fill"],
  ["needs-you-text-light", "light", "--c-needs-you-fill"],
  ["alarm-text-light", "light", "--c-alarm-fill"],
  ["screens", "light", "--c-screens-fill"],
  ["actions", "light", "--c-actions-fill"],
  ["onboarding-fill-light", "light", "--c-onboarding-fill"],
  ["trip-fill-light", "light", "--c-trip-fill"],
  ["navigate-fill-light", "light", "--c-navigate-fill"],
  ["routes-text-light", "light", "--c-routes-fill"],
  ["cars-fill-light", "light", "--c-cars-fill"],
  ["contributions", "light", "--c-contributions-fill"],
  ["grouped-ground-light", "light", "--ground"],
  ["card-light", "light", "--card"],
  ["card-pressed-light", "light", "--card-pressed"],
  ["ink-light", "light", "--ink"],
  ["ink-secondary-light", "light", "--ink-2"],
  ["separator-light", "light", "--sep"],
  ["fill-light", "light", "--fill"],
  ["bar-material-light", "light", "--bar"],
  ["card-light", "light", "--thumb"],
  ["grouped-ground-dark", "dark", "--ground"],
  ["card-dark", "dark", "--card"],
  ["card-pressed-dark", "dark", "--card-pressed"],
  ["ink-dark", "dark", "--ink"],
  ["ink-secondary-dark", "dark", "--ink-2"],
  ["separator-dark", "dark", "--sep"],
  ["fill-dark", "dark", "--fill"],
  ["bar-material-dark", "dark", "--bar"],
  ["segment-thumb-dark", "dark", "--thumb"],
];

test("every DESIGN.md colour lands in its token, per theme", () => {
  for (const [key, theme, name] of MAP) {
    if (theme !== "dark") assert.equal(resolve(light, name), d(key), `light ${name} ← ${key}`);
    if (theme !== "light") assert.equal(resolve(dark, name), d(key), `dark ${name} ← ${key}`);
  }
});

test("every category has a base, text and fill tone in both themes; dark fills are the base", () => {
  for (const c of CATEGORIES) {
    for (const theme of [light, dark]) {
      resolve(theme, `--c-${c}-text`);
      resolve(theme, `--c-${c}-fill`);
    }
    assert.equal(resolve(dark, `--c-${c}-fill`), d(c), `dark fill of ${c}`);
  }
});

test("glyph ink flips with the theme; ring track opacity per theme", () => {
  assert.equal(resolve(light, "--glyph"), "#ffffff");
  assert.equal(resolve(dark, "--glyph"), "#000000");
  assert.equal(resolve(light, "--track"), ".16");
  assert.equal(resolve(dark, "--track"), ".24");
});

test("shape and motion tokens match DESIGN.md", () => {
  assert.equal(root["--r-card"], "16px");
  assert.equal(root["--ease"], "cubic-bezier(.2, .8, .2, 1)");
  assert.equal(root["--stagger"], "60ms");
  assert.equal(root["--dur-ring"], "1.2s");
  assert.match(root["--font"], /^-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter Variable", Roboto, system-ui, sans-serif$/);
});
