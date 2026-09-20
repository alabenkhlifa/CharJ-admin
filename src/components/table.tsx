import type { CSSProperties, ReactNode } from "react";
import { Icons } from "../lib/icons";
import type { Sort } from "../lib/table-sort";

// Table header primitives. Sorting lives in the URL, so these are pure
// presentation: the page owns the state and hands down `sort` + `onSort`.

const thStyle: CSSProperties = {
  textAlign: "start",
  padding: "12px 16px",
  fontSize: 10,
  color: "var(--text-dim)",
  fontWeight: 500,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

export const Th = ({ children, style }: { children?: ReactNode; style?: CSSProperties }) => (
  <th style={{ ...thStyle, ...style }}>{children}</th>
);

type SortableThProps<K extends string> = {
  label: string;
  sortKey: K;
  sort: Sort<K>;
  onSort: (key: K) => void;
  // Numbers read better right-aligned; the arrow follows the text.
  align?: "start" | "end";
  style?: CSSProperties;
};

export function SortableTh<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  align = "start",
  style,
}: SortableThProps<K>) {
  const on = sort.key === sortKey;
  return (
    <th
      // aria-sort is what a screen reader announces; without it a sortable
      // column is indistinguishable from a static one.
      aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      style={{ ...thStyle, padding: 0, ...style }}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={
          on
            ? `Sorted ${sort.dir === "asc" ? "ascending" : "descending"} — click to reverse`
            : `Sort by ${label.toLowerCase()}`
        }
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: align === "end" ? "flex-end" : "flex-start",
          gap: 4,
          width: "100%",
          padding: "12px 16px",
          background: "transparent",
          border: "none",
          font: "inherit",
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: on ? "var(--text)" : "var(--text-dim)",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {label}
        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            opacity: on ? 1 : 0.25,
            color: on ? "var(--accent)" : "inherit",
          }}
        >
          {on && sort.dir === "desc" ? <Icons.ArrowDown size={11} /> : <Icons.ArrowUp size={11} />}
        </span>
      </button>
    </th>
  );
}
