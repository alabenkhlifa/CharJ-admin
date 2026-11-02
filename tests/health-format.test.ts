import { test } from "node:test";
import assert from "node:assert/strict";
import {
  countOrPercent,
  countOrPercentParts,
  highlight,
  niceMax,
  plural,
  ringProgress,
  ringSegments,
  shortDay,
  windowState,
} from "../src/lib/health-format.ts";

test("countOrPercent shows counts under 10 and a percent with its count from 10", () => {
  assert.equal(countOrPercent(1, 1), "1 of 1");
  assert.equal(countOrPercent(12, 20), "60% (12 of 20)");
  assert.equal(countOrPercent(0, 0), "0 of 0");
  assert.equal(countOrPercent(9, 9), "9 of 9");
  assert.equal(countOrPercent(0, 10), "0% (0 of 10)");
  assert.equal(countOrPercent(1, 3000), "0% (1 of 3,000)");
});

test("countOrPercentParts splits the percent from its count so it can wrap between them", () => {
  assert.deepEqual(countOrPercentParts(12, 20), { percent: "60%", counts: "12 of 20" });
  assert.deepEqual(countOrPercentParts(1, 1), { percent: null, counts: "1 of 1" });
});

test("ringProgress is n over of, clamped to 0..1, and 0 when there is no goal", () => {
  assert.equal(ringProgress(3, 0), 0);
  assert.equal(ringProgress(5, 2), 1);
  assert.equal(ringProgress(1, 4), 0.25);
  assert.equal(ringProgress(-1, 4), 0);
  assert.equal(ringProgress(Number.NaN, 4), 0);
});

test("ringSegments draws ticks only for a small whole goal", () => {
  assert.equal(ringSegments(4), 4);
  assert.equal(ringSegments(1), 1);
  assert.equal(ringSegments(9), 9);
  assert.equal(ringSegments(10), undefined);
  // No goal or a fractional one: a plain continuous ring, never a 0-tick ring.
  assert.equal(ringSegments(0), undefined);
  assert.equal(ringSegments(2.5), undefined);
});

test("windowState: closed before tracking began, still open, or final", () => {
  assert.equal(windowState("2026-05-19", "2026-11-01", 7, true), "not_tracked");
  assert.equal(windowState("2026-10-22", "2026-10-22", 30, false), "open");
  assert.equal(windowState("2026-10-22", "2026-10-22", 7, true), "final");
  // The window's last day is install + n; tracking that starts on it still sees it.
  assert.equal(windowState("2026-10-01", "2026-10-08", 7, true), "final");
  assert.equal(windowState("2026-10-01", "2026-10-09", 7, true), "not_tracked");
  // Unknown tracking start: trust the window flags.
  assert.equal(windowState("2026-10-01", null, 7, false), "open");
  // Month and year boundaries.
  assert.equal(windowState("2026-12-30", "2027-01-29", 30, true), "final");
  assert.equal(windowState("2026-12-30", "2027-01-30", 30, true), "not_tracked");
});

test("highlight compares today with the same weekday last week", () => {
  const up = highlight(2, 1, "phones", "Monday");
  assert.ok(up?.includes("1 more"), up ?? "null");
  assert.equal(up, "2 phones today, 1 more than last Monday");
  assert.equal(highlight(1, 3, "phones", "Monday"), "1 phone today, 2 fewer than last Monday");
  assert.equal(highlight(2, 2, "users", "Friday"), "2 users today, same as last Friday");
  assert.equal(highlight(0, 3, "users", "Friday"), "No users yet today, 3 by this time last Friday");
  assert.equal(highlight(0, 0, "phones"), null);
  // Without a weekday it names today's weekday in Tunis.
  assert.match(highlight(2, 1, "phones") ?? "", /^2 phones today, 1 more than last (Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day$/);
});

test("plural drops the s for one", () => {
  assert.equal(plural(1, "phones"), "1 phone");
  assert.equal(plural(0, "phones"), "0 phones");
  assert.equal(plural(1200, "users"), "1,200 users");
});

test("shortDay and niceMax for chart labels and axes", () => {
  assert.equal(shortDay("2026-11-02"), "2 Nov");
  assert.equal(shortDay("2026-09-21"), "21 Sep");
  assert.equal(shortDay("2026-10-04"), "4 Oct");
  assert.equal(niceMax(0), 2);
  assert.equal(niceMax(2), 2);
  assert.equal(niceMax(3), 5);
  assert.equal(niceMax(7), 10);
  assert.equal(niceMax(408), 500);
  assert.equal(niceMax(1200), 2000);
});
