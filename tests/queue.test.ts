import assert from "node:assert/strict";
import { test } from "node:test";
import { QUEUE_LINKS, QUEUE_PATHS, mergeQueue, timeAgo, type QueueKey } from "../src/data/queue-report.ts";

// Response bodies as the four admin functions send them (shapes from the
// Task 3 / Task 4 reports and admin-feedback), filled from the mock's
// snapshot to-do list.
const feedback = () => ({
  items: [
    { id: "f1", device_id: "d", category: "compliment", message: "Test du merci - revue Lune", email: "", app_version: "1.3.0", platform: "ios", locale: "fr", resolved: false, resolved_at: null, resolved_by: null, created_at: "2026-10-31T20:05:59.794743+00:00" },
    { id: "f2", device_id: "d", category: "bug", message: "  [email removed]\n", email: "", app_version: "1.2.1", platform: "android", locale: "fr", resolved: false, resolved_at: null, resolved_by: null, created_at: "2026-06-09T21:50:35.687943+00:00" },
  ],
  total: 3,
  summary: { total: 9, open: 3, resolved: 6, last_7_days: 1, by_category: { bug: 1, suggestion: 1, compliment: 1, charger_data: 0, other: 0 } },
});
const visits = () => ({
  items: [
    { id: "v1", charger_id: "c1", charger_name: "Carrefour Marsa", charger_city: "La Marsa", user_id: "u1", outcome: "could_not_charge", reason: "other", connector_type: null, visit_date: "2026-10-31", submitted_at: "2026-10-31T19:32:16.961428+00:00", hidden_at: null, hidden_reason: null },
  ],
  page: 1,
  perPage: 3,
  total: 1,
  // All-time counts; the to-do count is the 7-day window, which leaves out hidden rows.
  summary: { total: 40, charged: 30, could_not_charge: 10, hidden: 2, last_7_days: 4, contributors: 7, window: { since_days: 7, could_not_charge: 1 } },
});
const submissions = (pending = 0) => ({
  items: pending ? [{ id: "s1", submitted_by: "x", name: "Borne Lac 2", address: "", connectors: [], photos: [], notes: "", status: "pending", reviewed_at: null, reviewed_by: null, review_note: null, charger_id: null, app_version: "1.3.0", created_at: "2026-11-01T08:00:00+00:00", lat: 36.8, lng: 10.2 }] : [],
  page: 1,
  perPage: 3,
  total: pending,
  counts: { pending, approved: 4, rejected: 2 },
});
const reports = (open = 0) => ({
  items: open ? [{ id: "r1", reason: "spam", notes: "", created_at: "2026-11-01T22:00:00+00:00", resolved: false, rating: { id: "g1", rating: 1, comment: "visit my site", created_at: "2026-11-01T21:00:00+00:00", charger_id: "c2", charger_name: "Shell Hammamet" } }] : [],
  page: 1,
  perPage: 3,
  total: open,
  open,
});

const ok = (value: unknown): PromiseSettledResult<unknown> => ({ status: "fulfilled", value });
const settled = (over: Partial<Record<QueueKey, PromiseSettledResult<unknown>>> = {}) => ({
  feedback: ok(feedback()),
  couldNotCharge: ok(visits()),
  submissions: ok(submissions()),
  reports: ok(reports()),
  ...over,
});

test("each count comes from its own field, and the total adds them up", () => {
  const q = mergeQueue(settled({ submissions: ok(submissions(2)), reports: ok(reports(1)) }));
  assert.equal(q.feedback?.open, 3);
  assert.equal(q.couldNotCharge?.count, 1, "the 7-day window, not the all-time 10");
  assert.equal(q.submissions?.pending, 2);
  assert.equal(q.reports?.open, 1);
  assert.equal(q.total, 7);
  assert.deepEqual(q.errors, {});
});

test("the newest items read as one plain line each, newest first", () => {
  const q = mergeQueue(settled({ submissions: ok(submissions(1)), reports: ok(reports(1)) }));
  assert.deepEqual(q.feedback?.newest[0], { id: "f1", text: "“Test du merci - revue Lune”", at: "2026-10-31T20:05:59.794743+00:00" });
  assert.equal(q.feedback?.newest[1].text, "“[email removed]”", "whitespace is collapsed");
  assert.deepEqual(q.couldNotCharge?.newest[0], { id: "v1", text: "Carrefour Marsa", at: "2026-10-31T19:32:16.961428+00:00" });
  assert.deepEqual(q.submissions?.newest[0], { id: "s1", text: "Borne Lac 2", at: "2026-11-01T08:00:00+00:00" });
  assert.deepEqual(q.reports?.newest[0], { id: "r1", text: "Spam · Shell Hammamet", at: "2026-11-01T22:00:00+00:00" });
});

test("an empty queue is a real zero", () => {
  const q = mergeQueue(settled({
    feedback: ok({ ...feedback(), items: [], total: 0, summary: { ...feedback().summary, open: 0 } }),
    couldNotCharge: ok({ ...visits(), items: [], total: 0, summary: { ...visits().summary, window: { since_days: 7, could_not_charge: 0 } } }),
  }));
  assert.equal(q.total, 0);
  assert.deepEqual([q.feedback?.open, q.couldNotCharge?.count, q.submissions?.pending, q.reports?.open], [0, 0, 0, 0]);
  assert.deepEqual(q.feedback?.newest, []);
});

test("a failed source is unknown, never zero, and the total is unknown", () => {
  const q = mergeQueue(settled({ reports: { status: "rejected", reason: new Error("Review reports are unavailable right now.") } }));
  assert.equal(q.reports, null);
  assert.equal(q.errors.reports, "Review reports are unavailable right now.");
  assert.equal(q.total, null);
  assert.equal(q.feedback?.open, 3, "the other sources still load");
});

test("a malformed body is an error, not a zero", () => {
  const noWindow = { ...visits(), summary: { ...visits().summary, window: undefined } };
  const cases: [QueueKey, unknown][] = [
    ["couldNotCharge", noWindow],
    ["feedback", { items: [], total: 0 }],
    ["submissions", { ...submissions(), counts: { approved: 1 } }],
    ["reports", { ...reports(), open: "2" }],
    ["reports", { ...reports(), items: null }],
    ["feedback", null],
  ];
  for (const [key, body] of cases) {
    const q = mergeQueue(settled({ [key]: ok(body) }));
    assert.equal(q[key], null, `${key}: ${JSON.stringify(body)?.slice(0, 60)}`);
    assert.equal(q.errors[key], "Unexpected response.");
    assert.equal(q.total, null);
  }
});

test("newest keeps at most three items", () => {
  const many = { ...feedback(), items: Array.from({ length: 5 }, (_, i) => ({ ...feedback().items[0], id: `f${i}` })) };
  assert.equal(mergeQueue(settled({ feedback: ok(many) })).feedback?.newest.length, 3);
});

test("each row links to its filtered Community tab", () => {
  assert.deepEqual(QUEUE_LINKS, {
    feedback: "#/community?tab=feedback&status=open",
    couldNotCharge: "#/community?tab=visits&outcome=could_not_charge&since=7",
    submissions: "#/community?tab=submissions&status=pending",
    reports: "#/community?tab=reviews&reports=open",
  });
});

test("each source asks only for its open items", () => {
  assert.match(QUEUE_PATHS.feedback, /^admin-feedback\?/);
  assert.match(QUEUE_PATHS.feedback, /status=open/);
  assert.match(QUEUE_PATHS.couldNotCharge, /^admin-confirmations\?.*since_days=7/);
  assert.match(QUEUE_PATHS.couldNotCharge, /outcome=could_not_charge/);
  assert.match(QUEUE_PATHS.submissions, /^admin-submissions\?.*status=pending/);
  assert.match(QUEUE_PATHS.reports, /^admin-review-reports\?.*status=open/);
});

test("time ago reads like the mock", () => {
  const now = Date.parse("2026-11-02T01:23:38Z");
  assert.equal(timeAgo("2026-10-31T19:32:16Z", now), "1d ago");
  assert.equal(timeAgo("2026-11-01T22:00:00Z", now), "3h ago");
  assert.equal(timeAgo("2026-11-02T01:10:00Z", now), "just now");
  assert.equal(timeAgo("2026-11-02T03:00:00Z", now), "just now", "a clock a little ahead is not the future");
  assert.equal(timeAgo("2026-06-09T21:50:35Z", now), "9 Jun 2026");
  assert.equal(timeAgo("not a date", now), "");
});
