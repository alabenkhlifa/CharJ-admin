import type { CSSProperties } from "react";
import { Icons, type IconKey } from "../lib/icons";
import { NAV } from "../lib/routes";
import type {
  ChargerHit,
  GlobalSearchState,
  RouteHit,
  SearchHit,
} from "../lib/use-global-search";

type SearchPanelProps = {
  state: GlobalSearchState;
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  onPick: (hit: SearchHit) => void;
};

const flatten = (s: GlobalSearchState): SearchHit[] => [...s.routes, ...s.chargers];

export const SearchPanel = ({ state, activeIndex, setActiveIndex, onPick }: SearchPanelProps) => {
  const { query, loading, routes, chargers, total } = state;
  const items = flatten(state);

  const showHint = query.length === 0;
  const showEmpty = !showHint && !loading && total === 0;

  return (
    <div
      role="listbox"
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        insetInline: 0,
        background: "var(--bg-elev)",
        border: "1px solid var(--border-strong)",
        borderRadius: 10,
        boxShadow: "0 12px 32px rgba(0,0,0,.35)",
        zIndex: 50,
        maxHeight: "70vh",
        overflow: "auto",
        padding: "8px 0",
      }}
    >
      {showHint && (
        <div style={hintStyle}>
          Type to search chargers and pages · <kbd style={kbdStyle}>↑↓</kbd> to navigate ·{" "}
          <kbd style={kbdStyle}>↵</kbd> to open · <kbd style={kbdStyle}>esc</kbd> to close
        </div>
      )}

      {loading && (
        <div style={{ ...hintStyle, color: "var(--text-dim)" }}>Searching…</div>
      )}

      {showEmpty && (
        <div style={hintStyle}>
          No matches for <span style={{ color: "var(--text)" }}>"{query}"</span>
        </div>
      )}

      {routes.length > 0 && (
        <Group title="Pages">
          {routes.map((r, i) => (
            <RouteRow
              key={r.k}
              hit={r}
              active={activeIndex === i}
              onHover={() => setActiveIndex(i)}
              onClick={() => onPick(r)}
            />
          ))}
        </Group>
      )}

      {chargers.length > 0 && (
        <Group title="Chargers">
          {chargers.map((c, i) => {
            const idx = routes.length + i;
            return (
              <ChargerRow
                key={c.id}
                hit={c}
                active={activeIndex === idx}
                onHover={() => setActiveIndex(idx)}
                onClick={() => onPick(c)}
              />
            );
          })}
        </Group>
      )}

      {items.length > 0 && (
        <div style={footerStyle}>
          <span className="num">{items.length}</span> result{items.length === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
};

const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <div
      style={{
        padding: "6px 16px",
        fontSize: 10,
        color: "var(--text-dim)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}
    >
      {title}
    </div>
    {children}
  </div>
);

const RouteRow = ({
  hit,
  active,
  onHover,
  onClick,
}: {
  hit: RouteHit;
  active: boolean;
  onHover: () => void;
  onClick: () => void;
}) => {
  const meta = NAV.find((n) => n.k === hit.k);
  const ic = meta?.ic as IconKey | undefined;
  const Ic = ic ? Icons[ic] : null;
  return (
    <button
      onMouseEnter={onHover}
      onClick={onClick}
      style={rowStyle(active)}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flex: 1 }}>
        {Ic && <Ic size={14} style={{ color: "var(--text-muted)" }} />}
        <span>{hit.l}</span>
      </span>
      <span style={kindStyle}>page</span>
    </button>
  );
};

const ChargerRow = ({
  hit,
  active,
  onHover,
  onClick,
}: {
  hit: ChargerHit;
  active: boolean;
  onHover: () => void;
  onClick: () => void;
}) => (
  <button onMouseEnter={onHover} onClick={onClick} style={rowStyle(active)}>
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
      <Icons.Charger size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
      <span style={{ minWidth: 0, display: "flex", flexDirection: "column", textAlign: "start" }}>
        <span style={{ color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {hit.name}
        </span>
        <span
          style={{
            fontSize: 10,
            color: "var(--text-dim)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {hit.city}
        </span>
      </span>
    </span>
    <span style={kindStyle}>charger</span>
  </button>
);

const rowStyle = (active: boolean): CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  padding: "8px 16px",
  background: active ? "var(--surface-hover)" : "transparent",
  border: "none",
  color: "var(--text)",
  fontSize: 12,
  cursor: "pointer",
  textAlign: "start",
});

const hintStyle: CSSProperties = {
  padding: "12px 16px",
  fontSize: 12,
  color: "var(--text-muted)",
  lineHeight: 1.6,
};

const kbdStyle: CSSProperties = {
  fontSize: 10,
  padding: "1px 5px",
  borderRadius: 3,
  background: "var(--bg-elev-2)",
  border: "1px solid var(--border)",
  color: "var(--text-dim)",
  fontFamily: "inherit",
};

const kindStyle: CSSProperties = {
  fontSize: 10,
  color: "var(--text-dim)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  padding: "1px 6px",
  borderRadius: 3,
  border: "1px solid var(--border)",
  background: "var(--bg-elev-2)",
  flexShrink: 0,
};

const footerStyle: CSSProperties = {
  marginTop: 4,
  padding: "8px 16px",
  borderTop: "1px solid var(--border)",
  fontSize: 11,
  color: "var(--text-dim)",
};
