import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Card, EmptyState } from "../components/card";
import { iconBtnStyle } from "../components/charts";
import { Icons } from "../lib/icons";
import {
  CONNECTOR_COLORS,
  CONNECTOR_LABELS,
  useChargers,
  type AccessType,
  type Charger,
  type ChargerSource,
  type ChargerStatus,
  type ConnectorKey,
  type WorkingHours,
} from "../data/chargers";

type Filters = {
  status: string;
  access: string;
  verified: string;
  source: string;
  connector: string;
};

const DEFAULT_FILTERS: Filters = {
  status: "all",
  access: "all",
  verified: "all",
  source: "all",
  connector: "all",
};

const statusChip = (s: ChargerStatus) => {
  const map: Record<ChargerStatus, [string, string]> = {
    operational: ["Operational", "var(--green)"],
    under_repair: ["Under repair", "var(--amber)"],
    planned: ["Planned", "var(--indigo)"],
    unknown: ["Unknown", "var(--slate)"],
  };
  const [l, c] = map[s];
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
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c }} />
      {l}
    </span>
  );
};

const accessChip = (a: AccessType) => {
  const map: Record<AccessType, [string, string]> = {
    public: ["Public", "var(--accent)"],
    customers_only: ["Customers", "var(--indigo)"],
    brand_exclusive: ["Brand-only", "var(--violet)"],
  };
  const [l, c] = map[a];
  return (
    <span
      style={{
        fontSize: 11,
        color: c,
        padding: "2px 8px",
        borderRadius: 4,
        background: `color-mix(in srgb, ${c} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${c} 25%, transparent)`,
      }}
    >
      {l}
    </span>
  );
};

type FilterChipProps = {
  label: string;
  value: string;
  options: { v: string; l: string }[];
  onChange: (v: string) => void;
};

const FilterChip = ({ label, value, options, onChange }: FilterChipProps) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "6px 10px",
      background: "var(--bg-elev)",
      border: `1px solid ${value !== "all" ? "var(--accent)" : "var(--border)"}`,
      borderRadius: 6,
      fontSize: 12,
    }}
  >
    <span style={{ color: "var(--text-dim)" }}>{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: "transparent",
        border: "none",
        color: value !== "all" ? "var(--accent)" : "var(--text)",
        fontSize: 12,
        fontFamily: "inherit",
        outline: "none",
        cursor: "pointer",
      }}
    >
      {options.map((o) => (
        <option key={o.v} value={o.v}>
          {o.l}
        </option>
      ))}
    </select>
  </div>
);

export const ChargersPage = () => {
  const { data: chargers, loading, error } = useChargers();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<Charger | null>(null);

  const filtered = useMemo(
    () =>
      chargers.filter((c) => {
        if (filters.status !== "all" && c.status !== filters.status) return false;
        if (filters.access !== "all" && c.access !== filters.access) return false;
        if (filters.verified === "yes" && !c.verified) return false;
        if (filters.verified === "no" && c.verified) return false;
        if (filters.source !== "all" && c.source !== filters.source) return false;
        if (
          filters.connector !== "all" &&
          !c.connectors.includes(filters.connector as ConnectorKey)
        )
          return false;
        return true;
      }),
    [chargers, filters],
  );

  const verifiedCount = chargers.filter((c) => c.verified).length;

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
                <span className="num">{filtered.length}</span> of{" "}
                <span className="num">{chargers.length}</span> shown ·{" "}
                <span className="num">{verifiedCount}</span> verified
              </>
            )}
          </div>
        </div>
        <button
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
          }}
        >
          <Icons.Plus size={12} stroke={2.4} /> Add charger
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <FilterChip
          label="Status"
          value={filters.status}
          onChange={(v) => setFilters({ ...filters, status: v })}
          options={[
            { v: "all", l: "All" },
            { v: "operational", l: "Operational" },
            { v: "under_repair", l: "Under repair" },
            { v: "planned", l: "Planned" },
          ]}
        />
        <FilterChip
          label="Access"
          value={filters.access}
          onChange={(v) => setFilters({ ...filters, access: v })}
          options={[
            { v: "all", l: "All" },
            { v: "public", l: "Public" },
            { v: "customers_only", l: "Customers only" },
            { v: "brand_exclusive", l: "Brand exclusive" },
          ]}
        />
        <FilterChip
          label="Connector"
          value={filters.connector}
          onChange={(v) => setFilters({ ...filters, connector: v })}
          options={[
            { v: "all", l: "All" },
            { v: "t2", l: "Type 2" },
            { v: "ccs", l: "CCS" },
            { v: "chademo", l: "CHAdeMO" },
          ]}
        />
        <FilterChip
          label="Verified"
          value={filters.verified}
          onChange={(v) => setFilters({ ...filters, verified: v })}
          options={[
            { v: "all", l: "All" },
            { v: "yes", l: "Yes" },
            { v: "no", l: "No" },
          ]}
        />
        <FilterChip
          label="Source"
          value={filters.source}
          onChange={(v) => setFilters({ ...filters, source: v })}
          options={[
            { v: "all", l: "All" },
            { v: "ocm", l: "OCM" },
            { v: "curated", l: "Curated" },
            { v: "community", l: "Community" },
          ]}
        />
        {Object.values(filters).some((v) => v !== "all") && (
          <button
            onClick={() => setFilters(DEFAULT_FILTERS)}
            style={{
              fontSize: 11,
              color: "var(--text-dim)",
              background: "transparent",
              border: "none",
              padding: "6px 8px",
              textDecoration: "underline",
            }}
          >
            Clear filters
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
                {[
                  "Name",
                  "City",
                  "Connectors",
                  "Power",
                  "Status",
                  "Access",
                  "Hours",
                  "Source",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "start",
                      padding: "12px 16px",
                      fontSize: 10,
                      color: "var(--text-dim)",
                      fontWeight: 500,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                    {Array.from({ length: 9 }).map((__, j) => (
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
                filtered.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelected(c)}
                    style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "var(--surface-hover)")
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
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
                    <td style={{ padding: "12px 16px", textAlign: "end" }}>
                      <Icons.More size={14} style={{ color: "var(--text-dim)" }} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!loading && !error && filtered.length === 0 && (
            <EmptyState
              title={chargers.length === 0 ? "No chargers in the database yet" : "No chargers match"}
              subtitle={
                chargers.length === 0
                  ? "Run the OCM sync or add a charger to see rows here."
                  : "Try clearing some filters."
              }
            />
          )}
        </div>
      </Card>

      {selected && <DetailDrawer charger={selected} onClose={() => setSelected(null)} />}
    </div>
  );
};

const sourceLabel = (s: ChargerSource) => s.toUpperCase();

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

const dayCellLabel = (wh: WorkingHours, idx: number): string => {
  if (!wh) return "—";
  const v = wh[DAY_KEYS[idx]];
  if (!v) return "—";
  if (v.closed) return "Closed";
  if (!v.open || !v.close) return "—";
  if (v.open === "00:00" && v.close === "24:00") return "24h";
  return `${v.open.slice(0, 5)}–${v.close.slice(0, 5)}`;
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

const DetailDrawer = ({ charger, onClose }: { charger: Charger; onClose: () => void }) => {
  const today = todayIndex();
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

          <div
            style={{
              height: 140,
              background: "var(--bg-elev-2)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <svg width="100%" height="100%" viewBox="0 0 200 140">
              <defs>
                <pattern id="g1" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--grid)" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="200" height="140" fill="url(#g1)" />
              <path
                d="M 0 90 Q 50 70 100 80 T 200 60"
                stroke="var(--border-strong)"
                strokeWidth="2"
                fill="none"
              />
              <circle cx="100" cy="70" r="6" fill="var(--accent)" opacity="0.3" />
              <circle cx="100" cy="70" r="3" fill="var(--accent)" />
              <text
                x="100"
                y="120"
                fill="var(--text-dim)"
                fontSize="9"
                textAnchor="middle"
                className="num"
              >
                {charger.lat.toFixed(4)}, {charger.lng.toFixed(4)}
              </text>
            </svg>
          </div>

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
                gridTemplateColumns: "repeat(7, 1fr)",
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <KV k="City" v={charger.city} />
            <KV k="Source" v={charger.source.toUpperCase()} />
            <KV k="OCM ID" v={charger.ocmId ?? "—"} />
            <KV k="Updated" v={fmtAgo(charger.updatedAt)} />
            <KV k="Verified by" v={charger.verifiedBy ?? "—"} />
            <KV k="Coordinates" v={`${charger.lat.toFixed(4)}, ${charger.lng.toFixed(4)}`} />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
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
              }}
            >
              <Icons.Verify size={13} /> Verify
            </button>
            <button
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
              Edit override
            </button>
            <button
              style={{
                padding: "10px 12px",
                background: "var(--bg-elev-2)",
                color: "var(--text-muted)",
                border: "1px solid var(--border)",
                borderRadius: 6,
              }}
            >
              <Icons.Map size={13} />
            </button>
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
