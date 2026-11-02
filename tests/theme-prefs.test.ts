import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { parseTweaks, resolveTheme, THEME_COLOR } from "../src/lib/theme-prefs.ts";

test("nothing stored follows the system", () => {
  assert.deepEqual(parseTweaks(null), { v: 2, theme: "system", density: "comfortable" });
  assert.deepEqual(parseTweaks("not json"), { v: 2, theme: "system", density: "comfortable" });
  assert.deepEqual(parseTweaks("42"), { v: 2, theme: "system", density: "comfortable" });
});

test("old stored values migrate: the always-written dark default follows the system, a chosen light stays", () => {
  const old = (theme: string) =>
    JSON.stringify({ theme, density: "compact", accent: "#0BD8B6", numStyle: "mono" });
  assert.deepEqual(parseTweaks(old("dark")), { v: 2, theme: "system", density: "compact" });
  assert.deepEqual(parseTweaks(old("light")), { v: 2, theme: "light", density: "compact" });
  assert.deepEqual(parseTweaks(JSON.stringify({ theme: "sepia" })), { v: 2, theme: "system", density: "comfortable" });
});

test("new stored values are kept as they are", () => {
  for (const theme of ["system", "light", "dark"] as const) {
    assert.deepEqual(parseTweaks(JSON.stringify({ v: 2, theme, density: "comfortable" })), {
      v: 2,
      theme,
      density: "comfortable",
    });
  }
  assert.deepEqual(parseTweaks(JSON.stringify({ v: 2, theme: "dim", density: "huge" })), {
    v: 2,
    theme: "system",
    density: "comfortable",
  });
});

test("resolveTheme applies the system only for system", () => {
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("dark", false), "dark");
});

test("theme-color is the grouped ground of each scheme", () => {
  assert.deepEqual(THEME_COLOR, { light: "#f2f2f7", dark: "#000000" });
});

test("the inline index.html script picks the same theme as parseTweaks + resolveTheme", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
  assert.ok(script, "index.html has no inline theme script");
  const stored = [
    null,
    "garbage",
    JSON.stringify({ theme: "dark", accent: "#0BD8B6" }),
    JSON.stringify({ theme: "light", accent: "#0BD8B6" }),
    JSON.stringify({ v: 2, theme: "system" }),
    JSON.stringify({ v: 2, theme: "light" }),
    JSON.stringify({ v: 2, theme: "dark" }),
  ];
  for (const raw of stored) {
    for (const systemDark of [false, true]) {
      let set: string | null = null;
      runInNewContext(script, {
        localStorage: { getItem: () => raw },
        matchMedia: () => ({ matches: systemDark }),
        document: { documentElement: { setAttribute: (_: string, v: string) => (set = v) } },
        JSON,
      });
      assert.equal(set, resolveTheme(parseTweaks(raw).theme, systemDark), `${raw} / system dark ${systemDark}`);
    }
  }
});
