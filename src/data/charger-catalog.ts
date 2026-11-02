// The Chargers page's vocabulary, filters, sort and network numbers. Pure
// module (no React, no Supabase) so tests/charger-catalog.test.ts can run it.
//
// Every filter is a URL param, so a narrowed list is a link you can paste to
// someone else and a refresh lands on the same rows:
//   ?status=operational,planned  ?access=  ?conn=  ?src=  ?gov=  ?cities=
//   ?city=<legacy text>  ?ver=yes|no  ?power=ac|dc50|dc100|dc150
//   ?hours=set|missing  ?upd=7|30|90  ?q=  ?sort=power:desc  ?page=  ?per=
//   ?view=map|stats (the list when absent)  ?id=  ?edit=1  ?add=1

import type { Governorate } from "./locations-model.ts";
import { fold } from "./locations-model.ts";
import { collator, parseSort, type Sort } from "../lib/table-sort.ts";
import type { AccessType, Charger, ChargerSource, ChargerStatus, ConnectorKey } from "./chargers.ts";

// ── Labels ────────────────────────────────────────────────────────────────

export const STATUSES: ChargerStatus[] = ["operational", "under_repair", "planned", "unknown"];
export const STATUS_LABELS: Record<ChargerStatus, string> = {
  operational: "Operational",
  under_repair: "Under repair",
  planned: "Planned",
  unknown: "Unknown",
};

export const ACCESS_TYPES: AccessType[] = ["public", "customers_only", "employees_only", "brand_exclusive"];
export const ACCESS_LABELS: Record<AccessType, string> = {
  public: "Public",
  customers_only: "Customers",
  employees_only: "Employees only",
  brand_exclusive: "Brand-only",
};
/** An access value outside the known four still reads as words. */
export const accessLabel = (a: string): string =>
  (ACCESS_LABELS as Record<string, string>)[a] ?? a.replaceAll("_", " ");

export const CONNECTOR_KEYS: ConnectorKey[] = ["t2", "ccs", "chademo", "t1", "other"];

export const SOURCES: ChargerSource[] = ["ocm", "curated", "community"];
export const SOURCE_LABELS: Record<ChargerSource, string> = {
  ocm: "OCM",
  curated: "Curated",
  community: "Community",
};
export const sourceLabel = (s: string): string => (SOURCE_LABELS as Record<string, string>)[s] ?? s;

// ── Views ─────────────────────────────────────────────────────────────────

export type ChargersView = "list" | "map" | "stats";
export const parseView = (raw: string | null): ChargersView => (raw === "map" || raw === "stats" ? raw : "list");

// ── Power buckets (the Power filter and the network's power card) ─────────

export type PowerBucket = "ac" | "dc50" | "dc100" | "dc150";
export const POWER_BUCKETS: PowerBucket[] = ["ac", "dc50", "dc100", "dc150"];
export const POWER_LABELS: Record<PowerBucket, string> = {
  ac: "AC ≤22 kW",
  dc50: "DC 50 kW",
  dc100: "DC 100–150 kW",
  dc150: "DC 150 kW+",
};
export const POWER_PREDICATES: Record<PowerBucket, (kw: number) => boolean> = {
  ac: (kw) => kw > 0 && kw <= 22,
  dc50: (kw) => kw > 22 && kw < 100,
  dc100: (kw) => kw >= 100 && kw < 150,
  dc150: (kw) => kw >= 150,
};
export const powerBucket = (kw: number): PowerBucket | null => POWER_BUCKETS.find((b) => POWER_PREDICATES[b](kw)) ?? null;

// ── Filters ───────────────────────────────────────────────────────────────

export type PowerFilter = "all" | PowerBucket;
export type TriFilter = "all" | "yes" | "no";
export type HoursFilter = "all" | "set" | "missing";
export type UpdatedFilter = "all" | "7" | "30" | "90";

/** `cities` value for chargers not linked to a city yet (city_id IS NULL). */
export const NO_CITY = "none";

export type ChargerFilters = {
  status: string[];
  access: string[];
  conn: string[];
  src: string[];
  gov: string[];
  cities: string[];
  /** Links saved before structured locations used `city=<legacy text>`: a text match. */
  legacyCity: string[];
  verified: TriFilter;
  power: PowerFilter;
  hours: HoursFilter;
  updated: UpdatedFilter;
  q: string;
};

const listParam = (params: URLSearchParams, key: string): string[] => (params.get(key) ?? "").split(",").filter(Boolean);
const oneOf = <T extends string>(params: URLSearchParams, key: string, allowed: readonly T[], fallback: T): T => {
  const raw = params.get(key);
  return allowed.includes(raw as T) ? (raw as T) : fallback;
};

export const readFilters = (params: URLSearchParams): ChargerFilters => ({
  status: listParam(params, "status"),
  access: listParam(params, "access"),
  conn: listParam(params, "conn"),
  src: listParam(params, "src"),
  gov: listParam(params, "gov"),
  cities: listParam(params, "cities"),
  legacyCity: listParam(params, "city"),
  verified: oneOf<TriFilter>(params, "ver", ["all", "yes", "no"], "all"),
  power: oneOf<PowerFilter>(params, "power", ["all", ...POWER_BUCKETS], "all"),
  hours: oneOf<HoursFilter>(params, "hours", ["all", "set", "missing"], "all"),
  updated: oneOf<UpdatedFilter>(params, "upd", ["all", "7", "30", "90"], "all"),
  q: params.get("q") ?? "",
});

/** How many filters narrow the rows (the search box is counted apart). */
export const filterCount = (f: ChargerFilters): number =>
  f.status.length +
  f.access.length +
  f.conn.length +
  f.src.length +
  f.gov.length +
  f.cities.length +
  f.legacyCity.length +
  (f.verified === "all" ? 0 : 1) +
  (f.power === "all" ? 0 : 1) +
  (f.hours === "all" ? 0 : 1) +
  (f.updated === "all" ? 0 : 1);

/** Wipes the search and every filter (and the page, which no longer means anything). */
export const CLEAR_ALL: Record<string, null> = {
  q: null,
  status: null,
  access: null,
  conn: null,
  src: null,
  gov: null,
  cities: null,
  city: null,
  ver: null,
  power: null,
  hours: null,
  upd: null,
  page: null,
};

const ts = (iso: string) => {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
};

/** `now` is a snapshot (page open time), so "last 7 days" doesn't creep while paging. */
export const applyFilters = (chargers: Charger[], f: ChargerFilters, now: number): Charger[] => {
  // Folded so "sidi bou said" finds "Sidi Bou Saïd".
  const needle = fold(f.q);
  const cutoff = f.updated === "all" ? 0 : now - Number(f.updated) * 86_400_000;
  const powerOk = f.power === "all" ? null : POWER_PREDICATES[f.power];
  return chargers.filter((c) => {
    if (f.status.length && !f.status.includes(c.status)) return false;
    if (f.access.length && !f.access.includes(c.access)) return false;
    if (f.src.length && !f.src.includes(c.source)) return false;
    if (f.gov.length && !(c.governorateCode && f.gov.includes(c.governorateCode))) return false;
    if (f.cities.length && !f.cities.includes(c.cityId ?? NO_CITY)) return false;
    if (f.legacyCity.length) {
      const hay = fold(`${c.city} ${c.place} ${c.cityNameAr ?? ""}`);
      if (!f.legacyCity.some((v) => hay.includes(fold(v)))) return false;
    }
    if (f.conn.length && !f.conn.some((k) => c.connectors.includes(k as ConnectorKey))) return false;
    if (f.verified === "yes" && !c.verified) return false;
    if (f.verified === "no" && c.verified) return false;
    if (powerOk && !powerOk(c.power)) return false;
    if (f.hours === "set" && c.hours === "—") return false;
    if (f.hours === "missing" && c.hours !== "—") return false;
    if (cutoff && ts(c.updatedAt) < cutoff) return false;
    if (needle) {
      const hay = [c.name, c.place, c.city, c.cityNameAr, c.governorateNameAr, c.address, c.addressAr, c.id].join(" ");
      if (!fold(hay).includes(needle)) return false;
    }
    return true;
  });
};

// ── Sorting ───────────────────────────────────────────────────────────────

export type SortKey = "name" | "city" | "power" | "status" | "access" | "hours" | "source" | "updated";
export const SORT_KEYS: SortKey[] = ["name", "city", "power", "status", "access", "hours", "source", "updated"];
const SORT_KEY_SET = new Set<string>(SORT_KEYS);
export const SORT_LABELS: Record<SortKey, string> = {
  name: "Name",
  city: "City",
  power: "Power",
  status: "Status",
  access: "Access",
  hours: "Hours",
  source: "Source",
  updated: "Updated",
};
/** A text column starts A→Z; a number or a date starts with the biggest / newest. */
export const DESC_FIRST = new Set<SortKey>(["power", "updated"]);
export const DEFAULT_SORT: Sort<SortKey> = { key: "name", dir: "asc" };
export const readSort = (params: URLSearchParams): Sort<SortKey> => parseSort<SortKey>(params.get("sort"), SORT_KEY_SET, DEFAULT_SORT);

const COMPARATORS: Record<SortKey, (a: Charger, b: Charger) => number> = {
  name: (a, b) => collator.compare(a.name, b.name),
  city: (a, b) => collator.compare(a.place, b.place),
  power: (a, b) => a.power - b.power,
  status: (a, b) => collator.compare(STATUS_LABELS[a.status], STATUS_LABELS[b.status]),
  access: (a, b) => collator.compare(accessLabel(a.access), accessLabel(b.access)),
  hours: (a, b) => collator.compare(a.hours, b.hours),
  source: (a, b) => collator.compare(a.source, b.source),
  updated: (a, b) => ts(a.updatedAt) - ts(b.updatedAt),
};

/** Stable tie-break on name, so equal statuses don't reshuffle between renders. */
export const sortChargers = (chargers: Charger[], sort: Sort<SortKey>): Charger[] => {
  const cmp = COMPARATORS[sort.key];
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...chargers].sort((a, b) => sign * cmp(a, b) || collator.compare(a.name, b.name));
};

/** The phone's sort picker: every column both ways, in words. */
export const sortOptionLabel = (key: SortKey, dir: "asc" | "desc"): string => {
  const first = DESC_FIRST.has(key) ? "desc" : "asc";
  const natural = dir === first;
  if (key === "power") return `Power, ${natural ? "highest" : "lowest"} first`;
  if (key === "updated") return `Updated, ${natural ? "newest" : "oldest"} first`;
  return `${SORT_LABELS[key]}, ${dir === "asc" ? "A to Z" : "Z to A"}`;
};

// ── Pages ─────────────────────────────────────────────────────────────────

export const PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_PER_PAGE = 25;
export const readPerPage = (params: URLSearchParams): number => {
  const n = Number(params.get("per"));
  return (PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PER_PAGE;
};
/** A page past the end lands on the last page; anything unreadable on the first. */
export const readPage = (params: URLSearchParams, total: number, perPage: number): number => {
  const pages = Math.max(1, Math.ceil(total / perPage));
  return Math.min(Math.max(1, Number(params.get("page")) || 1), pages);
};

// ── Filter menus (with counts) ────────────────────────────────────────────

export type Option = { v: string; l: string; count?: number };

/** Governorates that have chargers, A→Z, each with its count. */
export const governorateOptions = (chargers: Charger[]): Option[] => {
  const counts: Record<string, { l: string; count: number }> = {};
  for (const c of chargers) {
    if (!c.governorateCode) continue;
    const entry = (counts[c.governorateCode] ??= { l: c.governorateName ?? c.governorateCode, count: 0 });
    entry.count += 1;
  }
  return Object.entries(counts)
    .sort((a, b) => collator.compare(a[1].l, b[1].l))
    .map(([v, { l, count }]) => ({ v, l, count }));
};

/**
 * Cities with chargers, narrowed to the chosen governorates (keeping any city
 * already selected so it can still be unticked), most chargers first. "No
 * city" comes first: it is the cleanup queue.
 */
export const cityOptions = (chargers: Charger[], gov: string[], selected: string[]): Option[] => {
  const counts: Record<string, { l: string; gov: string | null; count: number }> = {};
  let unlinked = 0;
  for (const c of chargers) {
    if (!c.cityId) {
      unlinked += 1;
      continue;
    }
    const entry = (counts[c.cityId] ??= { l: c.place, gov: c.governorateCode, count: 0 });
    entry.count += 1;
  }
  const cities = Object.entries(counts)
    .filter(([v, { gov: g }]) => !gov.length || (g !== null && gov.includes(g)) || selected.includes(v))
    .sort((a, b) => b[1].count - a[1].count || collator.compare(a[1].l, b[1].l))
    .map(([v, { l, count }]) => ({ v, l, count }));
  return unlinked || selected.includes(NO_CITY) ? [{ v: NO_CITY, l: "No city", count: unlinked }, ...cities] : cities;
};

// ── About the network ─────────────────────────────────────────────────────

export type NetworkStats = {
  total: number;
  verified: number;
  status: Record<ChargerStatus, number>;
  /** Chargers offering each connector type: one with Type 2 and CCS counts in both. */
  connectors: Record<ConnectorKey, number>;
  /** Every plug across the network (a connector's count, at least 1). */
  plugs: number;
  access: Record<AccessType, number>;
  power: Record<PowerBucket, number>;
  /** No connector with a power figure. */
  powerUnknown: number;
  /** Over 22 kW (the DC buckets). */
  fast: number;
  /**
   * Governorates with at least one charger, most first. Once the reference
   * list has loaded, only governorates it knows: then the covered count is
   * always the number of bars.
   */
  governorates: { code: string; name: string; count: number }[];
  /** Reference governorates with no charger, A→Z. */
  uncovered: string[];
  /** How many governorates the reference list holds (0 while it hasn't loaded). */
  referenceCount: number;
  /** Not linked to a city (so no governorate either). */
  unlinked: number;
  /** Not counted by governorate: no city, or a governorate the reference list doesn't know. */
  unplaced: number;
  noHours: number;
};

const zeros = <K extends string>(keys: readonly K[]): Record<K, number> =>
  Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;

/** The catalogue as it stands: a snapshot, never a series. */
export const networkStats = (chargers: Charger[], reference: Governorate[] = []): NetworkStats => {
  const status = zeros(STATUSES);
  const connectors = zeros(CONNECTOR_KEYS);
  const access = zeros(ACCESS_TYPES);
  const power = zeros(POWER_BUCKETS);
  const govs: Record<string, { name: string; count: number }> = {};
  let verified = 0;
  let plugs = 0;
  let powerUnknown = 0;
  let unlinked = 0;
  let noHours = 0;
  for (const c of chargers) {
    if (c.verified) verified += 1;
    if (c.status in status) status[c.status] += 1;
    if (c.access in access) access[c.access] += 1;
    for (const k of c.connectors) if (k in connectors) connectors[k] += 1;
    for (const raw of c.rawConnectors) plugs += typeof raw.count === "number" && raw.count > 0 ? raw.count : 1;
    const bucket = powerBucket(c.power);
    if (bucket) power[bucket] += 1;
    else powerUnknown += 1;
    if (!c.cityId) unlinked += 1;
    if (c.hours === "—") noHours += 1;
    if (c.governorateCode) {
      const g = (govs[c.governorateCode] ??= { name: c.governorateName ?? c.governorateCode, count: 0 });
      g.count += 1;
    }
  }
  const known = new Set(reference.map((g) => g.code));
  const matched = Object.entries(govs).filter(([code]) => !reference.length || known.has(code));
  const governorates = matched
    .map(([code, g]) => ({ code, ...g }))
    .sort((a, b) => b.count - a.count || collator.compare(a.name, b.name));
  const placed = governorates.reduce((n, g) => n + g.count, 0);
  const uncovered = reference
    .filter((g) => !govs[g.code])
    .map((g) => g.name_fr)
    .sort((a, b) => collator.compare(a, b));
  return {
    total: chargers.length,
    verified,
    status,
    connectors,
    plugs,
    access,
    power,
    powerUnknown,
    fast: power.dc50 + power.dc100 + power.dc150,
    governorates,
    uncovered,
    referenceCount: reference.length,
    unlinked,
    unplaced: chargers.length - placed,
    noHours,
  };
};
