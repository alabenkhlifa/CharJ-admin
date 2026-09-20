import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { APIProvider, Map, Marker } from "@vis.gl/react-google-maps";
import { AddChargerModal } from "../components/add-charger-modal";
import { EditChargerDrawer } from "../components/edit-charger-drawer";
import { Card, EmptyState } from "../components/card";
import { iconBtnStyle } from "../components/charts";
import { MultiSelectChip, type MultiOption } from "../components/multi-select-chip";
import { Pagination, DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "../components/pagination";
import { SelectChip } from "../components/select-chip";
import { SortableTh, Th } from "../components/table";
import {
  collator,
  nextSort,
  parseSort,
  serializeSort,
  type Sort,
} from "../lib/table-sort";
import { AmenityIcon, labelForAmenity } from "../lib/amenity-icons";
import { downloadCsv, stampedFilename } from "../lib/csv";
import { Icons } from "../lib/icons";
import { darkMapStyle, lightMapStyle } from "../lib/map-styles";
import { useCurrentTheme } from "../lib/use-theme";
import {
  CONNECTOR_COLORS,
  CONNECTOR_LABELS,
  STATUS_COLORS,
  useChargers,
  mapRawCharger,
  type RawChargerRow,
  type AccessType,
  type Charger,
  type ChargerSource,
  type ChargerStatus,
  type ConnectorKey,
  type WorkingHours,
} from "../data/chargers";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "";
const ADMIN_API_SECRET = import.meta.env.VITE_ADMIN_API_SECRET ?? "";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const ADMIN_API_CONFIGURED = Boolean(ADMIN_API_SECRET && SUPABASE_URL);

// ── Labels ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ChargerStatus, string> = {
  operational: "Operational",
  under_repair: "Under repair",
  planned: "Planned",
  unknown: "Unknown",
};

const STATUS_CHIP_COLORS: Record<ChargerStatus, string> = {
  operational: "var(--green)",
  under_repair: "var(--amber)",
  planned: "var(--indigo)",
  unknown: "var(--slate)",
};

const ACCESS_LABELS: Record<AccessType, string> = {
  public: "Public",
  customers_only: "Customers",
  employees_only: "Employees only",
  brand_exclusive: "Brand-only",
};

const ACCESS_CHIP_COLORS: Record<AccessType, string> = {
  public: "var(--accent)",
  customers_only: "var(--indigo)",
  employees_only: "var(--indigo)",
  brand_exclusive: "var(--violet)",
};

// ── Filter vocabulary ─────────────────────────────────────────────────────
// Every filter is a URL param, so a narrowed table is a link you can paste to
// someone else and a refresh lands on the same rows.

type PowerFilter = "all" | "ac" | "dc50" | "dc100" | "dc150";
type TriFilter = "all" | "yes" | "no";
type HoursFilter = "all" | "set" | "missing";
type UpdatedFilter = "all" | "7" | "30" | "90";

// Thresholds mirror the Overview power histogram so both pages bucket the
// same charger the same way.
const POWER_PREDICATES: Record<Exclude<PowerFilter, "all">, (kw: number) => boolean> = {
  ac: (kw) => kw > 0 && kw <= 22,
  dc50: (kw) => kw > 22 && kw < 100,
  dc100: (kw) => kw >= 100 && kw < 150,
  dc150: (kw) => kw >= 150,
};

const POWER_OPTIONS: { v: PowerFilter; l: string }[] = [
  { v: "all", l: "Any" },
  { v: "ac", l: "AC ≤22 kW" },
  { v: "dc50", l: "DC 50 kW" },
  { v: "dc100", l: "DC 100–150 kW" },
  { v: "dc150", l: "DC 150 kW+" },
];

const STATUS_OPTIONS: MultiOption[] = (
  ["operational", "under_repair", "planned", "unknown"] as ChargerStatus[]
).map((v) => ({ v, l: STATUS_LABELS[v] }));

const ACCESS_OPTIONS: MultiOption[] = (
  ["public", "customers_only", "employees_only", "brand_exclusive"] as AccessType[]
).map((v) => ({ v, l: ACCESS_LABELS[v] }));

const CONNECTOR_OPTIONS: MultiOption[] = (
  ["t2", "ccs", "chademo", "t1", "other"] as ConnectorKey[]
).map((v) => ({ v, l: CONNECTOR_LABELS[v] }));

const SOURCE_OPTIONS: MultiOption[] = [
  { v: "ocm", l: "OCM" },
  { v: "curated", l: "Curated" },
  { v: "community", l: "Community" },
];

// ── Sorting ───────────────────────────────────────────────────────────────

type SortKey = "name" | "city" | "power" | "status" | "access" | "hours" | "source" | "updated";

const SORT_KEYS = new Set<string>([
  "name",
  "city",
  "power",
  "status",
  "access",
  "hours",
  "source",
  "updated",
]);

// Clicking a text column starts A→Z; clicking a number or a date starts with
// the biggest / newest, which is what you're looking for when you click it.
const DESC_FIRST = new Set<SortKey>(["power", "updated"]);

const DEFAULT_SORT: Sort<SortKey> = { key: "name", dir: "asc" };

const ts = (iso: string) => {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
};

const COMPARATORS: Record<SortKey, (a: Charger, b: Charger) => number> = {
  name: (a, b) => collator.compare(a.name, b.name),
  city: (a, b) => collator.compare(a.city, b.city),
  power: (a, b) => a.power - b.power,
  status: (a, b) => collator.compare(STATUS_LABELS[a.status], STATUS_LABELS[b.status]),
  access: (a, b) => collator.compare(ACCESS_LABELS[a.access], ACCESS_LABELS[b.access]),
  hours: (a, b) => collator.compare(a.hours, b.hours),
  source: (a, b) => collator.compare(a.source, b.source),
  updated: (a, b) => ts(a.updatedAt) - ts(b.updatedAt),
};

// ── Chips ─────────────────────────────────────────────────────────────────

const statusChip = (s: ChargerStatus) => {
  const c = STATUS_CHIP_COLORS[s];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        color: c,
        padding: "2px 8px",
        borderRadius: 4,
        background: `color-mix(in srgb, ${c} 14%, transparent)`,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c }} />
      {STATUS_LABELS[s]}
    </span>
  );
};

const accessChip = (a: AccessType) => {
  const c = ACCESS_CHIP_COLORS[a] ?? "var(--indigo)";
  const l = ACCESS_LABELS[a] ?? a.replaceAll("_", " ");
  return (
    <span
      style={{
        fontSize: 11,
        color: c,
        padding: "2px 8px",
        borderRadius: 4,
        background: `color-mix(in srgb, ${c} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${c} 25%, transparent)`,
        whiteSpace: "nowrap",
      }}
    >
      {l}
    </span>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────

type ChargersPageProps = {
  // The hash query string is the single source of truth for search, filters,
  // sort and page — no shadow useState to drift out of sync with the URL.
  params?: URLSearchParams;
  onParamsChange?: (patch: Record<string, string | null>) => void;
  pendingChargerId?: string | null;
  onChargerOpened?: () => void;
};

const EMPTY_PARAMS = new URLSearchParams();

export const ChargersPage = ({
  params = EMPTY_PARAMS,
  onParamsChange,
  pendingChargerId,
  onChargerOpened,
}: ChargersPageProps = {}) => {
  const { data: chargers, loading, error, refetch } = useChargers();
  const [selected, setSelected] = useState<Charger | null>(null);
  const [addingLocal, setAddingLocal] = useState(false);

  // ── URL-backed state ────────────────────────────────────────────────────
  const setParams = onParamsChange ?? (() => {});
  // Any change to the result set sends you back to page 1 — staying on page 7
  // of a list that just shrank to 12 rows looks like a broken filter.
  const setFilter = (patch: Record<string, string | null>) =>
    setParams({ ...patch, page: null });

  const listParam = (key: string): string[] =>
    (params.get(key) ?? "").split(",").filter(Boolean);
  const oneOf = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
    const raw = params.get(key);
    return allowed.includes(raw as T) ? (raw as T) : fallback;
  };

  const statusSel = listParam("status");
  const accessSel = listParam("access");
  const connSel = listParam("conn");
  const sourceSel = listParam("src");
  const citySel = listParam("city");
  const verified = oneOf<TriFilter>("ver", ["all", "yes", "no"], "all");
  const power = oneOf<PowerFilter>("power", ["all", "ac", "dc50", "dc100", "dc150"], "all");
  const hoursFilter = oneOf<HoursFilter>("hours", ["all", "set", "missing"], "all");
  const updated = oneOf<UpdatedFilter>("upd", ["all", "7", "30", "90"], "all");
  const sort = parseSort<SortKey>(params.get("sort"), SORT_KEYS, DEFAULT_SORT);
  const urlQuery = params.get("q") ?? "";

  const filterCount =
    statusSel.length +
    accessSel.length +
    connSel.length +
    sourceSel.length +
    citySel.length +
    (verified === "all" ? 0 : 1) +
    (power === "all" ? 0 : 1) +
    (hoursFilter === "all" ? 0 : 1) +
    (updated === "all" ? 0 : 1);
  const narrowed = filterCount > 0 || urlQuery.length > 0;

  const clearAll = () =>
    setParams({
      q: null,
      status: null,
      access: null,
      conn: null,
      src: null,
      city: null,
      ver: null,
      power: null,
      hours: null,
      upd: null,
      page: null,
    });

  // Deep-link from the Overview header's "Add charger": `#/chargers?add=1`
  // opens the modal on arrival. Derived rather than copied into state so
  // there's no effect racing the URL, and a refresh keeps the modal open.
  const adding = addingLocal || (params.get("add") === "1" && ADMIN_API_CONFIGURED);
  const closeAdd = () => {
    setAddingLocal(false);
    if (params.get("add")) setParams({ add: null });
  };

  // ── Search box: responsive while typing, debounced into the URL ─────────
  // `typed.from` records the URL value the keystrokes were made against, so
  // when the debounce lands (or something else rewrites `q`) the input falls
  // back to the URL without an effect copying state around.
  const [typed, setTyped] = useState<{ value: string; from: string } | null>(null);
  const queryInput = typed && typed.from === urlQuery ? typed.value : urlQuery;
  const setQueryInput = (value: string) => setTyped({ value, from: urlQuery });
  useEffect(() => {
    if (queryInput === urlQuery) return;
    const timer = setTimeout(() => setFilter({ q: queryInput.trim() || null }), 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryInput, urlQuery]);

  // Deep-link from the global search: when the parent passes a pending id,
  // find that charger in the local list and open its drawer. Clear the
  // pending id so navigating back doesn't re-trigger.
  useEffect(() => {
    if (!pendingChargerId || chargers.length === 0) return;
    const found = chargers.find((c) => c.id === pendingChargerId);
    if (found) {
      setSelected(found);
      onChargerOpened?.();
    }
  }, [pendingChargerId, chargers, onChargerOpened]);

  // ── Derived data ────────────────────────────────────────────────────────

  // NB: plain object, not `new Map` — `Map` in this module is the Google Maps
  // component imported from @vis.gl/react-google-maps.
  const cityOptions = useMemo<MultiOption[]>(() => {
    const counts: Record<string, number> = {};
    for (const c of chargers) {
      if (!c.city || c.city === "—") continue;
      counts[c.city] = (counts[c.city] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1] || collator.compare(a[0], b[0]))
      .map(([v, count]) => ({ v, l: v, count }));
  }, [chargers]);

  // Snapshot once per mount: recomputing Date.now() on every render would let
  // the "last 7 days" boundary creep while you page through the table.
  const [mountedAt] = useState(() => Date.now());

  const filtered = useMemo(() => {
    const needle = urlQuery.trim().toLowerCase();
    const cutoff = updated === "all" ? 0 : mountedAt - Number(updated) * 86_400_000;
    const powerOk = power === "all" ? null : POWER_PREDICATES[power];

    return chargers.filter((c) => {
      if (statusSel.length && !statusSel.includes(c.status)) return false;
      if (accessSel.length && !accessSel.includes(c.access)) return false;
      if (sourceSel.length && !sourceSel.includes(c.source)) return false;
      if (citySel.length && !citySel.includes(c.city)) return false;
      if (connSel.length && !connSel.some((k) => c.connectors.includes(k as ConnectorKey)))
        return false;
      if (verified === "yes" && !c.verified) return false;
      if (verified === "no" && c.verified) return false;
      if (powerOk && !powerOk(c.power)) return false;
      if (hoursFilter === "set" && c.hours === "—") return false;
      if (hoursFilter === "missing" && c.hours !== "—") return false;
      if (cutoff && ts(c.updatedAt) < cutoff) return false;
      if (needle) {
        const hay = `${c.name} ${c.city} ${c.id}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [
    chargers,
    statusSel,
    accessSel,
    connSel,
    sourceSel,
    citySel,
    verified,
    power,
    hoursFilter,
    updated,
    urlQuery,
    mountedAt,
  ]);

  const sorted = useMemo(() => {
    const cmp = COMPARATORS[sort.key];
    const sign = sort.dir === "asc" ? 1 : -1;
    // Stable tie-break on name so equal statuses don't reshuffle between
    // renders — a list that reorders under the cursor is unusable.
    return [...filtered].sort(
      (a, b) => sign * cmp(a, b) || collator.compare(a.name, b.name),
    );
  }, [filtered, sort]);

  // ── Pagination (URL-backed, client-side slice) ──────────────────────────
  const perPageRaw = Number(params.get("per"));
  const perPage = (PAGE_SIZE_OPTIONS as readonly number[]).includes(perPageRaw)
    ? perPageRaw
    : DEFAULT_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const page = Math.min(Math.max(1, Number(params.get("page")) || 1), totalPages);
  const pageChargers = useMemo(
    () => sorted.slice((page - 1) * perPage, page * perPage),
    [sorted, page, perPage],
  );

  const verifiedCount = chargers.filter((c) => c.verified).length;

  const exportCsv = () =>
    downloadCsv(stampedFilename("chargers"), [
      [
        "Name",
        "City",
        "Connectors",
        "Max power (kW)",
        "Status",
        "Access",
        "Hours",
        "Source",
        "Verified",
        "Updated",
        "Latitude",
        "Longitude",
        "ID",
      ],
      ...sorted.map((c) => [
        c.name,
        c.city,
        c.connectors.map((k) => CONNECTOR_LABELS[k]).join(" / "),
        c.power,
        STATUS_LABELS[c.status],
        ACCESS_LABELS[c.access] ?? c.access,
        c.hours,
        c.source,
        c.verified ? "yes" : "no",
        c.updatedAt,
        c.lat,
        c.lng,
        c.id,
      ]),
    ]);

  const onSort = (key: SortKey) =>
    setParams({ sort: serializeSort(nextSort(sort, key, DESC_FIRST)), page: null });

  const openCharger = (c: Charger) => setSelected(c);

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>
            Chargers
          </h1>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
            {loading ? (
              <span style={{ color: "var(--text-dim)" }}>Loading…</span>
            ) : (
              <>
                <span className="num">{sorted.length}</span> of{" "}
                <span className="num">{chargers.length}</span> shown ·{" "}
                <span className="num">{verifiedCount}</span> verified
              </>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            onClick={exportCsv}
            disabled={loading || sorted.length === 0}
            title="Download the rows currently shown, in this order"
            style={{
              background: "var(--bg-elev)",
              color: "var(--text-muted)",
              padding: "8px 12px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 500,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "inherit",
              cursor: loading || sorted.length === 0 ? "not-allowed" : "pointer",
              opacity: loading || sorted.length === 0 ? 0.6 : 1,
            }}
          >
            <Icons.Download size={12} /> Export
          </button>
          <button
              onClick={() => setAddingLocal(true)}
            disabled={!ADMIN_API_CONFIGURED}
            title={ADMIN_API_CONFIGURED ? undefined : "Admin API not configured"}
            style={{
              background: "var(--accent)",
              color: "#0a0a0b",
              padding: "8px 12px",
              border: "none",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 500,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "inherit",
              cursor: ADMIN_API_CONFIGURED ? "pointer" : "not-allowed",
              opacity: ADMIN_API_CONFIGURED ? 1 : 0.6,
            }}
          >
            <Icons.Plus size={12} stroke={2.4} /> Add charger
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 340 }}>
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              insetInlineStart: 10,
              top: "50%",
              transform: "translateY(-50%)",
              display: "inline-flex",
              color: "var(--text-dim)",
              pointerEvents: "none",
            }}
          >
            <Icons.Search size={13} />
          </span>
          <input
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setQueryInput("");
            }}
            placeholder="Search name, city or id…"
            aria-label="Search chargers"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "7px 28px 7px 30px",
              background: "var(--bg-elev)",
              border: `1px solid ${queryInput ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 6,
              color: "var(--text)",
              fontFamily: "inherit",
              fontSize: 12,
              outline: "none",
            }}
          />
          {queryInput && (
            <button
              type="button"
              onClick={() => setQueryInput("")}
              aria-label="Clear search"
              style={{
                position: "absolute",
                insetInlineEnd: 6,
                top: "50%",
                transform: "translateY(-50%)",
                display: "inline-flex",
                background: "transparent",
                border: "none",
                color: "var(--text-dim)",
                cursor: "pointer",
                padding: 2,
              }}
            >
              <Icons.X size={12} />
            </button>
          )}
        </div>

        <MultiSelectChip
          label="Status"
          values={statusSel}
          options={STATUS_OPTIONS}
          onChange={(v) => setFilter({ status: v.join(",") || null })}
        />
        <MultiSelectChip
          label="Access"
          values={accessSel}
          options={ACCESS_OPTIONS}
          onChange={(v) => setFilter({ access: v.join(",") || null })}
        />
        <MultiSelectChip
          label="Connector"
          values={connSel}
          options={CONNECTOR_OPTIONS}
          onChange={(v) => setFilter({ conn: v.join(",") || null })}
        />
        <MultiSelectChip
          label="Source"
          values={sourceSel}
          options={SOURCE_OPTIONS}
          onChange={(v) => setFilter({ src: v.join(",") || null })}
        />
        <MultiSelectChip
          label="City"
          values={citySel}
          options={cityOptions}
          searchable
          onChange={(v) => setFilter({ city: v.join(",") || null })}
        />
        <SelectChip<PowerFilter>
          label="Power"
          value={power}
          active={power !== "all"}
          options={POWER_OPTIONS}
          onChange={(v) => setFilter({ power: v === "all" ? null : v })}
        />
        <SelectChip<TriFilter>
          label="Verified"
          value={verified}
          active={verified !== "all"}
          options={[
            { v: "all", l: "Any" },
            { v: "yes", l: "Yes" },
            { v: "no", l: "No" },
          ]}
          onChange={(v) => setFilter({ ver: v === "all" ? null : v })}
        />
        <SelectChip<HoursFilter>
          label="Hours"
          value={hoursFilter}
          active={hoursFilter !== "all"}
          options={[
            { v: "all", l: "Any" },
            { v: "set", l: "Set" },
            { v: "missing", l: "Missing" },
          ]}
          onChange={(v) => setFilter({ hours: v === "all" ? null : v })}
        />
        <SelectChip<UpdatedFilter>
          label="Updated"
          value={updated}
          active={updated !== "all"}
          options={[
            { v: "all", l: "Any time" },
            { v: "7", l: "Last 7 days" },
            { v: "30", l: "Last 30 days" },
            { v: "90", l: "Last 90 days" },
          ]}
          onChange={(v) => setFilter({ upd: v === "all" ? null : v })}
        />

        {narrowed && (
          <button
            type="button"
            onClick={clearAll}
            style={{
              fontSize: 11,
              color: "var(--text-dim)",
              background: "transparent",
              border: "none",
              padding: "6px 8px",
              textDecoration: "underline",
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            Clear {filterCount > 0 ? `${filterCount} filter${filterCount === 1 ? "" : "s"}` : "search"}
          </button>
        )}
      </div>

      {error && (
        <div
          style={{
            padding: 12,
            border: "1px solid color-mix(in srgb, var(--red) 35%, transparent)",
            background: "color-mix(in srgb, var(--red) 10%, transparent)",
            borderRadius: 8,
            color: "var(--red)",
            fontSize: 12,
          }}
        >
          Failed to load chargers: {error}
        </div>
      )}

      <Card padding={0}>
        <div style={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <SortableTh label="Name" sortKey="name" sort={sort} onSort={onSort} />
                <SortableTh label="City" sortKey="city" sort={sort} onSort={onSort} />
                <Th>Connectors</Th>
                <SortableTh label="Power" sortKey="power" sort={sort} onSort={onSort} />
                <SortableTh label="Status" sortKey="status" sort={sort} onSort={onSort} />
                <SortableTh label="Access" sortKey="access" sort={sort} onSort={onSort} />
                <SortableTh label="Hours" sortKey="hours" sort={sort} onSort={onSort} />
                <SortableTh label="Source" sortKey="source" sort={sort} onSort={onSort} />
                <SortableTh label="Updated" sortKey="updated" sort={sort} onSort={onSort} />
                <Th />
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                    {Array.from({ length: 10 }).map((__, j) => (
                      <td key={j} style={{ padding: "12px 16px" }}>
                        <div
                          className="skeleton"
                          style={{ height: 12, width: j === 0 ? "60%" : "70%" }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              {!loading &&
                pageChargers.map((c) => (
                  <tr
                    key={c.id}
                    // Rows are the primary affordance on this page, so they
                    // have to be reachable without a mouse.
                    tabIndex={0}
                    role="button"
                    aria-label={`Open ${c.name}`}
                    onClick={() => openCharger(c)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openCharger(c);
                      }
                    }}
                    style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "var(--surface-hover)")
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    onFocus={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                    onBlur={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {c.verified && (
                          <Icons.Verify size={13} style={{ color: "var(--accent)" }} />
                        )}
                        <span style={{ color: "var(--text)", fontWeight: 500 }}>{c.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{c.city}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {c.connectors.map((k) => (
                          <span
                            key={k}
                            style={{
                              fontSize: 10,
                              padding: "2px 6px",
                              borderRadius: 3,
                              color: CONNECTOR_COLORS[k],
                              background: `color-mix(in srgb, ${CONNECTOR_COLORS[k]} 14%, transparent)`,
                            }}
                          >
                            {CONNECTOR_LABELS[k]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }} className="num">
                      <span style={{ color: "var(--text)", fontWeight: 500 }}>{c.power}</span>
                      <span style={{ color: "var(--text-dim)" }}> kW</span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>{statusChip(c.status)}</td>
                    <td style={{ padding: "12px 16px" }}>{accessChip(c.access)}</td>
                    <td
                      style={{ padding: "12px 16px", color: "var(--text-muted)" }}
                      className="num"
                    >
                      {c.hours}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        color: "var(--text-dim)",
                        textTransform: "uppercase",
                        fontSize: 10,
                        letterSpacing: "0.04em",
                      }}
                    >
                      {sourceLabel(c.source)}
                    </td>
                    <td
                      style={{ padding: "12px 16px", color: "var(--text-muted)", whiteSpace: "nowrap" }}
                      className="num"
                      title={new Date(c.updatedAt).toLocaleString()}
                    >
                      {fmtAgo(c.updatedAt)}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "end" }}>
                      <Icons.ChevronRight size={14} style={{ color: "var(--text-dim)" }} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!loading && !error && sorted.length === 0 && (
            <EmptyState
              title={chargers.length === 0 ? "No chargers in the database yet" : "No chargers match"}
              subtitle={
                chargers.length === 0
                  ? "Run the OCM sync or add a charger to see rows here."
                  : "Nothing matches this search and filter combination."
              }
            >
              {chargers.length > 0 && narrowed && (
                <button
                  type="button"
                  onClick={clearAll}
                  style={{
                    padding: "7px 12px",
                    background: "var(--bg-elev-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    color: "var(--text)",
                    fontFamily: "inherit",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Clear search and filters
                </button>
              )}
            </EmptyState>
          )}
        </div>
        {!loading && !error && sorted.length > 0 && (
          <Pagination
            page={page}
            perPage={perPage}
            total={sorted.length}
            onPageChange={(p) => setParams({ page: p === 1 ? null : String(p) })}
            onPerPageChange={(n) =>
              setParams({ per: n === DEFAULT_PAGE_SIZE ? null : String(n), page: null })
            }
          />
        )}
      </Card>

      {selected && (
        <DetailDrawer
          charger={selected}
          onClose={() => setSelected(null)}
          onLocalUpdate={(patch) =>
            setSelected((prev) => (prev ? { ...prev, ...patch } : prev))
          }
          refetch={refetch}
        />
      )}

      {adding && (
        <AddChargerModal
          onClose={closeAdd}
          onCreated={() => {
            void refetch();
          }}
        />
      )}
    </div>
  );
};

const sourceLabel = (s: ChargerSource) => s.toUpperCase();

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

// Database shape: `{ weekly: { mon: [{from, to}], ..., sun: [] } }`.
// Empty array → closed that day. Missing day entirely → unknown ("—").
const dayCellLabel = (wh: WorkingHours, idx: number): string => {
  if (wh?.always_open) return "24h";
  if (!wh || !wh.weekly) return "—";
  const ranges = wh.weekly[DAY_KEYS[idx]];
  if (ranges === undefined) return "—";
  if (ranges.length === 0) return "Closed";
  return ranges.map(r => r.from === "00:00" && r.to === "24:00" ? "24h" : `${r.from.slice(0, 5)}–${r.to.slice(0, 5)}`).join(" / ");
};

const todayIndex = () => (new Date().getDay() + 6) % 7;

const fmtAgo = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "—";
  const min = Math.round(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(iso).toLocaleDateString();
};

type AdminVerifyResponse = {
  id: string;
  is_verified: boolean;
  verified_at: string | null;
  verified_by: string | null;
  name: string;
};

type AdminVerifyError = { error?: string };

const verifyCharger = async (chargerId: string): Promise<AdminVerifyResponse> => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-verify-charger`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ADMIN_API_SECRET}`,
    },
    body: JSON.stringify({ charger_id: chargerId }),
  });
  let body: AdminVerifyResponse | AdminVerifyError = {};
  try {
    body = (await res.json()) as AdminVerifyResponse | AdminVerifyError;
  } catch {
    // fall through; non-JSON response
  }
  if (!res.ok) {
    const msg = (body as AdminVerifyError)?.error ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body as AdminVerifyResponse;
};

type AdminStatusResponse = { id: string; status: ChargerStatus; name: string };
type AdminStatusError = { error?: string };
type SettableStatus = Extract<ChargerStatus, "operational" | "under_repair">;

const setChargerStatus = async (
  chargerId: string,
  status: SettableStatus,
): Promise<AdminStatusResponse> => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-set-charger-status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ADMIN_API_SECRET}`,
    },
    body: JSON.stringify({ charger_id: chargerId, status }),
  });
  let body: AdminStatusResponse | AdminStatusError = {};
  try {
    body = (await res.json()) as AdminStatusResponse | AdminStatusError;
  } catch {
    // non-JSON response
  }
  if (!res.ok) {
    const msg = (body as AdminStatusError)?.error ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body as AdminStatusResponse;
};

type DetailDrawerProps = {
  charger: Charger;
  onClose: () => void;
  onLocalUpdate: (patch: Partial<Charger>) => void;
  refetch: () => Promise<void>;
};

const MiniMap = ({ charger, theme }: { charger: Charger; theme: "dark" | "light" }) => {
  const styles = theme === "dark" ? darkMapStyle : lightMapStyle;
  const center = { lat: charger.lat, lng: charger.lng };
  return (
    <div
      style={{
        height: 170,
        background: "var(--bg-elev-2)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
        <Map
          defaultCenter={center}
          defaultZoom={14}
          styles={styles}
          disableDefaultUI
          gestureHandling="none"
          clickableIcons={false}
          backgroundColor={theme === "dark" ? "#18181B" : "#DBEAFE"}
          style={{ width: "100%", height: "100%" }}
        >
          <Marker
            position={center}
            icon={{
              path: "M 0,0 m -8,0 a 8,8 0 1,0 16,0 a 8,8 0 1,0 -16,0",
              fillColor: STATUS_COLORS[charger.status],
              fillOpacity: 1,
              strokeColor: "#0a0a0b",
              strokeWeight: 1.5,
              scale: 1,
              anchor: { x: 0, y: 0 } as google.maps.Point,
            }}
          />
        </Map>
      </APIProvider>
    </div>
  );
};

const MissingMapKeyHint = () => (
  <div
    style={{
      height: 170,
      background: "var(--bg-elev-2)",
      border: "1px dashed var(--border)",
      borderRadius: 8,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      textAlign: "center",
      fontSize: 11,
      color: "var(--text-muted)",
      lineHeight: 1.5,
    }}
  >
    Set <code style={{ marginInline: 4 }}>VITE_GOOGLE_MAPS_API_KEY</code> in
    {" "}<code style={{ marginInline: 4 }}>charj-admin/.env</code> to render the map.
  </div>
);

const DetailDrawer = ({ charger, onClose, onLocalUpdate, refetch }: DetailDrawerProps) => {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const today = todayIndex();
  const theme = useCurrentTheme();
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState<SettableStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Rows open on Enter, so the drawer has to close on Escape — otherwise a
  // keyboard user is stuck behind the overlay with no way back to the table.
  useEffect(() => {
    if (editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [editing, onClose]);

  const handleVerify = async () => {
    if (!ADMIN_API_CONFIGURED) return;
    setVerifyError(null);
    setVerifying(true);
    try {
      const updated = await verifyCharger(charger.id);
      onLocalUpdate({
        verified: updated.is_verified,
        verifiedBy: updated.verified_by,
      });
      await refetch();
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const handleSetStatus = async (next: SettableStatus) => {
    if (!ADMIN_API_CONFIGURED) return;
    if (charger.status === next) return;
    setStatusError(null);
    setStatusBusy(next);
    try {
      const updated = await setChargerStatus(charger.id, next);
      onLocalUpdate({ status: updated.status });
      await refetch();
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setStatusBusy(null);
    }
  };

  const openInGoogleMaps = () => {
    window.open(
      `https://www.google.com/maps?q=${charger.lat},${charger.lng}`,
      "_blank",
      "noopener",
    );
  };

  if (editing) return <EditChargerDrawer chargerId={charger.id} onClose={() => setEditing(false)} onSaved={updated => {
    const mapped = mapRawCharger(updated as RawChargerRow);
    if (mapped) onLocalUpdate(mapped);
    setEditing(false);
    setSaved(true);
    void refetch();
  }} />;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,.4)",
          zIndex: 50,
          animation: "fadeIn .15s",
        }}
      />
      <div
        style={{
          position: "fixed",
          insetBlock: 0,
          insetInlineEnd: 0,
          width: "min(480px, 92vw)",
          background: "var(--bg-elev)",
          borderInlineStart: "1px solid var(--border-strong)",
          zIndex: 51,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-12px 0 40px rgba(0,0,0,.3)",
          animation: "slideIn .25s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                color: "var(--text-dim)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {charger.id.slice(0, 8)}
            </div>
            <h2 style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 600 }}>{charger.name}</h2>
          </div>
          <button onClick={onClose} style={{ ...iconBtnStyle }}>
            <Icons.X size={14} />
          </button>
        </div>

        <div
          style={{
            overflow: "auto",
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {saved && <span role="status" style={{ width: "100%", color: "var(--accent)", fontSize: 12 }}>Charger changes saved.</span>}
            {statusChip(charger.status)}
            {accessChip(charger.access)}
            {charger.verified && (
              <span
                style={{
                  fontSize: 11,
                  color: "var(--accent)",
                  padding: "2px 8px",
                  borderRadius: 4,
                  background: "var(--accent-soft)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Icons.Verify size={11} />
                Verified
              </span>
            )}
          </div>

          {GOOGLE_MAPS_API_KEY ? (
            <MiniMap charger={charger} theme={theme} />
          ) : (
            <MissingMapKeyHint />
          )}

          <div>
            <div style={smallLbl}>Connectors · Power</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
              {charger.connectors.map((k) => (
                <span
                  key={k}
                  style={{
                    fontSize: 11,
                    padding: "4px 10px",
                    borderRadius: 4,
                    color: CONNECTOR_COLORS[k],
                    background: `color-mix(in srgb, ${CONNECTOR_COLORS[k]} 14%, transparent)`,
                    fontWeight: 500,
                  }}
                >
                  {CONNECTOR_LABELS[k]}
                </span>
              ))}
              <span style={{ flex: 1 }} />
              <span
                className="num"
                style={{ fontSize: 18, color: "var(--text)", fontWeight: 600 }}
              >
                {charger.power}
              </span>
              <span style={{ color: "var(--text-dim)", fontSize: 12 }}>kW</span>
            </div>
          </div>

          <div>
            <div style={smallLbl}>Working hours</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(85px, 1fr))",
                gap: 4,
                marginTop: 8,
              }}
            >
              {DAYS.map((d, i) => {
                const isToday = i === today;
                return (
                  <div
                    key={d}
                    style={{
                      background: isToday ? "var(--accent-soft)" : "var(--bg-elev-2)",
                      border: `1px solid ${isToday ? "var(--accent-border)" : "var(--border)"}`,
                      borderRadius: 4,
                      padding: "8px 4px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: isToday ? "var(--accent)" : "var(--text-dim)",
                        fontWeight: 500,
                      }}
                    >
                      {d}
                    </div>
                    <div
                      className="num"
                      style={{
                        fontSize: 10,
                        color: isToday ? "var(--accent)" : "var(--text-muted)",
                        marginTop: 2,
                      }}
                    >
                      {dayCellLabel(charger.workingHours, i)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {charger.amenities.length > 0 && (
            <div>
              <div style={smallLbl}>Amenities</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {charger.amenities.map((a) => (
                  <span
                    key={a}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 11,
                      padding: "4px 10px",
                      borderRadius: 14,
                      border: "1px solid var(--border)",
                      background: "var(--bg-elev-2)",
                      color: "var(--text-muted)",
                    }}
                  >
                    <AmenityIcon slug={a} size={12} />
                    {labelForAmenity(a)}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <KV k="City" v={charger.city} />
            <KV k="Source" v={charger.source.toUpperCase()} />
            <KV k="OCM ID" v={charger.ocmId ?? "—"} />
            <KV k="Updated" v={fmtAgo(charger.updatedAt)} />
            <KV k="Verified by" v={charger.verifiedBy ?? "—"} />
            <KV k="Coordinates" v={`${charger.lat.toFixed(4)}, ${charger.lng.toFixed(4)}`} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={smallLbl}>Status</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 6,
                padding: 3,
                background: "var(--bg-elev-2)",
                border: "1px solid var(--border)",
                borderRadius: 7,
              }}
            >
              <StatusToggleButton
                label="Operational"
                color="var(--green)"
                active={charger.status === "operational"}
                busy={statusBusy === "operational"}
                disabled={statusBusy !== null || !ADMIN_API_CONFIGURED}
                onClick={() => handleSetStatus("operational")}
              />
              <StatusToggleButton
                label="Under repair"
                color="var(--amber)"
                active={charger.status === "under_repair"}
                busy={statusBusy === "under_repair"}
                disabled={statusBusy !== null || !ADMIN_API_CONFIGURED}
                onClick={() => handleSetStatus("under_repair")}
              />
            </div>
            {statusError && (
              <div style={{ fontSize: 11, color: "var(--red)" }}>{statusError}</div>
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "stretch", marginTop: 6 }}>
              {charger.verified ? (
                <span
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                    border: "1px solid var(--accent-border)",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 500,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <Icons.Verify size={13} />
                  Verified by {charger.verifiedBy ?? "admin"}
                </span>
              ) : (
                <button
                  onClick={handleVerify}
                  disabled={verifying || !ADMIN_API_CONFIGURED}
                  title={
                    ADMIN_API_CONFIGURED
                      ? undefined
                      : "Admin API not configured"
                  }
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    background: "var(--accent)",
                    color: "#0a0a0b",
                    border: "none",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 500,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    opacity: verifying || !ADMIN_API_CONFIGURED ? 0.6 : 1,
                    cursor:
                      verifying || !ADMIN_API_CONFIGURED ? "not-allowed" : "pointer",
                  }}
                >
                  <Icons.Verify size={13} /> {verifying ? "Verifying…" : "Verify"}
                </button>
              )}
              <button
                onClick={() => setEditing(true)}
                disabled={verifying || statusBusy !== null}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  background: "var(--bg-elev-2)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                Edit charger
              </button>
              <button
                onClick={openInGoogleMaps}
                title="Open in Google Maps"
                style={{
                  padding: "10px 12px",
                  background: "var(--bg-elev-2)",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                <Icons.Map size={13} />
              </button>
            </div>
            {verifyError && (
              <div style={{ fontSize: 11, color: "var(--red)" }}>
                {verifyError}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

const smallLbl: CSSProperties = {
  fontSize: 10,
  color: "var(--text-dim)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const KV = ({ k, v }: { k: string; v: ReactNode }) => (
  <div>
    <div style={smallLbl}>{k}</div>
    <div className="num" style={{ fontSize: 13, color: "var(--text)", marginTop: 2, fontWeight: 500 }}>
      {v}
    </div>
  </div>
);

type StatusToggleButtonProps = {
  label: string;
  color: string;
  active: boolean;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
};

const StatusToggleButton = ({
  label,
  color,
  active,
  busy,
  disabled,
  onClick,
}: StatusToggleButtonProps) => (
  <button
    onClick={onClick}
    disabled={disabled || active}
    title={active ? `Already ${label.toLowerCase()}` : `Set status to ${label.toLowerCase()}`}
    style={{
      padding: "8px 10px",
      borderRadius: 5,
      fontSize: 12,
      fontWeight: 500,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      cursor: disabled || active ? "default" : "pointer",
      background: active ? `color-mix(in srgb, ${color} 18%, transparent)` : "transparent",
      color: active ? color : "var(--text-muted)",
      border: `1px solid ${active ? `color-mix(in srgb, ${color} 35%, transparent)` : "transparent"}`,
      opacity: !active && disabled ? 0.5 : 1,
      transition: "background .15s, color .15s, border-color .15s",
    }}
  >
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: color,
        opacity: active ? 1 : 0.7,
      }}
    />
    {busy ? "…" : label}
  </button>
);
