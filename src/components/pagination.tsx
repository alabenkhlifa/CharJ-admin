import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Icons } from "../lib/icons";

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

type PaginationProps = {
  page: number;          // 1-based
  perPage: number;
  total: number;
  onPageChange: (next: number) => void;
  onPerPageChange?: (next: number) => void;
  // Hide the page-size selector when the parent doesn't actually re-fetch
  // on size change (e.g. fixed server batch). Defaults to showing it.
  showPerPage?: boolean;
  // Disable controls while data is being fetched/refetched.
  loading?: boolean;
};

export const Pagination = ({
  page,
  perPage,
  total,
  onPageChange,
  onPerPageChange,
  showPerPage = true,
  loading = false,
}: PaginationProps) => {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * perPage + 1;
  const to = Math.min(total, safePage * perPage);
  const canPrev = safePage > 1 && !loading;
  const canNext = safePage < totalPages && !loading;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 14px",
        borderTop: "1px solid var(--border)",
        fontSize: 12,
        color: "var(--text-muted)",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="num">
          {from.toLocaleString()}–{to.toLocaleString()}
        </span>
        <span style={{ color: "var(--text-dim)" }}>of</span>
        <span className="num" style={{ color: "var(--text)" }}>
          {total.toLocaleString()}
        </span>
        {showPerPage && onPerPageChange && (
          <>
            <span style={{ color: "var(--text-dim)", marginInlineStart: 8 }}>·</span>
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                color: "var(--text-dim)",
              }}
            >
              <span>Rows per page</span>
              <select
                value={perPage}
                onChange={(e) => onPerPageChange(Number(e.target.value))}
                disabled={loading}
                style={selectStyle}
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          onClick={() => canPrev && onPageChange(safePage - 1)}
          disabled={!canPrev}
          aria-label="Previous page"
          title="Previous page"
          style={navBtnStyle(canPrev)}
        >
          <Icons.ChevronRight
            size={13}
            style={{ transform: "rotate(180deg)" }}
          />
        </button>
        <span
          className="num"
          style={{
            color: "var(--text)",
            padding: "0 8px",
            minWidth: 60,
            textAlign: "center",
          }}
        >
          {safePage} / {totalPages}
        </span>
        <button
          onClick={() => canNext && onPageChange(safePage + 1)}
          disabled={!canNext}
          aria-label="Next page"
          title="Next page"
          style={navBtnStyle(canNext)}
        >
          <Icons.ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
};

// ── Client-side slicing helper ────────────────────────────────────────────
// Use when the entire dataset is already in memory (e.g. `useChargers`
// fetches up to 1000 rows in one shot). Resets to page 1 whenever the
// `resetKey` changes — usually the filter state.

type UsePaginatedResult<T> = {
  page: number;
  perPage: number;
  setPage: (p: number) => void;
  setPerPage: (n: number) => void;
  pageItems: T[];
  total: number;
};

export function usePaginated<T>(
  items: T[],
  resetKey: unknown = null,
  initialPerPage: number = DEFAULT_PAGE_SIZE,
): UsePaginatedResult<T> {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(initialPerPage);

  // Reset to page 1 whenever the filter / tab signal changes, or when the
  // current page would otherwise be out of bounds (e.g. items shrank).
  useEffect(() => {
    setPage(1);
  }, [resetKey, perPage]);

  const total = items.length;
  const pageItems = useMemo(() => {
    const start = (page - 1) * perPage;
    return items.slice(start, start + perPage);
  }, [items, page, perPage]);

  // Guard against page being out of range after items change without the
  // resetKey changing (e.g. row deleted). Snap back to last valid page.
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    if (page > totalPages) setPage(totalPages);
  }, [total, page, perPage]);

  return { page, perPage, setPage, setPerPage, pageItems, total };
}

const navBtnStyle = (enabled: boolean): CSSProperties => ({
  width: 28,
  height: 28,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: enabled ? "var(--text)" : "var(--text-dim)",
  cursor: enabled ? "pointer" : "not-allowed",
  opacity: enabled ? 1 : 0.5,
});

const selectStyle: CSSProperties = {
  background: "var(--bg-elev-2)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "2px 4px",
  color: "var(--text)",
  fontFamily: "inherit",
  fontSize: 12,
  outline: "none",
  cursor: "pointer",
};
