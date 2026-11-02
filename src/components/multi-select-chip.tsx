import { useEffect, useId, useMemo, useRef, useState } from "react";
import "./multi-select-chip.css";

// Filter chip that accepts several values at once. A single <select> forces
// "operational OR nothing" — the questions you actually ask a charger
// catalogue are "operational *and* planned", "everything except OCM".
//
// Deliberately a popover of checkboxes rather than a native multiple-select:
// native multi-selects need ctrl-click to add a value, which nobody discovers,
// and they can't show per-option counts.
//
// Health Rings look (DESIGN.md "Chips"): a Fill chip, label in Secondary Ink,
// value in Ink (Screens Text while it narrows the rows). The popover floats in
// Card with the tooltip shadow and opens toward whichever side has room, so
// it never pushes the page sideways.

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

const POP_WIDTH = 240;
const EDGE = 8;

const Chevron = ({ open }: { open: boolean }) => (
  <svg className="ms-chev" data-open={open} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

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
  const [toEnd, setToEnd] = useState(false);
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

  // Open toward the inline end only while the panel fits that way; a chip at
  // the end of its row opens back toward the start instead. Measured on the
  // tap that opens it.
  const roomTowardEnd = () => {
    const el = wrapRef.current;
    if (!el) return true;
    const r = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const rtl = getComputedStyle(el).direction === "rtl";
    return (rtl ? r.right : vw - r.left) >= POP_WIDTH + EDGE;
  };
  const flip = () => {
    if (!open) setToEnd(!roomTowardEnd());
    setOpen(!open);
  };

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

  const toggle = (v: string) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);

  return (
    <div ref={wrapRef} className="ms">
      <button
        type="button"
        className="ms-chip"
        data-active={active}
        onClick={flip}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
      >
        <span className="ms-label">{label}</span>
        <span className="ms-value">{summary}</span>
        <Chevron open={open} />
      </button>

      {open && (
        <div id={panelId} role="group" aria-label={label} className="ms-pop" data-end={toEnd}>
          {searchable && (
            <input
              autoFocus
              className="ms-find"
              value={needle}
              onChange={(e) => setNeedle(e.target.value)}
              placeholder={`Filter ${label.toLowerCase()}…`}
              aria-label={`Filter ${label.toLowerCase()}`}
            />
          )}

          {visible.length === 0 && <p className="ms-none">No match.</p>}

          {visible.map((o) => {
            const on = values.includes(o.v);
            return (
              <label key={o.v} className="ms-opt" data-on={on}>
                <input type="checkbox" checked={on} onChange={() => toggle(o.v)} />
                <span className="ms-opt-l">{o.l}</span>
                {o.count !== undefined && <span className="ms-opt-n">{o.count}</span>}
              </label>
            );
          })}

          {active && (
            <button type="button" className="ms-clear" onClick={() => onChange([])}>
              Clear {label.toLowerCase()}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
