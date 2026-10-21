import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cityPlace,
  fold,
  groupCities,
  mapChargerLocation,
  parseCities,
  parseGovernorates,
  parseLatLng,
  placeLabel,
  slugify,
  validateNewCity,
  withCityNames,
} from "../src/data/locations-model.ts";
import type { City, Governorate } from "../src/data/locations-model.ts";

const governorates: Governorate[] = [
  { code: "TN-21", name_fr: "Nabeul", name_ar: "نابل", name_en: "Nabeul" },
  { code: "TN-11", name_fr: "Tunis", name_ar: "تونس", name_en: "Tunis" },
  { code: "TN-51", name_fr: "Sousse", name_ar: "سوسة", name_en: "Sousse" },
];
const city = (id: string, slug: string, governorate_code: string, name_fr: string, name_ar: string): City => ({
  id: `c1000000-0000-4000-8000-00000000000${id}`,
  slug,
  governorate_code,
  name_fr,
  name_ar,
  name_en: name_fr,
});
const cities = [
  city("1", "hammamet", "TN-21", "Hammamet", "الحمامات"),
  city("2", "nabeul", "TN-21", "Nabeul", "نابل"),
  city("3", "tunis", "TN-11", "Tunis", "تونس"),
  city("4", "la-marsa", "TN-11", "La Marsa", "المرسى"),
  city("5", "sidi-bou-said", "TN-11", "Sidi Bou Saïd", "سيدي بو سعيد"),
];

test("parsers drop malformed reference rows", () => {
  assert.deepEqual(
    parseGovernorates([
      { code: "TN-21", name_fr: " Nabeul ", name_ar: "نابل", name_en: "" },
      { code: "21", name_fr: "Bad code" },
      { code: "TN-22", name_fr: "" },
      null,
    ]),
    [{ code: "TN-21", name_fr: "Nabeul", name_ar: "نابل", name_en: "Nabeul" }],
  );
  assert.deepEqual(parseGovernorates({ not: "an array" }), []);
  const [ok] = parseCities([{ ...cities[0], name_en: null }]);
  assert.equal(ok.name_en, "Hammamet");
  assert.equal(parseCities([{ ...cities[0], id: "nope" }]).length, 0);
  assert.equal(parseCities([{ ...cities[0], governorate_code: "Nabeul" }]).length, 0);
});

test("slugify folds accents, apostrophes and spaces", () => {
  assert.equal(slugify("Sidi Bou Saïd"), "sidi-bou-said");
  assert.equal(slugify("M'saken"), "msaken");
  assert.equal(slugify("  La Marsa  "), "la-marsa");
  assert.equal(slugify("Ksar Hellal (centre)"), "ksar-hellal-centre");
  assert.equal(slugify("الحمامات"), "");
  assert.equal(fold("SIDI BOU SAÏD"), "sidi bou said");
});

test("placeLabel matches the database's legacy label rule", () => {
  assert.equal(placeLabel("Hammamet", "Nabeul"), "Hammamet, Nabeul");
  assert.equal(placeLabel("Tunis", "Tunis"), "Tunis");
  assert.equal(placeLabel(null, null, "Marsa"), "Marsa");
  assert.equal(placeLabel(null, null, "  "), "—");
  assert.equal(cityPlace(cities[0], governorates), "Hammamet, Nabeul");
});

test("mapChargerLocation reads the new reader-RPC columns and falls back to legacy text", () => {
  assert.deepEqual(
    mapChargerLocation({
      city: "Hammamet, Nabeul",
      address: "Avenue de la République",
      city_id: cities[0].id,
      city_fr: "Hammamet",
      city_ar: "الحمامات",
      city_en: "Hammamet",
      governorate_code: "TN-21",
      governorate_fr: "Nabeul",
      governorate_ar: "نابل",
      governorate_en: "Nabeul",
      address_ar: "شارع الجمهورية",
    }),
    {
      city: "Hammamet, Nabeul",
      cityId: cities[0].id,
      cityName: "Hammamet",
      cityNameAr: "الحمامات",
      governorateCode: "TN-21",
      governorateName: "Nabeul",
      governorateNameAr: "نابل",
      place: "Hammamet, Nabeul",
      address: "Avenue de la République",
      addressAr: "شارع الجمهورية",
    },
  );
  // A row from before the migration: only the legacy text.
  const legacy = mapChargerLocation({ city: "Marsa", address: null });
  assert.equal(legacy.place, "Marsa");
  assert.equal(legacy.cityId, null);
  assert.equal(legacy.governorateCode, null);
  assert.equal(legacy.addressAr, "");
  // admin_get_charger after a save: city_id but no joined names yet.
  const saved = mapChargerLocation({ city: "Hammamet, Nabeul", city_id: cities[0].id, address_ar: "" });
  assert.equal(saved.cityId, cities[0].id);
  assert.equal(saved.place, "Hammamet, Nabeul");
  assert.equal(mapChargerLocation({ city: null }).place, "—");
  assert.equal(mapChargerLocation({ city: "x", city_id: "bad", governorate_code: "21" }).cityId, null);
});

test("groupCities groups by governorate A→Z and searches every name", () => {
  const groups = groupCities(cities, governorates);
  assert.deepEqual(
    groups.map((g) => [g.governorate.name_fr, g.cities.map((c) => c.name_fr)]),
    [
      ["Nabeul", ["Hammamet", "Nabeul"]],
      ["Tunis", ["La Marsa", "Sidi Bou Saïd", "Tunis"]],
    ],
  );
  const names = (q: string) => groupCities(cities, governorates, q).flatMap((g) => g.cities.map((c) => c.slug));
  assert.deepEqual(names("sidi bou said"), ["sidi-bou-said"]);
  assert.deepEqual(names("المرسى"), ["la-marsa"]);
  // A governorate name finds all of its cities.
  assert.deepEqual(names("nabeul"), ["hammamet", "nabeul"]);
  assert.deepEqual(names("zzz"), []);
  // A city whose governorate is missing still shows, under its code.
  const orphan = groupCities([city("6", "x", "TN-99", "X", "س")], governorates);
  assert.equal(orphan[0].governorate.name_fr, "TN-99");
});

test("parseLatLng accepts only finite in-range pairs", () => {
  assert.deepEqual(parseLatLng("36.4", "10.6"), { lat: 36.4, lng: 10.6 });
  assert.deepEqual(parseLatLng(36.4, 10.6), { lat: 36.4, lng: 10.6 });
  for (const [lat, lng] of [["", "10"], ["36", " "], ["abc", "10"], ["91", "10"], ["36", "181"]])
    assert.equal(parseLatLng(lat, lng), null);
});

test("validateNewCity mirrors the admin-cities checks", () => {
  const draft = {
    slug: "yasmine-hammamet",
    governorate_code: "TN-21",
    name_fr: " Yasmine Hammamet ",
    name_ar: "ياسمين الحمامات",
    name_en: "Yasmine Hammamet",
    lat: "36.37",
    lng: "10.54",
  };
  assert.deepEqual(validateNewCity(draft, cities), {
    ok: true,
    payload: { ...draft, name_fr: "Yasmine Hammamet", lat: 36.37, lng: 10.54 },
  });
  const error = (patch: Partial<typeof draft>) => {
    const v = validateNewCity({ ...draft, ...patch }, cities);
    return v.ok ? null : v.error;
  };
  assert.match(error({ name_fr: " " })!, /French/);
  assert.match(error({ name_ar: "" })!, /Arabic/);
  assert.match(error({ name_en: "" })!, /English/);
  assert.match(error({ slug: "Yasmine Hammamet" })!, /Slug/);
  assert.match(error({ slug: "hammamet" })!, /already exists/);
  assert.match(error({ governorate_code: "" })!, /governorate/);
  assert.match(error({ lat: "" })!, /latitude/);
});

test("withCityNames fills names for an editor read-back that only has city_id", () => {
  const saved = mapChargerLocation({ city: "Nabeul", city_id: cities[0].id });
  const filled = withCityNames(saved, cities, governorates);
  assert.equal(filled.cityName, "Hammamet");
  assert.equal(filled.governorateCode, "TN-21");
  assert.equal(filled.governorateNameAr, "نابل");
  assert.equal(filled.place, "Hammamet, Nabeul");
  assert.equal(filled.city, "Nabeul");
  // Unknown city, no city, or names already present: unchanged.
  const unknown = mapChargerLocation({ city: "x", city_id: "c1000000-0000-4000-8000-000000000999" });
  assert.equal(withCityNames(unknown, cities, governorates), unknown);
  const none = mapChargerLocation({ city: "x" });
  assert.equal(withCityNames(none, cities, governorates), none);
});
