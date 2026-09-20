import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Icons } from "../lib/icons";

// Filter chip that accepts several values at once. A single <select> forces
// "operational OR nothing" — the questions you actually ask a charger
// catalogue are "operational *and* planned", "everything except OCM".
//
// Deliberately a popover of checkboxes rather than a native multiple-select:
// native multi-selects need ctrl-click to add a value, which nobody discovers,
// and they can't show per-option counts.

export type MultiOption = { v: string; l: string; count?: number };

type MultiSelectChipProps = {
  label: string;
  values: string[];
  options: MultiOption[];
  onChange: (next: string[]) => void;
  // Show a filter box inside the popover once the list gets long (cities).
  searchable?: boolean;
  // Text shown when nothing is selected.
  allLabel?: string;
};

export const MultiSelectChip = ({
  label,
  values,
  options,
  onChange,
  searchable = false,
  allLabel = "All",
}: MultiSelectChipProps) => {
  const [open, setOpen] = useState(false);
  const [needle, setNeedle] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const active = values.length > 0;

  // Close on outside click / Escape. Both are expected of a popover and both
  // are missing from a bare <div> — without them the panel traps the page.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const visible = useMemo(() => {
    if (!searchable || !needle.trim()) return options;
    const n = needle.trim().toLowerCase();
    return options.filter((o) => o.l.toLowerCase().includes(n));
  }, [options, needle, searchable]);

  const summary =
    values.length === 0
      ? allLabel
      : values.length === 1
        ? (options.find((o) => o.v === values[0])?.l ?? values[0])
        : `${values.length} selected`;

  const toggle = (v: string) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          background: "var(--bg-elev)",
          border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
          borderRadius: 6,
          fontSize: 12,
          fontFamily: "inherit",
          cursor: "pointer",
          color: "var(--text)",
        }}
      >
        <span style={{ color: "var(--text-dim)" }}>{label}</span>
        <span style={{ color: active ? "var(--accent)" : "var(--text)" }}>{summary}</span>
        <Icons.ChevronDown
          size={11}
          style={{
            color: "var(--text-dim)",
            transform: open ? "rotate(180deg)" : undefined,
            transition: "transform .12s",
          }}
        />
      </button>

      {open && (
        <div
          id={panelId}
          role="group"
          aria-label={label}
          style={{
            position: "absolute",
            insetInlineStart: 0,
            top: "calc(100% + 4px)",
            zIndex: 30,
            minWidth: 190,
            maxHeight: 280,
            overflow: "auto",
            background: "var(--bg-elev)",
            border: "1px solid var(--border-strong)",
            borderRadius: 8,
            boxShadow: "0 12px 28px rgba(0,0,0,.28)",
            padding: 6,
          }}
        >
          {searchable && (
            <input
              autoFocus
              value={needle}
              onChange={(e) => setNeedle(e.target.value)}
              placeholder={`Filter ${label.toLowerCase()}…`}
              style={{
                width: "100%",
                boxSizing: "border-box",
                marginBottom: 6,
                padding: "6px 8px",
                background: "var(--bg-elev-2)",
                border: "1px solid var(--border)",
                borderRadius: 5,
                color: "var(--text)",
                fontFamily: "inherit",
                fontSize: 12,
                outline: "none",
              }}
            />
          )}

          {visible.length === 0 && (
            <div style={{ padding: "8px 8px", fontSize: 12, color: "var(--text-dim)" }}>
              No match.
            </div>
          )}

          {visible.map((o) => {
            const on = values.includes(o.v);
            return (
              <label
                key={o.v}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 8px",
                  borderRadius: 5,
                  fontSize: 12,
                  cursor: "pointer",
                  color: on ? "var(--text)" : "var(--text-muted)",
                  background: on ? "var(--surface-hover)" : "transparent",
                }}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(o.v)}
                  style={{ accentColor: "var(--accent)", margin: 0 }}
                />
                <span style={{ flex: 1, minWidth: 0 }}>{o.l}</span>
                {o.count !== undefined && (
                  <span className="num" style={{ color: "var(--text-dim)", fontSize: 11 }}>
                    {o.count}
                  </span>
                )}
              </label>
            );
          })}

          {active && (
            <button
              type="button"
              onClick={() => onChange([])}
              style={{
                width: "100%",
                marginTop: 6,
                padding: "6px 8px",
                background: "transparent",
                border: "none",
                borderTop: "1px solid var(--border)",
                color: "var(--text-dim)",
                fontFamily: "inherit",
                fontSize: 11,
                cursor: "pointer",
                textAlign: "start",
              }}
            >
              Clear {label.toLowerCase()}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
