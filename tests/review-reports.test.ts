import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseReportItem,
  parseReviewReports,
  REPORT_REASON_LABELS,
  reportErrorMessage,
  reportsPath,
} from "../src/data/review-reports-report.ts";

// Shaped like admin-review-reports GET (Task 3): each report with its review and charger name.
const body = () => ({
  items: [
    {
      id: "r0000000-0000-4000-8000-000000000001",
      reason: "spam",
      notes: "Il fait de la pub\npour son garage",
      created_at: "2026-11-01T22:00:00+00:00",
      resolved: false,
      rating: { id: "g1", rating: 1, comment: "visit my site", created_at: "2026-11-01T21:00:00+00:00", charger_id: "c2", charger_name: "Shell Hammamet" },
    },
    {
      id: "r0000000-0000-4000-8000-000000000002",
      reason: "brand_new",
      notes: "",
      created_at: "2026-10-20T10:00:00+00:00",
      resolved: true,
      // The review was deleted since (ON DELETE CASCADE keeps this rare, but the function allows null).
      rating: null,
    },
    { reason: "spam" },
  ],
  page: 1,
  perPage: 25,
  total: 2,
  open: 1,
});

test("parseReviewReports keeps each report with its review", () => {
  const parsed = parseReviewReports(body());
  assert.equal(parsed.open, 1);
  assert.equal(parsed.total, 2);
  assert.equal(parsed.items.length, 2, "a report without an id is skipped");
  const [first, second] = parsed.items;
  assert.equal(first.reason, "spam");
  assert.equal(first.reasonLabel, "Spam");
  assert.equal(first.notes, "Il fait de la pub\npour son garage");
  assert.equal(first.resolved, false);
  assert.deepEqual(first.review, {
    id: "g1",
    stars: 1,
    comment: "visit my site",
    createdAt: "2026-11-01T21:00:00+00:00",
    chargerId: "c2",
    chargerName: "Shell Hammamet",
  });
  assert.equal(second.reasonLabel, "brand_new", "an unknown reason shows as sent");
  assert.equal(second.review, null);
  assert.equal(second.resolved, true);
});

test("every reason the app sends has a label", () => {
  assert.deepEqual(Object.keys(REPORT_REASON_LABELS).sort(), ["inappropriate_language", "irrelevant", "other", "personal_info", "spam"]);
  assert.equal(REPORT_REASON_LABELS.personal_info, "Personal info");
});

test("parseReviewReports refuses a body it can't trust, rather than showing zeros", () => {
  for (const bad of [null, "x", [], { items: [] }, { items: "x", open: 0 }, { items: [], open: -1 }, { items: [], open: 1.5 }]) {
    assert.throws(() => parseReviewReports(bad), /Unexpected response/);
  }
});

test("parseReportItem reads the updated report a POST returns", () => {
  const item = parseReportItem({ ...body().items[0], resolved: true });
  assert.equal(item?.resolved, true);
  assert.equal(parseReportItem({ reason: "spam" }), null);
});

test("stars are clamped to 1..5 and a missing chargers name reads as unknown", () => {
  const parsed = parseReviewReports({
    ...body(),
    items: [{ ...body().items[0], rating: { ...body().items[0].rating, rating: 9, charger_name: null } }],
  });
  assert.equal(parsed.items[0].review?.stars, 5);
  assert.equal(parsed.items[0].review?.chargerName, "");
});

test("reportsPath asks for one page of one status", () => {
  assert.equal(reportsPath("open", 1), "admin-review-reports?status=open&page=1&perPage=25");
  assert.equal(reportsPath("all", 2), "admin-review-reports?status=all&page=2&perPage=25");
});

test("reportErrorMessage per status", () => {
  assert.match(reportErrorMessage(401), /credentials/);
  assert.match(reportErrorMessage(404), /no longer exists/);
  assert.match(reportErrorMessage(503), /unavailable/);
  assert.equal(reportErrorMessage(500), "Something went wrong (HTTP 500). Try again.");
});
