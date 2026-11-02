import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyFilters,
  CLEAR_ALL,
  cityOptions,
  filterCount,
  governorateOptions,
  networkStats,
  NO_CITY,
  parseView,
  readFilters,
  readPage,
  readPerPage,
  readSort,
  sortChargers,
  sortOptionLabel,
} from "../src/data/charger-catalog.ts";
import type { Charger } from "../src/data/chargers.ts";

const NOW = Date.parse("2026-11-02T12:00:00Z");
const day = 86_400_000;

const charger = (over: Partial<Charger> & { id: string }): Charger => ({
  name: over.id,
  city: "—",
  cityId: null,
  cityName: null,
  cityNameAr: null,
  governorateCode: null,
  governorateName: null,
  governorateNameAr: null,
  place: "—",
  address: "",
  addressAr: "",
  highwayDirection: null,
  lat: 36.8,
  lng: 10.2,
  connectors: ["t2"],
  rawConnectors: [{ type: "Type 2", power_kw: 22, count: 2 }],
  power: 22,
  status: "operational",
  access: "public",
  verified: false,
  verifiedBy: null,
  source: "ocm",
  hours: "—",
  workingHours: null,
  amenities: [],
  ocmId: null,
  updatedAt: new Date(NOW - 2 * day).toISOString(),
  ...over,
});

const korba = charger({
  id: "a-korba",
  name: "Africa Jade Korba",
  cityId: "c1000000-0000-4000-8000-000000000001",
  cityName: "Korba",
  cityNameAr: "قربة",
  governorateCode: "TN-21",
  governorateName: "Nabeul",
  place: "Korba, Nabeul",
  verified: true,
  hours: "24/7",
});
const sidi = charger({
  id: "b-sidi",
  name: "Sidi Bou Saïd Station",
  cityId: "c1000000-0000-4000-8000-000000000002",
  cityName: "Sidi Bou Saïd",
  governorateCode: "TN-12",
  governorateName: "Tunis",
  place: "Sidi Bou Saïd, Tunis",
  connectors: ["ccs", "t2"],
  rawConnectors: [
    { type: "CCS", power_kw: 120, count: 1 },
    { type: "Type 2", power_kw: 22, count: 0 },
  ],
  power: 120,
  status: "under_repair",
  access: "customers_only",
  source: "curated",
  updatedAt: new Date(NOW - 40 * day).toISOString(),
});
const unlinked = charger({ id: "c-old", name: "Old Text Charger", city: "Sousse", place: "Sousse", power: 0, rawConnectors: [], connectors: [], status: "planned" });

test("views: list unless map or stats", () => {
  assert.equal(parseView(null), "list");
  assert.equal(parseView("map"), "map");
  assert.equal(parseView("stats"), "stats");
  assert.equal(parseView("bogus"), "list");
});

test("filters read from the URL; unknown values fall back to all", () => {
  const f = readFilters(new URLSearchParams("status=operational,planned&ver=maybe&power=dc100&upd=7&q=tunis&city=Sousse"));
  assert.deepEqual(f.status, ["operational", "planned"]);
  assert.equal(f.verified, "all");
  assert.equal(f.power, "dc100");
  assert.equal(f.updated, "7");
  assert.equal(f.q, "tunis");
  assert.deepEqual(f.legacyCity, ["Sousse"]);
  assert.equal(filterCount(f), 5);
  assert.equal(filterCount(readFilters(new URLSearchParams("q=x"))), 0);
});

test("clear all wipes every filter key and the page", () => {
  assert.deepEqual(Object.keys(CLEAR_ALL).sort(), ["access", "cities", "city", "conn", "gov", "hours", "page", "power", "q", "src", "status", "upd", "ver"]);
});

test("applyFilters: status, connector, power, verified, hours, updated, city, legacy text, folded search", () => {
  const all = [korba, sidi, unlinked];
  const run = (q: string) => applyFilters(all, readFilters(new URLSearchParams(q)), NOW).map((c) => c.id);
  assert.deepEqual(run(""), ["a-korba", "b-sidi", "c-old"]);
  assert.deepEqual(run("status=under_repair,planned"), ["b-sidi", "c-old"]);
  assert.deepEqual(run("conn=ccs"), ["b-sidi"]);
  assert.deepEqual(run("power=dc100"), ["b-sidi"]);
  assert.deepEqual(run("power=ac"), ["a-korba"]);
  assert.deepEqual(run("ver=yes"), ["a-korba"]);
  assert.deepEqual(run("ver=no"), ["b-sidi", "c-old"]);
  assert.deepEqual(run("hours=set"), ["a-korba"]);
  assert.deepEqual(run("hours=missing"), ["b-sidi", "c-old"]);
  assert.deepEqual(run("upd=30"), ["a-korba", "c-old"]);
  assert.deepEqual(run(`cities=${NO_CITY}`), ["c-old"]);
  assert.deepEqual(run("gov=TN-21"), ["a-korba"]);
  assert.deepEqual(run("city=sousse"), ["c-old"]);
  assert.deepEqual(run("src=curated"), ["b-sidi"]);
  assert.deepEqual(run("access=customers_only"), ["b-sidi"]);
  assert.deepEqual(run("q=sidi%20bou%20said"), ["b-sidi"], "accents folded");
  assert.deepEqual(run("q=%D9%82%D8%B1%D8%A8%D8%A9"), ["a-korba"], "Arabic city name");
  assert.deepEqual(run("q=c-old"), ["c-old"], "by id");
});

test("sort: by column both ways, name breaks ties", () => {
  const all = [unlinked, sidi, korba];
  assert.deepEqual(sortChargers(all, readSort(new URLSearchParams(""))).map((c) => c.id), ["a-korba", "c-old", "b-sidi"]);
  assert.deepEqual(sortChargers(all, readSort(new URLSearchParams("sort=power:desc"))).map((c) => c.id), ["b-sidi", "a-korba", "c-old"]);
  assert.deepEqual(sortChargers(all, readSort(new URLSearchParams("sort=updated:asc"))).map((c) => c.id), ["b-sidi", "a-korba", "c-old"]);
  assert.deepEqual(readSort(new URLSearchParams("sort=bogus:desc")), { key: "name", dir: "asc" });
  assert.equal(sortOptionLabel("power", "desc"), "Power, highest first");
  assert.equal(sortOptionLabel("updated", "asc"), "Updated, oldest first");
  assert.equal(sortOptionLabel("city", "desc"), "City, Z to A");
});

test("pages: known sizes only, a page past the end lands on the last", () => {
  assert.equal(readPerPage(new URLSearchParams("per=50")), 50);
  assert.equal(readPerPage(new URLSearchParams("per=33")), 25);
  assert.equal(readPage(new URLSearchParams("page=9"), 60, 25), 3);
  assert.equal(readPage(new URLSearchParams("page=x"), 60, 25), 1);
  assert.equal(readPage(new URLSearchParams("page=2"), 0, 25), 1);
});

test("filter menus carry counts; No city first while any is unlinked", () => {
  assert.deepEqual(governorateOptions([korba, sidi, unlinked]), [
    { v: "TN-21", l: "Nabeul", count: 1 },
    { v: "TN-12", l: "Tunis", count: 1 },
  ]);
  const cities = cityOptions([korba, sidi, unlinked], ["TN-21"], []);
  assert.deepEqual(cities.map((c) => [c.v, c.count]), [[NO_CITY, 1], [korba.cityId, 1]]);
  assert.equal(cityOptions([korba], [], []).some((c) => c.v === NO_CITY), false);
});

test("network stats: counts per status, connector, access, power, governorate", () => {
  const s = networkStats([korba, sidi, unlinked], [
    { code: "TN-21", name_fr: "Nabeul", name_ar: "", name_en: "Nabeul" },
    { code: "TN-12", name_fr: "Tunis", name_ar: "", name_en: "Tunis" },
    { code: "TN-83", name_fr: "Tataouine", name_ar: "", name_en: "Tataouine" },
    { code: "TN-42", name_fr: "Kasserine", name_ar: "", name_en: "Kasserine" },
  ]);
  assert.equal(s.total, 3);
  assert.equal(s.verified, 1);
  assert.deepEqual(s.status, { operational: 1, under_repair: 1, planned: 1, unknown: 0 });
  assert.deepEqual(s.connectors, { t2: 2, ccs: 1, chademo: 0, t1: 0, other: 0 });
  assert.equal(s.plugs, 4, "2 + 1 + a count of 0 read as one plug");
  assert.deepEqual(s.access, { public: 2, customers_only: 1, employees_only: 0, brand_exclusive: 0 });
  assert.deepEqual(s.power, { ac: 1, dc50: 0, dc100: 1, dc150: 0 });
  assert.equal(s.powerUnknown, 1);
  assert.equal(s.fast, 1);
  assert.deepEqual(s.governorates, [
    { code: "TN-21", name: "Nabeul", count: 1 },
    { code: "TN-12", name: "Tunis", count: 1 },
  ]);
  assert.deepEqual(s.uncovered, ["Kasserine", "Tataouine"]);
  assert.equal(s.referenceCount, 4);
  assert.equal(s.unlinked, 1);
  assert.equal(s.noHours, 2);
});

test("network stats on an empty catalogue: zeros, never NaN", () => {
  const s = networkStats([], []);
  assert.equal(s.total, 0);
  assert.equal(s.plugs, 0);
  assert.ok(Object.values(s.status).every((n) => n === 0));
  assert.deepEqual(s.governorates, []);
  assert.ok(!JSON.stringify(s).includes("NaN"));
});
