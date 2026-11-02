import { useCallback, useEffect, useMemo, useState } from "react";
import { AddChargerModal } from "../components/add-charger-modal";
import {
  applyFilters,
  CLEAR_ALL,
  DEFAULT_PER_PAGE,
  DESC_FIRST,
  filterCount,
  PAGE_SIZES,
  parseView,
  readFilters,
  readPage,
  readPerPage,
  readSort,
  sortChargers,
  STATUS_LABELS,
  accessLabel,
  type ChargersView,
  type SortKey,
} from "../data/charger-catalog";
import { CONNECTOR_LABELS, useChargers, type Charger } from "../data/chargers";
import { useLocations } from "../data/locations";
import { downloadCsv, stampedFilename } from "../lib/csv";
import { SUPABASE_CONFIGURED } from "../lib/supabase";
import { nextSort, serializeSort, type Sort } from "../lib/table-sort";
import { buildHash, type RouteParams } from "../lib/use-route";
import { Empty } from "../ui/empty";
import { HealthCard } from "../ui/health-card";
import { LargeTitle } from "../ui/large-title";
import { prefersReducedMotion } from "../ui/motion";
import { Pager } from "../ui/pager";
import { ChgIcon, LOADING, Note, RetryLine, Waiting, type ChgIconName } from "./chargers/bits";
import { DetailDrawer } from "./chargers/drawer";
import { ChargerFilterBar } from "./chargers/filters";
import { nf } from "./chargers/format";
import { ChargerTable } from "./chargers/list";
import { ChargersMap } from "./chargers/map-view";
import { NetworkView } from "./chargers/network";
import "./chargers.css";

// Chargers: Tunisia's charging stations, managed. Three views in the URL
// (?view=): the list (search, filters, sort and page all in the hash), the
// map (the same filters, one full-width map) and About the network (the
// catalogue's status, connector, access, power and coverage numbers). Every
// view opens the same detail drawer (?id=, ?id=&edit=1) and Add charger sits
// in the title on every view, phones included (?add=1 opens it on arrival).

type ChargersPageProps = {
  // The hash query string is the single source of truth for search, filters,
  // sort, page and view — no shadow useState to drift out of sync with the URL.
  params?: URLSearchParams;
  onParamsChange?: (patch: RouteParams) => void;
  pendingChargerId?: string | null;
  // With the pending id: open its editor straight away (Community, after approving a submission).
  pendingChargerEdit?: boolean;
  onChargerOpened?: () => void;
};

const EMPTY_PARAMS = new URLSearchParams();
/** search_chargers reads at most this many rows (data/chargers.ts). */
const READ_CAP = 1000;

const VIEWS: { v: ChargersView; l: string; icon: ChgIconName }[] = [
  { v: "list", l: "List", icon: "list" },
  { v: "map", l: "Map", icon: "map" },
  { v: "stats", l: "Network", icon: "bars" },
];
// One-shot params that a view switch must not carry along.
const ONE_SHOT = new Set(["id", "edit", "add"]);

export const ChargersPage = ({
  params = EMPTY_PARAMS,
  onParamsChange,
  pendingChargerId = null,
  pendingChargerEdit = false,
  onChargerOpened,
}: ChargersPageProps = {}) => {
  const { data: chargers, loading, error, refetch } = useChargers();
  const { governorates } = useLocations();
  const [selected, setSelected] = useState<Charger | null>(null);
  const [editOnOpen, setEditOnOpen] = useState(false);
  const [addingLocal, setAddingLocal] = useState(false);
  // Snapshot once per mount: recomputing Date.now() on every render would let
  // the "last 7 days" boundary creep while you page through the table.
  const [openedAt] = useState(() => Date.now());

  const view = parseView(params.get("view"));
  const setParams = useMemo(() => onParamsChange ?? (() => {}), [onParamsChange]);
  // Any change to the result set sends you back to page 1 — staying on page 7
  // of a list that just shrank to 12 rows looks like a broken filter.
  const setFilter = useCallback((patch: RouteParams) => setParams({ ...patch, page: null }), [setParams]);
  const clearAll = useCallback(() => setParams(CLEAR_ALL), [setParams]);

  const f = useMemo(() => readFilters(params), [params]);
  const count = filterCount(f);
  const narrowed = count > 0 || f.q.length > 0;
  const sort = useMemo(() => readSort(params), [params]);

  // `#/chargers?add=1` opens the modal on arrival. Derived rather than copied
  // into state so there's no effect racing the URL, and a refresh keeps it open.
  const adding = addingLocal || (params.get("add") === "1" && SUPABASE_CONFIGURED);
  const closeAdd = () => {
    setAddingLocal(false);
    if (params.get("add")) setParams({ add: null });
  };

  // Deep link (global search, Notifications, Community's approve): open the
  // pending charger's drawer once the list has it, then drop the id from the
  // URL so closing the drawer and going back doesn't silently reopen it.
  // Adjusted while rendering (not in an effect) so the drawer opens with the
  // rows; the URL is told afterwards.
  const pendingFound = pendingChargerId && !loading ? (chargers.find((c) => c.id === pendingChargerId) ?? null) : null;
  const [consumed, setConsumed] = useState<string | null>(null);
  if (!pendingChargerId && consumed !== null) setConsumed(null);
  if (pendingFound && consumed !== pendingFound.id) {
    setConsumed(pendingFound.id);
    setSelected(pendingFound);
    setEditOnOpen(pendingChargerEdit);
  }
  useEffect(() => {
    if (pendingFound) onChargerOpened?.();
  }, [pendingFound, onChargerOpened]);
  const missing = pendingChargerId !== null && !loading && !error && !pendingFound;

  const filtered = useMemo(() => applyFilters(chargers, f, openedAt), [chargers, f, openedAt]);
  const sorted = useMemo(() => sortChargers(filtered, sort), [filtered, sort]);
  const perPage = readPerPage(params);
  const page = readPage(params, sorted.length, perPage);
  const pageRows = useMemo(() => sorted.slice((page - 1) * perPage, page * perPage), [sorted, page, perPage]);
  const verified = useMemo(() => chargers.filter((c) => c.verified).length, [chargers]);

  const openCharger = useCallback((c: Charger) => {
    setEditOnOpen(false);
    setSelected(c);
  }, []);
  const closeCharger = useCallback(() => {
    setSelected(null);
    setEditOnOpen(false);
  }, []);
  const onSort = (key: SortKey) => setParams({ sort: serializeSort(nextSort(sort, key, DESC_FIRST)), page: null });
  const onSortPick = (s: Sort<SortKey>) => setParams({ sort: serializeSort(s), page: null });
  const toPage = (p: number) => {
    setParams({ page: p === 1 ? null : String(p) });
    // The next page starts at the top of the list, not where Next was tapped.
    document.getElementById("chg-list")?.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  };

  const exportCsv = () =>
    downloadCsv(stampedFilename("chargers"), [
      ["Name", "City", "Governorate", "Address", "Address (AR)", "Connectors", "Max power (kW)", "Status", "Access", "Hours", "Source", "Verified", "Updated", "Latitude", "Longitude", "ID", "City ID"],
      ...sorted.map((c) => [
        c.name,
        // Unlinked chargers keep their legacy text so the column is never blank.
        c.cityName ?? (c.city === "—" ? "" : c.city),
        c.governorateName ?? "",
        c.address,
        c.addressAr,
        c.connectors.map((k) => CONNECTOR_LABELS[k]).join(" / "),
        c.power,
        STATUS_LABELS[c.status],
        accessLabel(c.access),
        c.hours,
        c.source,
        c.verified ? "yes" : "no",
        c.updatedAt,
        c.lat,
        c.lng,
        c.id,
        c.cityId ?? "",
      ]),
    ]);

  // A view switch keeps the search and filters; one-shot params stay behind.
  const viewHref = (v: ChargersView) => {
    const keep: RouteParams = {};
    params.forEach((value, key) => {
      if (!ONE_SHOT.has(key)) keep[key] = value;
    });
    return buildHash("chargers", { ...keep, view: v === "list" ? null : v });
  };

  const subtitle = loading
    ? LOADING
    : error
      ? "Couldn't load the chargers."
      : `${nf.format(chargers.length)} ${chargers.length === 1 ? "charger" : "chargers"} · ${nf.format(verified)} verified`;
  const capped = !loading && chargers.length >= READ_CAP && (
    <Note>The list reads the first {nf.format(READ_CAP)} chargers, so the counts here may run short.</Note>
  );
  const shownMeta = loading || error ? undefined : narrowed ? `${nf.format(sorted.length)} of ${nf.format(chargers.length)}` : nf.format(chargers.length);

  const filterBar = (withSort: boolean) => (
    <ChargerFilterBar
      filters={f}
      chargers={chargers}
      onFilter={setFilter}
      onClear={clearAll}
      count={count}
      sort={withSort ? { value: sort, onChange: onSortPick } : undefined}
      end={
        withSort && (
          <button
            type="button"
            className="chg-link chg-export"
            onClick={exportCsv}
            disabled={loading || sorted.length === 0}
            title="Download the rows currently shown, in this order"
          >
            <ChgIcon name="download" /> Export
          </button>
        )
      }
    />
  );

  let listBody;
  if (loading) listBody = <Waiting tall>{LOADING}</Waiting>;
  else if (error) listBody = <RetryLine onRetry={() => void refetch()}>Couldn't load chargers: {error}</RetryLine>;
  else if (sorted.length === 0)
    listBody = (
      <div className="chg-empty">
        <Empty size="body">
          {chargers.length === 0
            ? "No chargers in the database yet. Run the OCM sync or add a charger to see rows here."
            : "No chargers match this search and these filters."}
        </Empty>
        {chargers.length > 0 && narrowed && (
          <button type="button" className="chg-btn" onClick={clearAll}>
            Clear search and filters
          </button>
        )}
      </div>
    );
  else
    listBody = (
      <>
        <ChargerTable rows={pageRows} sort={sort} onSort={onSort} onOpen={openCharger} now={openedAt} />
        <Pager
          label="Chargers"
          page={page}
          perPage={perPage}
          total={sorted.length}
          sizes={PAGE_SIZES}
          onPage={toPage}
          onPerPage={(n) => setParams({ per: n === DEFAULT_PER_PAGE ? null : String(n), page: null })}
        />
        {capped}
      </>
    );

  return (
    <div className="chg" data-view={view}>
      <LargeTitle
        title="Chargers"
        subtitle={subtitle}
        trailing={
          <button
            type="button"
            className="chg-btn chg-btn-primary chg-add"
            onClick={() => setAddingLocal(true)}
            disabled={!SUPABASE_CONFIGURED}
            title={SUPABASE_CONFIGURED ? "Add charger" : "Admin API not configured"}
          >
            <ChgIcon name="plus" />
            <span className="chg-add-l">Add charger</span>
          </button>
        }
      />

      <nav className="chg-tabs" aria-label="Chargers views">
        {VIEWS.map((t) => (
          <a key={t.v} href={viewHref(t.v)} aria-current={view === t.v ? "page" : undefined}>
            <ChgIcon name={t.icon} />
            {t.l}
          </a>
        ))}
      </nav>

      {missing && (
        <p className="chg-notice" role="status">
          No charger with the id {pendingChargerId.slice(0, 8)}… is in the list. It may have been removed.{" "}
          <button type="button" className="chg-link" onClick={() => setParams({ id: null, edit: null })}>
            Dismiss
          </button>
        </p>
      )}

      {view === "list" && (
        <HealthCard title={narrowed ? "Matching chargers" : "All chargers"} color="screens" icon={<ChgIcon name="charger" />} meta={shownMeta} id="chg-list" index={0}>
          {filterBar(true)}
          {listBody}
        </HealthCard>
      )}

      {view === "map" && (
        <HealthCard title="On the map" color="screens" icon={<ChgIcon name="map" />} meta={shownMeta} id="chg-map" index={0}>
          {filterBar(false)}
          {error && <RetryLine onRetry={() => void refetch()}>Couldn't load chargers: {error}</RetryLine>}
          <ChargersMap chargers={filtered} total={chargers.length} loading={loading} onOpen={openCharger} />
          {capped}
        </HealthCard>
      )}

      {view === "stats" && (
        <NetworkView
          chargers={chargers}
          governorates={governorates}
          loading={loading}
          error={error}
          onRetry={() => void refetch()}
          filtered={narrowed}
          cap={!loading && chargers.length >= READ_CAP ? READ_CAP : null}
        />
      )}

      {selected && (
        <DetailDrawer
          // Per-charger state (announce notice, notifications query) must not
          // carry over when a deep link swaps the open charger.
          key={selected.id}
          charger={selected}
          startEditing={editOnOpen}
          showMap={view !== "map"}
          now={openedAt}
          onClose={closeCharger}
          onLocalUpdate={(patch) => setSelected((prev) => (prev ? { ...prev, ...patch } : prev))}
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
