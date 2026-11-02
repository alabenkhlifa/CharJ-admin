import { Icons, type IconKey } from "../lib/icons";
import { NAV } from "../lib/routes";
import type {
  ChargerHit,
  GlobalSearchState,
  RouteHit,
  SearchHit,
} from "../lib/use-global-search";

// The sidebar search's results (⌘K): pages, then chargers. It floats over
// the page in Card with the tooltip shadow; styles in src/ui/shell.css.

type SearchPanelProps = {
  state: GlobalSearchState;
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  onPick: (hit: SearchHit) => void;
};

const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <div className="ui-search-group">{title}</div>
    {children}
  </div>
);

type RowProps<H> = { hit: H; active: boolean; onHover: () => void; onClick: () => void };

const RouteRow = ({ hit, active, onHover, onClick }: RowProps<RouteHit>) => {
  const meta = NAV.find((n) => n.k === hit.k);
  const ic = meta?.ic as IconKey | undefined;
  const Ic = ic ? Icons[ic] : null;
  return (
    <button type="button" className="ui-search-row" data-active={active || undefined} onMouseEnter={onHover} onClick={onClick}>
      {Ic && <Ic size={16} className="ui-search-ic" />}
      <span className="ui-search-main">
        <span className="ui-search-name">{hit.l}</span>
      </span>
      <span className="ui-search-kind">Page</span>
    </button>
  );
};

const ChargerRow = ({ hit, active, onHover, onClick }: RowProps<ChargerHit>) => (
  <button type="button" className="ui-search-row" data-active={active || undefined} onMouseEnter={onHover} onClick={onClick}>
    <Icons.Charger size={16} className="ui-search-ic" />
    <span className="ui-search-main">
      <span className="ui-search-name">
        <bdi>{hit.name}</bdi>
      </span>
      <span className="ui-search-place">
        <bdi>{hit.charger.place}</bdi>
      </span>
    </span>
    <span className="ui-search-kind">Charger</span>
  </button>
);

export const SearchPanel = ({ state, activeIndex, setActiveIndex, onPick }: SearchPanelProps) => {
  const { query, loading, routes, chargers, total } = state;
  const count = routes.length + chargers.length;

  const showHint = query.length === 0;
  const showEmpty = !showHint && !loading && total === 0;

  return (
    <div role="listbox" className="ui-search-panel">
      {showHint && (
        <p className="ui-search-hint">
          Type to search chargers and pages. <kbd>↑</kbd> <kbd>↓</kbd> to move, <kbd>↵</kbd> to open, <kbd>esc</kbd> to close.
        </p>
      )}

      {loading && <p className="ui-search-hint">Searching…</p>}

      {showEmpty && (
        <p className="ui-search-hint">
          No matches for <q className="ui-search-q">{query}</q>
        </p>
      )}

      {routes.length > 0 && (
        <Group title="Pages">
          {routes.map((r, i) => (
            <RouteRow key={r.k} hit={r} active={activeIndex === i} onHover={() => setActiveIndex(i)} onClick={() => onPick(r)} />
          ))}
        </Group>
      )}

      {chargers.length > 0 && (
        <Group title="Chargers">
          {chargers.map((c, i) => {
            const idx = routes.length + i;
            return (
              <ChargerRow key={c.id} hit={c} active={activeIndex === idx} onHover={() => setActiveIndex(idx)} onClick={() => onPick(c)} />
            );
          })}
        </Group>
      )}

      {count > 0 && (
        <p className="ui-search-foot">
          <span className="ui-num">{count}</span> {count === 1 ? "result" : "results"}
        </p>
      )}
    </div>
  );
};
