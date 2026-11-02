import assert from "node:assert/strict";
import { test } from "node:test";
import { formatVisitDate, parseVisits, REASON_LABELS, visitsPath } from "../src/data/visits-report.ts";

// Shaped like admin-confirmations GET (since_days adds summary.window).
const body = (window = true) => ({
  items: [
    { id: "v1", charger_id: "c1", charger_name: "Carrefour Marsa", charger_city: "La Marsa", user_id: "u0000000-0000-4000-8000-000000000001", outcome: "could_not_charge", reason: "not_working", connector_type: "CCS", visit_date: "2026-10-31", submitted_at: "2026-10-31T19:32:16+00:00", hidden_at: null, hidden_reason: null },
    { id: "v2", charger_id: "c2", charger_name: null, charger_city: null, user_id: "u2", outcome: "charged", reason: null, connector_type: null, visit_date: "2026-10-30", submitted_at: "2026-10-30T19:00:00+00:00", hidden_at: "2026-10-31T08:00:00+00:00", hidden_reason: "Spam" },
    { outcome: "charged" },
  ],
  page: 1,
  perPage: 25,
  total: 2,
  summary: { total: 40, charged: 30, could_not_charge: 10, hidden: 2, last_7_days: 4, contributors: 7, ...(window ? { window: { since_days: 7, could_not_charge: 1 } } : {}) },
});

test("parseVisits maps the rows and the all-time summary", () => {
  const parsed = parseVisits(body());
  assert.equal(parsed.items.length, 2, "a row without an id is skipped");
  const [first, second] = parsed.items;
  assert.equal(first.chargerName, "Carrefour Marsa");
  assert.equal(first.reason, "not_working");
  assert.equal(second.chargerName, "Unknown charger");
  assert.equal(second.hiddenReason, "Spam");
  assert.deepEqual(parsed.summary, { total: 40, charged: 30, couldNotCharge: 10, hidden: 2, last7Days: 4, contributors: 7 });
  assert.equal(parsed.windowCouldNotCharge, 1);
  assert.equal(parseVisits(body(false)).windowCouldNotCharge, null, "no window asked, none read");
});

test("parseVisits refuses a body it can't trust, rather than showing zeros", () => {
  for (const bad of [null, "x", [], { items: [] }, { items: [], summary: { total: 1 } }, { items: "x", summary: body().summary }]) {
    assert.throws(() => parseVisits(bad), /Unexpected response/);
  }
});

test("visitsPath carries the filters, and the window only when one is picked", () => {
  assert.equal(
    visitsPath({ outcome: "all", visibility: "visible", since: null, page: 1 }),
    "admin-confirmations?page=1&perPage=25&outcome=all&visibility=visible",
  );
  assert.equal(
    visitsPath({ outcome: "could_not_charge", visibility: "all", since: 7, page: 2 }),
    "admin-confirmations?page=2&perPage=25&outcome=could_not_charge&visibility=all&since_days=7",
  );
});

test("reasons and visit dates read plainly", () => {
  assert.equal(REASON_LABELS.not_working, "Charger not working");
  assert.equal(formatVisitDate("2026-09-16"), "16 Sep 2026", "a calendar day, no time zone shift");
  assert.equal(formatVisitDate("garbage"), "garbage");
});
