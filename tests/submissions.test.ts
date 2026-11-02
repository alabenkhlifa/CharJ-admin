import assert from "node:assert/strict";
import { test } from "node:test";
import {
  connectorLine,
  distanceMeters,
  mapsUrl,
  nearbyChargers,
  parseReviewResult,
  parseSubmissions,
  submissionActionMessage,
  submissionsPath,
} from "../src/data/submissions-report.ts";

// Shaped like admin-submissions GET (Task 4 report: items carry every column
// but the raw location, plus lat / lng; connectors decoded to an array).
const body = () => ({
  items: [
    {
      id: "5b1f0000-0000-4000-8000-000000000001",
      submitted_by: "2c3e4f5a-aaaa-4bbb-8ccc-dddddddddddd",
      name: "  Borne Lac 2 ",
      address: "",
      connectors: [{ type: "Type 2", power_kw: 22, count: 2 }, { type: "CCS", power_kw: 60, count: 1 }],
      photos: ["https://x.supabase.co/storage/v1/object/public/charger-photos/a.jpg"],
      notes: "Au parking\ndu centre",
      status: "pending",
      reviewed_at: null,
      reviewed_by: null,
      review_note: null,
      charger_id: null,
      app_version: "1.3.0",
      created_at: "2026-11-01T08:00:00+00:00",
      lat: 36.8321,
      lng: 10.2345,
    },
    {
      id: "5b1f0000-0000-4000-8000-000000000002",
      submitted_by: "",
      name: "Shell Sfax",
      address: "Route de Tunis",
      // Stored text that was never valid JSON: kept raw.
      connectors: "type2 x2",
      photos: null,
      notes: "",
      status: "approved",
      reviewed_at: "2026-11-02T07:00:00+00:00",
      reviewed_by: "admin@charj.tn",
      review_note: "Checked on Maps",
      charger_id: "c0000000-0000-4000-8000-0000000000aa",
      app_version: null,
      created_at: "2026-10-30T08:00:00+00:00",
      lat: null,
      lng: "10.7",
    },
    { name: "no id" },
  ],
  page: 1,
  perPage: 25,
  total: 2,
  counts: { pending: 1, approved: 4, rejected: 2 },
});

test("parseSubmissions maps every field the cards show", () => {
  const parsed = parseSubmissions(body());
  assert.equal(parsed.total, 2);
  assert.deepEqual(parsed.counts, { pending: 1, approved: 4, rejected: 2 });
  assert.equal(parsed.items.length, 2, "a row without an id is skipped");
  const [first, second] = parsed.items;
  assert.equal(first.name, "Borne Lac 2", "the name is trimmed");
  assert.equal(first.notes, "Au parking\ndu centre", "notes keep the driver's line breaks");
  assert.deepEqual(first.connectors, [
    { type: "Type 2", powerKw: 22, count: 2 },
    { type: "CCS", powerKw: 60, count: 1 },
  ]);
  assert.equal(first.connectorsRaw, null);
  assert.deepEqual([first.lat, first.lng], [36.8321, 10.2345]);
  assert.equal(first.status, "pending");
  assert.equal(first.photos.length, 1);
  assert.equal(first.submittedBy, "2c3e4f5a-aaaa-4bbb-8ccc-dddddddddddd");
  assert.equal(second.status, "approved");
  assert.equal(second.reviewedBy, "admin@charj.tn");
  assert.equal(second.reviewNote, "Checked on Maps");
  assert.equal(second.chargerId, "c0000000-0000-4000-8000-0000000000aa");
  assert.deepEqual(second.connectors, [], "an unreadable connectors value is no connector");
  assert.equal(second.connectorsRaw, "type2 x2", "but the raw text is kept to show");
  assert.deepEqual([second.lat, second.lng], [null, null], "no number, no coordinates (never 0, 0)");
  assert.deepEqual(second.photos, []);
  assert.equal(second.appVersion, "");
});

test("parseSubmissions refuses a body it can't trust, rather than showing zeros", () => {
  for (const bad of [null, "oops", [], { items: [] }, { items: "x", counts: { pending: 0, approved: 0, rejected: 0 } }, { items: [], counts: { pending: -1, approved: 0, rejected: 0 } }]) {
    assert.throws(() => parseSubmissions(bad), /Unexpected response/);
  }
});

test("connector cells: odd values are dropped field by field", () => {
  const parsed = parseSubmissions({
    ...body(),
    items: [{ ...body().items[0], connectors: [{ type: "CHAdeMO", power_kw: "50", count: 0 }, "junk", { power_kw: 7 }] }],
  });
  assert.deepEqual(parsed.items[0].connectors, [
    { type: "CHAdeMO", powerKw: null, count: null },
    { type: "", powerKw: 7, count: null },
  ]);
});

test("connectorLine reads as count × type · power", () => {
  assert.equal(connectorLine({ type: "Type 2", powerKw: 22, count: 2 }), "2 × Type 2 · 22 kW");
  assert.equal(connectorLine({ type: "CCS", powerKw: 7.4, count: 1 }), "1 × CCS · 7.4 kW");
  assert.equal(connectorLine({ type: "", powerKw: null, count: null }), "Unknown type · power not given");
});

test("submissionsPath asks for one page of one status", () => {
  assert.equal(submissionsPath("pending", 1), "admin-submissions?status=pending&page=1&perPage=25");
  assert.equal(submissionsPath("all", 3), "admin-submissions?status=all&page=3&perPage=25");
});

test("submissionActionMessage says what happened in plain words", () => {
  assert.equal(submissionActionMessage(409), "Someone already reviewed this");
  assert.equal(submissionActionMessage(409, "already_reviewed"), "Someone already reviewed this");
  assert.match(submissionActionMessage(404), /no longer exists/);
  assert.match(submissionActionMessage(422, "city_not_found"), /No city matches this location/);
  assert.match(submissionActionMessage(422, "connectors_invalid"), /connectors/);
  assert.match(submissionActionMessage(422, "name_missing"), /no name/);
  assert.match(submissionActionMessage(422, "location_invalid"), /location/);
  assert.match(submissionActionMessage(422, "name_ar_too_long"), /Arabic name.*200/);
  assert.match(submissionActionMessage(422, "note_too_long"), /note.*2,000/);
  assert.equal(
    submissionActionMessage(422, "brand_new_reason"),
    "This submission can't become a charger (brand_new_reason).",
    "an unknown reason still says what the server said",
  );
  assert.equal(submissionActionMessage(422), "This submission can't become a charger.");
  assert.match(submissionActionMessage(401), /credentials/);
  assert.match(submissionActionMessage(403), /signed-in admin/);
  assert.match(submissionActionMessage(400), /refused/);
  assert.match(submissionActionMessage(503), /unavailable/);
  assert.equal(submissionActionMessage(500), "Something went wrong (HTTP 500). Try again.");
});

test("parseReviewResult reads the new charger id on approve, none on reject", () => {
  assert.deepEqual(
    parseReviewResult({ ok: true, submission_id: "s1", status: "approved", charger_id: "c1" }),
    { submissionId: "s1", status: "approved", chargerId: "c1" },
  );
  assert.deepEqual(
    parseReviewResult({ ok: true, submission_id: "s1", status: "rejected", charger_id: null }),
    { submissionId: "s1", status: "rejected", chargerId: null },
  );
  for (const bad of [null, {}, { ok: true, submission_id: "s1", status: "pending" }, { ok: false }]) {
    assert.throws(() => parseReviewResult(bad), /Unexpected response/);
  }
});

test("distanceMeters is the great-circle distance", () => {
  assert.equal(distanceMeters(36.8, 10.2, 36.8, 10.2), 0);
  // 0.001° of latitude is about 111 m everywhere.
  const d = distanceMeters(36.8, 10.2, 36.801, 10.2);
  assert.ok(d > 110 && d < 112, String(d));
});

test("nearbyChargers lists chargers within 100 m, nearest first", () => {
  const chargers = [
    { id: "far", name: "Far away", lat: 36.81, lng: 10.2 },
    { id: "b", name: "Total Lac", lat: 36.8006, lng: 10.2 },
    { id: "a", name: "Shell Lac", lat: 36.8002, lng: 10.2 },
    { id: "bad", name: "No pin", lat: Number.NaN, lng: 10.2 },
  ];
  const near = nearbyChargers(36.8, 10.2, chargers);
  assert.deepEqual(near.map((c) => [c.id, c.name, c.meters]), [["a", "Shell Lac", 22], ["b", "Total Lac", 67]]);
  assert.deepEqual(nearbyChargers(36.8, 10.2, chargers, 30).map((c) => c.id), ["a"]);
  assert.deepEqual(nearbyChargers(36.8, 10.2, []), []);
});

test("mapsUrl opens the pin on Google Maps", () => {
  assert.equal(mapsUrl(36.8321, 10.2345), "https://www.google.com/maps/search/?api=1&query=36.8321%2C10.2345");
});
