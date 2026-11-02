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
  ["onboarding-text-light", "light", "--c-onboarding-text"],
  ["trip-text-light", "light", "--c-trip-text"],
  ["navigate-text-light", "light", "--c-navigate-text"],
  ["cars-text-light", "light", "--c-cars-text"],
  ["contributions-text-light", "light", "--c-contributions-text"],
  ["languages-text-light", "light", "--c-languages-text"],
  ["permissions-text-light", "light", "--c-permissions-text"],
  ["users-text-light", "light", "--c-users-text"],
  ["android-auto-text-light", "light", "--c-android-auto-text"],
  ["design-text-light", "light", "--c-design-text"],
  ["ink-secondary-light", "light", "--c-idle-text"],
  ["active-text-dark", "dark", "--c-active-text"],
  ["came-back-text-dark", "dark", "--c-came-back-text"],
  ["queue-text-dark", "dark", "--c-queue-text"],
  ["needs-you-text-dark", "dark", "--c-needs-you-text"],
  ["alarm-text-dark", "dark", "--c-alarm-text"],
  ["screens-text-dark", "dark", "--c-screens-text"],
  ["actions-text-dark", "dark", "--c-actions-text"],
  ["routes-text-dark", "dark", "--c-routes-text"],
  ["contributions-text-dark", "dark", "--c-contributions-text"],
  ["languages-text-dark", "dark", "--c-languages-text"],
  ["permissions-text-dark", "dark", "--c-permissions-text"],
  ["users-text-dark", "dark", "--c-users-text"],
  ["android-auto-text-dark", "dark", "--c-android-auto-text"],
  ["design-text-dark", "dark", "--c-design-text"],
  ["ink-secondary-dark", "dark", "--c-idle-text"],
  // Categories with no dark text tone use their base.
  ["onboarding", "dark", "--c-onboarding-text"],
  ["trip", "dark", "--c-trip-text"],
  ["navigate", "dark", "--c-navigate-text"],
  ["cars", "dark", "--c-cars-text"],
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
  ["languages", "light", "--c-languages-fill"],
  ["permissions", "light", "--c-permissions-fill"],
  ["users", "light", "--c-users-fill"],
  ["android-auto", "light", "--c-android-auto-fill"],
  ["design", "light", "--c-design-fill"],
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

// WCAG 2 contrast; rgba colours are composited over the background first.
const rgb = (c: string, bg?: number[]): number[] => {
  const hex = /^#([0-9a-f]{6})$/i.exec(c);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16));
  const m = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(c);
  assert.ok(m && bg, `cannot read colour ${c}`);
  const a = Number(m[4]);
  return [1, 2, 3].map((i, k) => Number(m[i]) * a + bg[k] * (1 - a));
};
const lum = (c: number[]) =>
  c
    .map((v) => v / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((acc, v, i) => acc + v * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (fg: number[], bg: number[]) => {
  const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** fg over bg, where bg may itself be translucent over `under` (a hex surface). */
const contrast = (fg: string, bg: string, under?: string) => {
  const b = rgb(bg, under ? rgb(under) : undefined);
  return ratio(rgb(fg, b), b);
};

test("every coloured text tone reads at 4.5:1 on Card and Grouped Ground in both themes", () => {
  for (const [name, theme] of [["light", light], ["dark", dark]] as const) {
    for (const surface of ["--card", "--ground"]) {
      const bg = resolve(theme, surface);
      for (const c of CATEGORIES) {
        if (c === "idle") continue; // Secondary Ink, checked below
        const fg = resolve(theme, `--c-${c}-text`);
        const ratio = contrast(fg, bg);
        assert.ok(ratio >= 4.5, `${name} ${c} text ${fg} on ${surface} ${bg}: ${ratio.toFixed(2)}`);
      }
    }
  }
});

// The Usage page shows every category except the queue, needs-you and alarm.
// No two of them may share a colour: each tone a page draws (base, light fill,
// light text, dark text) stays apart from every other category's same tone.
const oklab = (hex: string) => {
  const [r, g, b] = rgb(hex).map((v) => v / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
};
const deltaE = (a: string, b: string) => {
  const [x, y] = [oklab(a), oklab(b)];
  return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};

test("the four Usage-only categories stay apart from every category on the Usage page, in every tone", () => {
  const added = ["languages", "permissions", "users", "android-auto"];
  // Design (the Lune votes) lives on Community only.
  const onUsage = CATEGORIES.filter((c) => !["queue", "needs-you", "alarm", "design"].includes(c));
  const tones: [Record<string, string>, string][] = [
    [light, "--c-%"],
    [light, "--c-%-fill"],
    [light, "--c-%-text"],
    [dark, "--c-%-text"],
  ];
  for (const a of added) {
    for (const b of onUsage) {
      if (a === b || b === "idle") continue;
      for (const [theme, pattern] of tones) {
        const [x, y] = [resolve(theme, pattern.replace("%", a)), resolve(theme, pattern.replace("%", b))];
        assert.ok(deltaE(x, y) >= 10, `${a} vs ${b} ${pattern}: ${x} / ${y} ΔE ${deltaE(x, y).toFixed(1)}`);
      }
    }
  }
});

// Design votes share the Feedback tab with Needs you only (the tab strip's
// badges aside): the two stay well apart in every tone they draw.
test("Design Violet stays apart from Needs Orange, its tab's other category, in every tone", () => {
  assert.equal(resolve(light, "--c-design"), "#8b5cf6", "the colour the design votes arrived with (af43201's violet)");
  const tones: [Record<string, string>, string][] = [
    [light, "--c-%"],
    [light, "--c-%-fill"],
    [light, "--c-%-text"],
    [dark, "--c-%-text"],
    [dark, "--c-%-fill"],
  ];
  for (const [theme, pattern] of tones) {
    const [x, y] = [resolve(theme, pattern.replace("%", "design")), resolve(theme, pattern.replace("%", "needs-you"))];
    assert.ok(deltaE(x, y) >= 15, `design vs needs-you ${pattern}: ${x} / ${y} ΔE ${deltaE(x, y).toFixed(1)}`);
  }
});

test("idle text is Secondary Ink", () => {
  assert.equal(resolve(light, "--c-idle-text"), resolve(light, "--ink-2"));
  assert.equal(resolve(dark, "--c-idle-text"), resolve(dark, "--ink-2"));
});

test("Secondary Ink reads at 4.5:1 on Card, Grouped Ground and Fill over Card in both themes", () => {
  for (const [name, theme] of [["light", light], ["dark", dark]] as const) {
    const ink2 = resolve(theme, "--ink-2");
    const card = resolve(theme, "--card");
    for (const [label, r] of [
      ["card", contrast(ink2, card)],
      ["ground", contrast(ink2, resolve(theme, "--ground"))],
      ["fill on card", contrast(ink2, resolve(theme, "--fill"), card)],
    ] as const) {
      assert.ok(r >= 4.5, `${name} --ink-2 ${ink2} on ${label}: ${r.toFixed(2)}`);
    }
  }
});

test("count bubbles: glyph digits on the category text tone reach 4.5:1 in both themes", () => {
  for (const [name, theme] of [["light", light], ["dark", dark]] as const) {
    const glyph = resolve(theme, "--glyph");
    const card = resolve(theme, "--card");
    for (const c of CATEGORIES) {
      const fill = resolve(theme, `--c-${c}-text`); // translucent tones (idle) sit on the card
      const r = contrast(glyph, fill, card);
      assert.ok(r >= 4.5, `${name} ${c} bubble: ${glyph} on ${fill}: ${r.toFixed(2)}`);
    }
  }
});
