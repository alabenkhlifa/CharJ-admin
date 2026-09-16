// Small labelled <select> in a bordered chip. Mirrors the FilterChip look on
// the Chargers page, but generic over the value type so pages can keep their
// own string unions instead of stringly-typed filters.

type SelectChipProps<T extends string> = {
  label: string;
  value: T;
  options: { v: T; l: string }[];
  onChange: (v: T) => void;
  // Highlight the border when the chip is narrowing the result set.
  active?: boolean;
};

export const SelectChip = <T extends string>({
  label,
  value,
  options,
  onChange,
  active = false,
}: SelectChipProps<T>) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "6px 10px",
      background: "var(--bg-elev)",
      border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
      borderRadius: 6,
      fontSize: 12,
    }}
  >
    <span style={{ color: "var(--text-dim)" }}>{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      style={{
        background: "transparent",
        border: "none",
        color: "var(--text)",
        fontFamily: "inherit",
        fontSize: 12,
        outline: "none",
        cursor: "pointer",
      }}
    >
      {options.map((o) => (
        <option key={o.v} value={o.v} style={{ background: "var(--bg-elev)" }}>
          {o.l}
        </option>
      ))}
    </select>
  </div>
);
