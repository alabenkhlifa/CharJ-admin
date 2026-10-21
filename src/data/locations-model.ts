// Pure helpers for structured charger locations (governorates → cities →
// chargers.city_id). No imports, so `node --test` can load this file directly.
//
// Live schema (../charj/supabase/migrations/20261021000010_structured_locations.sql):
//   governorates(code 'TN-xx', name_fr, name_ar, name_en)   anon reads names only
//   cities(id, slug, governorate_code, name_fr, name_ar, name_en, location)
//   chargers.city_id + chargers.address_ar; a trigger keeps the legacy
//   `chargers.city` text in sync ("Hammamet, Nabeul") for old app versions.

export type Governorate = {
  code: string;
  name_fr: string;
  name_ar: string;
  name_en: string;
};

export type City = {
  id: string;
  slug: string;
  governorate_code: string;
  name_fr: string;
  name_ar: string;
  name_en: string;
};

export const GOVERNORATE_CODE = /^TN-\d{2}$/;
export const CITY_SLUG = /^[a-z0-9-]+$/;
const UUID = /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i;

export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID.test(value);

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// Rows come straight from PostgREST. Drop anything malformed rather than
// offer an option that can never be saved.
export const parseGovernorates = (rows: unknown): Governorate[] =>
  (Array.isArray(rows) ? rows : []).flatMap((r) => {
    if (!isRecord(r) || typeof r.code !== "string" || !GOVERNORATE_CODE.test(r.code)) return [];
    const name_fr = text(r.name_fr);
    if (!name_fr) return [];
    return [{ code: r.code, name_fr, name_ar: text(r.name_ar), name_en: text(r.name_en) || name_fr }];
  });

export const parseCities = (rows: unknown): City[] =>
  (Array.isArray(rows) ? rows : []).flatMap((r) => {
    if (
      !isRecord(r) ||
      !isUuid(r.id) ||
      typeof r.slug !== "string" ||
      typeof r.governorate_code !== "string" ||
      !GOVERNORATE_CODE.test(r.governorate_code)
    )
      return [];
    const name_fr = text(r.name_fr);
    if (!name_fr) return [];
    return [
      {
        id: r.id,
        slug: r.slug,
        governorate_code: r.governorate_code,
        name_fr,
        name_ar: text(r.name_ar),
        name_en: text(r.name_en) || name_fr,
      },
    ];
  });

// Search folds case and accents, so "sidi bou said" finds "Sidi Bou Saïd".
export const fold = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

// "Sidi Bou Saïd" → "sidi-bou-said", "M'saken" → "msaken".
export const slugify = (nameFr: string) =>
  fold(nameFr)
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// Same rule as the database's legacy label: "Hammamet, Nabeul", but a city
// named like its governorate shows once ("Tunis"). Falls back to `fallback`
// (the legacy `chargers.city` text) when the charger has no city yet.
export const placeLabel = (
  city: string | null | undefined,
  governorate: string | null | undefined,
  fallback = "—",
) => {
  const c = city?.trim();
  const g = governorate?.trim();
  if (c && g) return c === g ? c : `${c}, ${g}`;
  return c || fallback.trim() || "—";
};

// ── Charger rows ──────────────────────────────────────────────────────────
// Reader RPCs (search_chargers & co.) return these trailing columns. Every one
// is optional: admin_get_charger only carries city_id / address_ar, and rows
// from before the migration carry none of them.

export type ChargerLocationRow = {
  city?: string | null;
  address?: string | null;
  city_id?: string | null;
  city_fr?: string | null;
  city_ar?: string | null;
  city_en?: string | null;
  governorate_code?: string | null;
  governorate_fr?: string | null;
  governorate_ar?: string | null;
  governorate_en?: string | null;
  address_ar?: string | null;
};

export type ChargerLocation = {
  // Legacy `chargers.city` text, "—" when empty.
  city: string;
  cityId: string | null;
  cityName: string | null;
  cityNameAr: string | null;
  governorateCode: string | null;
  governorateName: string | null;
  governorateNameAr: string | null;
  // "Hammamet, Nabeul" — or the legacy text for chargers without a city.
  place: string;
  address: string;
  addressAr: string;
};

export const mapChargerLocation = (r: ChargerLocationRow): ChargerLocation => {
  const city = text(r.city) || "—";
  const cityId = isUuid(r.city_id) ? r.city_id : null;
  const cityName = text(r.city_fr) || null;
  const governorateName = text(r.governorate_fr) || null;
  const governorateCode =
    typeof r.governorate_code === "string" && GOVERNORATE_CODE.test(r.governorate_code)
      ? r.governorate_code
      : null;
  return {
    city,
    cityId,
    cityName,
    cityNameAr: text(r.city_ar) || null,
    governorateCode,
    governorateName,
    governorateNameAr: text(r.governorate_ar) || null,
    place: placeLabel(cityName, governorateName, city),
    address: text(r.address),
    addressAr: text(r.address_ar),
  };
};

// admin_get_charger (the editor's read-back) carries city_id but not the
// joined names: fill them from the reference tables so the detail panel shows
// the new city before the list refetch lands.
export const withCityNames = (
  location: ChargerLocation,
  cities: City[],
  governorates: Governorate[],
): ChargerLocation => {
  if (!location.cityId || location.cityName) return location;
  const city = cities.find((c) => c.id === location.cityId);
  if (!city) return location;
  const governorate = governorates.find((g) => g.code === city.governorate_code);
  return {
    ...location,
    cityName: city.name_fr,
    cityNameAr: city.name_ar || null,
    governorateCode: city.governorate_code,
    governorateName: governorate?.name_fr ?? null,
    governorateNameAr: governorate?.name_ar || null,
    place: placeLabel(city.name_fr, governorate?.name_fr, location.city),
  };
};

// ── Picker ────────────────────────────────────────────────────────────────

export type CityGroup = { governorate: Governorate; cities: City[] };

const frCollator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });

const governorateFor = (code: string, governorates: Governorate[]): Governorate =>
  governorates.find((g) => g.code === code) ?? {
    code,
    name_fr: code,
    name_ar: "",
    name_en: code,
  };

// Cities grouped under their governorate, both A→Z by French name. A query
// matches any city or governorate name (FR / AR / EN) or the slug.
export const groupCities = (
  cities: City[],
  governorates: Governorate[],
  query = "",
): CityGroup[] => {
  const needle = fold(query);
  const groups: Record<string, CityGroup> = {};
  for (const city of cities) {
    const governorate = governorateFor(city.governorate_code, governorates);
    if (
      needle &&
      ![
        city.name_fr,
        city.name_ar,
        city.name_en,
        city.slug,
        governorate.name_fr,
        governorate.name_ar,
        governorate.name_en,
      ].some((v) => fold(v).includes(needle))
    )
      continue;
    (groups[governorate.code] ??= { governorate, cities: [] }).cities.push(city);
  }
  return Object.values(groups)
    .sort((a, b) => frCollator.compare(a.governorate.name_fr, b.governorate.name_fr))
    .map((g) => ({
      ...g,
      cities: [...g.cities].sort((a, b) => frCollator.compare(a.name_fr, b.name_fr)),
    }));
};

export const cityPlace = (city: City, governorates: Governorate[]) =>
  placeLabel(city.name_fr, governorateFor(city.governorate_code, governorates).name_fr);

// ── Coordinates ───────────────────────────────────────────────────────────

export const parseLatLng = (
  lat: string | number,
  lng: string | number,
): { lat: number; lng: number } | null => {
  if (String(lat).trim() === "" || String(lng).trim() === "") return null;
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180)
    return null;
  return { lat: la, lng: ln };
};

// ── New city ──────────────────────────────────────────────────────────────

export type NewCityDraft = {
  slug: string;
  governorate_code: string;
  name_fr: string;
  name_ar: string;
  name_en: string;
  lat: string;
  lng: string;
};

export type NewCityPayload = {
  slug: string;
  governorate_code: string;
  name_fr: string;
  name_ar: string;
  name_en: string;
  lat: number;
  lng: number;
};

// Mirrors the admin-cities Edge Function, which re-validates everything.
export const validateNewCity = (
  draft: NewCityDraft,
  existing: City[] = [],
): { ok: true; payload: NewCityPayload } | { ok: false; error: string } => {
  const name_fr = draft.name_fr.trim();
  const name_ar = draft.name_ar.trim();
  const name_en = draft.name_en.trim();
  const slug = draft.slug.trim();
  if (!name_fr) return { ok: false, error: "French name is required" };
  if (!name_ar) return { ok: false, error: "Arabic name is required" };
  if (!name_en) return { ok: false, error: "English name is required" };
  if (!CITY_SLUG.test(slug) || slug.length > 100)
    return { ok: false, error: "Slug: lowercase letters, digits and dashes only" };
  if (existing.some((c) => c.slug === slug))
    return { ok: false, error: `A city with the slug "${slug}" already exists` };
  if (!GOVERNORATE_CODE.test(draft.governorate_code))
    return { ok: false, error: "Choose a governorate" };
  const point = parseLatLng(draft.lat, draft.lng);
  if (!point) return { ok: false, error: "Enter the city's latitude and longitude" };
  return {
    ok: true,
    payload: { slug, governorate_code: draft.governorate_code, name_fr, name_ar, name_en, ...point },
  };
};
