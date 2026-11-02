import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { CONNECTOR_LABELS, type Charger } from "../../data/chargers";
import {
  ACCESS_LABELS,
  ACCESS_TYPES,
  cityOptions,
  CONNECTOR_KEYS,
  governorateOptions,
  POWER_BUCKETS,
  POWER_LABELS,
  SORT_KEYS,
  sortOptionLabel,
  SOURCE_LABELS,
  SOURCES,
  STATUS_LABELS,
  STATUSES,
  type ChargerFilters,
  type HoursFilter,
  type PowerFilter,
  type SortKey,
  type TriFilter,
  type UpdatedFilter,
} from "../../data/charger-catalog";
import { MultiSelectChip, type MultiOption } from "../../components/multi-select-chip";
import { serializeSort, type Sort } from "../../lib/table-sort";
import { ChgIcon } from "./bits";

// The list's and the map's filter bar. Search is typed into local state and
// debounced into ?q=; every other control writes its URL param straight away.
// On a narrow page the chips fold behind a "Filters" button (with the number
// in use), so the rows start near the top of a phone.

type Props = {
  filters: ChargerFilters;
  /** Every charger: the Governorate and City menus count from it. */
  chargers: Charger[];
  /** Writes filter params and resets the page. */
  onFilter: (patch: Record<string, string | null>) => void;
  onClear: () => void;
  count: number;
  /** The phone's sort picker (the list only; wide tables sort by their headers). */
  sort?: { value: Sort<SortKey>; onChange: (s: Sort<SortKey>) => void };
  /** At the end of the top row: Export on the list. */
  end?: ReactNode;
};

const STATUS_OPTIONS: MultiOption[] = STATUSES.map((v) => ({ v, l: STATUS_LABELS[v] }));
const ACCESS_OPTIONS: MultiOption[] = ACCESS_TYPES.map((v) => ({ v, l: ACCESS_LABELS[v] }));
const CONNECTOR_OPTIONS: MultiOption[] = CONNECTOR_KEYS.map((v) => ({ v, l: CONNECTOR_LABELS[v] }));
const SOURCE_OPTIONS: MultiOption[] = SOURCES.map((v) => ({ v, l: SOURCE_LABELS[v] }));
const POWER_OPTIONS: { v: PowerFilter; l: string }[] = [{ v: "all", l: "Any" }, ...POWER_BUCKETS.map((v) => ({ v, l: POWER_LABELS[v] }))];
const VERIFIED_OPTIONS: { v: TriFilter; l: string }[] = [
  { v: "all", l: "Any" },
  { v: "yes", l: "Yes" },
  { v: "no", l: "No" },
];
const HOURS_OPTIONS: { v: HoursFilter; l: string }[] = [
  { v: "all", l: "Any" },
  { v: "set", l: "Set" },
  { v: "missing", l: "Missing" },
];
const UPDATED_OPTIONS: { v: UpdatedFilter; l: string }[] = [
  { v: "all", l: "Any time" },
  { v: "7", l: "Last 7 days" },
  { v: "30", l: "Last 30 days" },
  { v: "90", l: "Last 90 days" },
];
const SORT_OPTIONS = SORT_KEYS.flatMap((key) =>
  (["asc", "desc"] as const).map((dir) => ({ v: serializeSort({ key, dir }), l: sortOptionLabel(key, dir), key, dir })),
);

/** A labelled native select in the chip look. */
const FilterSelect = <T extends string>({
  label,
  value,
  options,
  onChange,
  active,
  className,
}: {
  label: string;
  value: T;
  options: { v: T; l: string }[];
  onChange: (v: T) => void;
  active: boolean;
  className?: string;
}) => (
  <label className={className ? `chg-sel ${className}` : "chg-sel"} data-active={active}>
    <span aria-hidden="true">{label}</span>
    <select value={value} aria-label={label} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.v} value={o.v}>
          {o.l}
        </option>
      ))}
    </select>
  </label>
);

export const ChargerFilterBar = ({ filters: f, chargers, onFilter, onClear, count, sort, end }: Props) => {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const narrowed = count > 0 || f.q.length > 0;

  // ── Search box: responsive while typing, debounced into the URL ─────────
  // `typed.from` records the URL value the keystrokes were made against, so
  // when the debounce lands (or something else rewrites `q`) the input falls
  // back to the URL without an effect copying state around.
  const [typed, setTyped] = useState<{ value: string; from: string } | null>(null);
  const queryInput = typed && typed.from === f.q ? typed.value : f.q;
  const setQueryInput = (value: string) => setTyped({ value, from: f.q });
  useEffect(() => {
    if (queryInput === f.q) return;
    const timer = setTimeout(() => onFilter({ q: queryInput.trim() || null }), 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryInput, f.q]);

  const govOptions = useMemo(() => governorateOptions(chargers), [chargers]);
  const cityOpts = useMemo(() => cityOptions(chargers, f.gov, f.cities), [chargers, f.gov, f.cities]);

  const sortValue = sort ? serializeSort(sort.value) : "";

  return (
    <div className="chg-filters">
      <div className="chg-bar">
        <div className="chg-search">
          <ChgIcon name="search" />
          <input
            type="search"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setQueryInput("");
            }}
            placeholder="Name, city, address or id"
            aria-label="Search chargers"
          />
          {queryInput && (
            <button type="button" className="chg-search-clear" onClick={() => setQueryInput("")} aria-label="Clear search">
              <ChgIcon name="x" />
            </button>
          )}
        </div>
        <button
          type="button"
          className="chg-btn chg-filters-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          <ChgIcon name="filter" />
          Filters
          {count > 0 && (
            <span className="chg-count" aria-label={`${count} in use`}>
              {count}
            </span>
          )}
        </button>
        {narrowed && (
          <button type="button" className="chg-link" onClick={onClear}>
            Clear {count > 0 ? `${count} filter${count === 1 ? "" : "s"}` : "search"}
          </button>
        )}
        {end}
      </div>

      <div id={panelId} className="chg-chips" data-open={open}>
        <MultiSelectChip label="Status" values={f.status} options={STATUS_OPTIONS} onChange={(v) => onFilter({ status: v.join(",") || null })} />
        <MultiSelectChip label="Access" values={f.access} options={ACCESS_OPTIONS} onChange={(v) => onFilter({ access: v.join(",") || null })} />
        <MultiSelectChip label="Connector" values={f.conn} options={CONNECTOR_OPTIONS} onChange={(v) => onFilter({ conn: v.join(",") || null })} />
        <MultiSelectChip label="Source" values={f.src} options={SOURCE_OPTIONS} onChange={(v) => onFilter({ src: v.join(",") || null })} />
        <MultiSelectChip label="Governorate" values={f.gov} options={govOptions} searchable onChange={(v) => onFilter({ gov: v.join(",") || null })} />
        <MultiSelectChip label="City" values={f.cities} options={cityOpts} searchable onChange={(v) => onFilter({ cities: v.join(",") || null })} />
        {f.legacyCity.length > 0 && (
          <button
            type="button"
            className="chg-legacy"
            onClick={() => onFilter({ city: null })}
            title="From an older link. Matches the legacy city text and city names."
            aria-label={`Remove city text filter ${f.legacyCity.join(", ")}`}
          >
            <span className="ms-label">City text</span>
            <bdi className="chg-legacy-v">{f.legacyCity.join(", ")}</bdi>
            <ChgIcon name="x" />
          </button>
        )}
        <FilterSelect<PowerFilter> label="Power" value={f.power} active={f.power !== "all"} options={POWER_OPTIONS} onChange={(v) => onFilter({ power: v === "all" ? null : v })} />
        <FilterSelect<TriFilter> label="Verified" value={f.verified} active={f.verified !== "all"} options={VERIFIED_OPTIONS} onChange={(v) => onFilter({ ver: v === "all" ? null : v })} />
        <FilterSelect<HoursFilter> label="Hours" value={f.hours} active={f.hours !== "all"} options={HOURS_OPTIONS} onChange={(v) => onFilter({ hours: v === "all" ? null : v })} />
        <FilterSelect<UpdatedFilter> label="Updated" value={f.updated} active={f.updated !== "all"} options={UPDATED_OPTIONS} onChange={(v) => onFilter({ upd: v === "all" ? null : v })} />
        {sort && (
          <FilterSelect<string>
            className="chg-sort"
            label="Sort"
            value={sortValue}
            active={false}
            options={SORT_OPTIONS}
            onChange={(v) => {
              const hit = SORT_OPTIONS.find((o) => o.v === v);
              if (hit) sort.onChange({ key: hit.key, dir: hit.dir });
            }}
          />
        )}
      </div>
    </div>
  );
};
