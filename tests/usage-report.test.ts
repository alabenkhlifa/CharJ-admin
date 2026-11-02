import assert from "node:assert/strict";
import { test } from "node:test";
import {
  activeGoal,
  languageCounts,
  parseUsageReport,
  parseUsageEnvironment,
  versionRows,
} from "../src/data/usage-report.ts";

// The real production summary from the Task 1 report (2 Nov 2026), plus the
// Task 1b languages: the exact shape admin-usage returns.
const days = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2026, 9, 4 + i)).toISOString().slice(0, 10));
const active = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 4, 5, 4, 4, 4, 5, 2, 4, 6, 6, 2, 5, 5, 2, 5, 4, 1];
const summary = () => ({
  avg7: 3.43,
  daily: days.map((day, i) => ({ day, active: active[i] })),
  today: { active: 1 },
  cohort: { back_7d: 1, installed: 4, install_week: "2026-10-19" },
  timezone: "Africa/Tunis",
  versions: [
    { ui: "unknown", users: 19, platform: "android", app_version: "1.2.1" },
    { ui: "unknown", users: 19, platform: "ios", app_version: "1.2.1" },
  ],
  languages: [
    { language: "fr", users: 25 },
    { language: "en", users: 13 },
  ],
  dropped_7d: 0,
  environment: "production",
  generated_at: "2026-11-02T02:53:48.983525+00:00",
  same_day_last_week: { active: 1 },
});

const KEYS = [
  "generated_at",
  "timezone",
  "environment",
  "today",
  "avg7",
  "daily",
  "cohort",
  "versions",
  "dropped_7d",
  "same_day_last_week",
  "languages",
] as const;

test("accepts the Task 1 summary shape and keeps every value", () => {
  const report = parseUsageReport("summary", summary());
  assert.equal(report.generated_at, "2026-11-02T02:53:48.983525+00:00");
  assert.equal(report.timezone, "Africa/Tunis");
  assert.equal(report.environment, "production");
  assert.deepEqual(report.today, { active: 1 });
  assert.equal(report.avg7, 3.43);
  assert.equal(report.daily.length, 30);
  assert.deepEqual(report.daily[29], { day: "2026-11-02", active: 1 });
  assert.deepEqual(report.cohort, { install_week: "2026-10-19", installed: 4, back_7d: 1 });
  assert.deepEqual(report.versions[1], { platform: "ios", app_version: "1.2.1", ui: "unknown", users: 19 });
  assert.equal(report.dropped_7d, 0);
  assert.deepEqual(report.same_day_last_week, { active: 1 });
  assert.deepEqual(report.languages, [
    { language: "fr", users: 25 },
    { language: "en", users: 13 },
  ]);
});

test("accepts a null cohort, empty lists and an all-zero report", () => {
  const zero = {
    ...summary(),
    avg7: 0,
    daily: days.map((day) => ({ day, active: 0 })),
    today: { active: 0 },
    cohort: null,
    versions: [],
    languages: [],
    same_day_last_week: { active: 0 },
  };
  const report = parseUsageReport("summary", zero);
  assert.equal(report.cohort, null);
  assert.equal(report.avg7, 0);
  assert.deepEqual(report.versions, []);
});

test("rejects a summary with any key missing", () => {
  for (const key of KEYS) {
    const value: Record<string, unknown> = summary();
    delete value[key];
    assert.throws(() => parseUsageReport("summary", value), /Invalid usage report/, `missing ${key}`);
  }
});

test("rejects a summary with a nested key missing or a wrong type", () => {
  const bad: Record<string, unknown>[] = [
    { ...summary(), today: {} },
    { ...summary(), same_day_last_week: { active: "1" } },
    { ...summary(), cohort: { install_week: "2026-10-19", installed: 4 } },
    { ...summary(), cohort: { install_week: "last week", installed: 4, back_7d: 1 } },
    { ...summary(), daily: [{ day: "2026-11-02" }] },
    { ...summary(), daily: [{ day: "=SUM(1,2)", active: 1 }] },
    { ...summary(), versions: [{ platform: "ios", app_version: "1.2.1", users: 1 }] },
    { ...summary(), languages: [{ language: "fr" }] },
    { ...summary(), avg7: Number.NaN },
    { ...summary(), avg7: -1 },
    { ...summary(), today: { active: 1.5 } },
    { ...summary(), dropped_7d: null },
    { ...summary(), timezone: "UTC" },
    { ...summary(), environment: "staging" },
    { ...summary(), generated_at: "yesterday" },
  ];
  for (const value of [null, [], "summary", ...bad]) {
    assert.throws(() => parseUsageReport("summary", value), /Invalid usage report/, JSON.stringify(value)?.slice(0, 80));
  }
});

test("the usage view is a typed passthrough until Task 8 parses it", () => {
  const raw = { generated_at: "2026-11-02T02:53:48Z", timezone: "Africa/Tunis", environment: "preview", days: 30, daily: [] };
  const report = parseUsageReport("usage", raw);
  assert.equal(report.environment, "preview");
  assert.equal(report.days, 30);
  assert.deepEqual(report.raw, raw);
  assert.throws(() => parseUsageReport("usage", { ...raw, days: 365 }), /Invalid usage report/);
  assert.throws(() => parseUsageReport("usage", { ...raw, timezone: undefined }), /Invalid usage report/);
});

test("the Active goal is the rounded 7-day average, at least 1", () => {
  assert.equal(activeGoal(3.43), 3);
  assert.equal(activeGoal(3.5), 4);
  assert.equal(activeGoal(0.4), 1);
  assert.equal(activeGoal(0), 1);
});

test("languages read FR, AR, EN as counts, with real zeros for the missing ones", () => {
  assert.deepEqual(languageCounts([{ language: "en", users: 13 }, { language: "fr", users: 25 }]), [
    { language: "fr", label: "FR", users: 25 },
    { language: "ar", label: "AR", users: 0 },
    { language: "en", label: "EN", users: 13 },
  ]);
  // A language the app may add later still shows, after the three.
  assert.deepEqual(languageCounts([{ language: "de", users: 2 }]).map((l) => l.label), ["FR", "AR", "EN", "DE"]);
});

test("version rows name the build, label the design and count distinct versions", () => {
  const rows = versionRows([
    { platform: "android", app_version: "1.3.0", ui: "lune", users: 1 },
    { platform: "android", app_version: "1.3.0", ui: "unknown", users: 1 },
    { platform: "ios", app_version: "1.3.0", ui: "classic", users: 2 },
  ]);
  assert.deepEqual(rows.rows.map((r) => [r.name, r.ui, r.users]), [
    ["Android 1.3.0", "lune", 1],
    ["Android 1.3.0", "no label", 1],
    ["iOS 1.3.0", "classic", 2],
  ]);
  assert.equal(rows.versions, 2);
});

test("an environment from the URL falls back to production", () => {
  assert.equal(parseUsageEnvironment("preview"), "preview");
  assert.equal(parseUsageEnvironment("development"), "development");
  assert.equal(parseUsageEnvironment(null), "production");
  assert.equal(parseUsageEnvironment("staging"), "production");
});
