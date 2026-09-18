import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildChanges,
  createDraft,
  DAYS,
} from "../src/data/charger-editor-model.ts";
import type { AdminCharger } from "../src/data/charger-editor-model.ts";

export const fixture = (): AdminCharger => ({
  id: "ee625f21-1111-4444-8888-111111111111",
  name: "Africa Jade Thalasso Hôtel Korba",
  name_ar: "",
  name_fr: "Africa Jade",
  latitude: 36.5597,
  longitude: 10.8577,
  address: "Korba",
  city: "Nabeul",
  operator: "Hotel",
  status: "operational",
  source: "ocm",
  ocm_id: 312495,
  access_type: "customers_only",
  connectors: [{ type: "Type 2", power_kw: 11, count: 1, voltage: 230 }],
  working_hours: {
    weekly: {
      mon: [
        { from: "08:00", to: "12:00", note: "morning" },
        { from: "14:00", to: "18:00" },
      ],
      sun: [],
    },
    timezone: "Africa/Tunis",
  },
  exclusive_to: [],
  amenities: [],
  photos: [],
  contact_id: null,
  contact_phone: null,
  is_verified: true,
  verified_by: "ala",
  verified_at: "2026-09-17T12:00:12.123Z",
  manual_overrides: { status: "operational" },
  created_at: "2026-04-01T12:00:00Z",
  updated_at: "2026-09-18T08:00:00.123456Z",
});

test("opening and saving without changes does not pin fields or truncate timestamps", () => {
  const c = fixture();
  assert.deepEqual(buildChanges(createDraft(c), c), {});
});
test("sends only edited fields and retains connector extension properties", () => {
  const c = fixture(),
    d = createDraft(c);
  d.connectors[0].power = "22";
  assert.deepEqual(buildChanges(d, c), {
    connectors: [{ type: "Type 2", power_kw: 22, count: 1, voltage: 230 }],
  });
});
test("keeps unknown days distinct from closed and preserves hours extensions", () => {
  const c = fixture(),
    d = createDraft(c);
  d.days.mon.ranges[0].to = "13:00";
  assert.equal(d.days.tue.mode, "unknown");
  assert.equal(d.days.sun.mode, "closed");
  assert.deepEqual(buildChanges(d, c).working_hours, {
    timezone: "Africa/Tunis",
    weekly: {
      mon: [
        { from: "08:00", to: "13:00", note: "morning" },
        { from: "14:00", to: "18:00" },
      ],
      sun: [],
    },
  });
});
test("24/7 generates seven all-day ranges and can be cleared to SQL null", () => {
  const c = fixture(),
    d = createDraft(c);
  d.hoursMode = "always";
  assert.deepEqual(buildChanges(d, c).working_hours, {
    timezone: "Africa/Tunis",
    weekly: Object.fromEntries(
      DAYS.map((day) => [day, [{ from: "00:00", to: "24:00" }]]),
    ),
  });
  d.hoursMode = "unknown";
  assert.equal(buildChanges(d, c).working_hours, null);
});
test("legacy always_open data survives an unrelated edit", () => {
  const c = fixture();
  c.working_hours = { always_open: true };
  const d = createDraft(c);
  d.name = "Updated";
  assert.equal(d.hoursMode, "always");
  assert.deepEqual(buildChanges(d, c), { name: "Updated" });
});
test("rejects overlapping and overnight ranges and accepts 24:00 closing time", () => {
  const c = fixture(),
    d = createDraft(c);
  d.days.mon.ranges[0].to = "15:00";
  assert.throws(() => buildChanges(d, c), /overlap/);
  d.days.mon.ranges = [{ from: "22:00", to: "02:00" }];
  assert.throws(() => buildChanges(d, c), /end after/);
  d.days.mon.ranges = [{ from: "22:00", to: "24:00" }];
  assert.doesNotThrow(() => buildChanges(d, c));
});
test("rejects empty coordinates, invalid connector numbers, and empty brand restriction", () => {
  for (const mutate of [
    (d: ReturnType<typeof createDraft>) => {
      d.latitude = "";
    },
    (d: ReturnType<typeof createDraft>) => {
      d.connectors[0].power = "NaN";
    },
    (d: ReturnType<typeof createDraft>) => {
      d.connectors[0].count = "1.5";
    },
    (d: ReturnType<typeof createDraft>) => {
      d.access_type = "brand_exclusive";
    },
  ]) {
    const c = fixture(),
      d = createDraft(c);
    mutate(d);
    assert.throws(() => buildChanges(d, c));
  }
});
test("clears optional fields and verification explicitly", () => {
  const c = fixture();
  c.photos = ["https://example.com/a.jpg"];
  c.contact_phone = "+216 12345678";
  const d = createDraft(c);
  d.photos = [];
  d.contact_phone = "";
  d.is_verified = false;
  assert.deepEqual(buildChanges(d, c), {
    photos: [],
    contact_phone: null,
    is_verified: false,
    verified_by: null,
    verified_at: null,
  });
});
test("validates photo URL protocol and supports custom connector types", () => {
  const c = fixture(),
    d = createDraft(c);
  d.photos = ["javascript:alert(1)"];
  assert.throws(() => buildChanges(d, c), /HTTP/);
  d.photos = ["https://example.com/a.jpg"];
  d.connectors[0].type = "GB/T";
  assert.equal(
    (buildChanges(d, c).connectors as { type: string }[])[0].type,
    "GB/T",
  );
});
