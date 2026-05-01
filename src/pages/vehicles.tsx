import { useMemo } from "react";
import { Card, EmptyState } from "../components/card";
import { CONNECTOR_COLORS, CONNECTOR_LABELS } from "../data/chargers";
import { useEvModels, type EvModel } from "../data/vehicles";

const SKELETON_COUNT = 8;

const formatYear = (m: EvModel): string => {
  if (m.yearTo == null) return `${m.yearFrom}+`;
  if (m.yearTo === m.yearFrom) return `${m.yearFrom}`;
  return `${m.yearFrom}–${m.yearTo}`;
};

// Prefer usable kWh when it differs from gross — that's the number drivers
// actually plan around. Fall back to battery_kwh otherwise.
const formatBattery = (m: EvModel): string => {
  const kwh = m.usableBatteryKwh > 0 ? m.usableBatteryKwh : m.batteryKwh;
  // numeric(5,1) → at most one decimal; trim trailing .0 for cleanliness.
  const rounded = Math.round(kwh * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
};

// Headline charging spec: DC peak when the car supports it, else AC peak.
const formatMaxCharge = (m: EvModel): { value: string; label: string } | null => {
  if (m.maxDcKw > 0) {
    return { value: `${Math.round(m.maxDcKw)}`, label: "kW DC" };
  }
  if (m.maxAcKw > 0) {
    return { value: `${Math.round(m.maxAcKw)}`, label: "kW AC" };
  }
  return null;
};

export const VehiclesPage = () => {
  const { data: models, loading, error } = useEvModels();

  const breakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of models) counts.set(m.source, (counts.get(m.source) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [models]);

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>
          Vehicles
        </h1>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
          {loading ? (
            <span style={{ color: "var(--text-dim)" }}>Loading catalogue…</span>
          ) : (
            <>
              <span className="num">{models.length}</span>{" "}
              {models.length === 1 ? "model" : "models"}
              {breakdown.length > 0 && (
                <>
                  {" · "}
                  {breakdown.map(([src, n], i) => (
                    <span key={src}>
                      <span className="num">{n}</span> {src}
                      {i < breakdown.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </>
              )}
            </>
          )}
        </div>
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
          Failed to load vehicles: {error}
        </div>
      )}

      {!loading && !error && models.length === 0 && (
        <EmptyState
          title="No EV models in the catalogue yet"
          subtitle="Run the ev_models seed migration or the Wikidata sync to populate this page."
        />
      )}

      <div
        className="card-grid-220"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        {loading &&
          Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <Card key={`s-${i}`} padding={16}>
              <div className="skeleton" style={{ height: 11, width: "40%" }} />
              <div className="skeleton" style={{ height: 14, width: "80%", marginTop: 10 }} />
              <div className="skeleton" style={{ height: 11, width: "55%", marginTop: 8 }} />
              <div
                className="skeleton"
                style={{ height: 11, width: "65%", marginTop: 14 }}
              />
              <div style={{ display: "flex", gap: 4, marginTop: 14 }}>
                <div className="skeleton" style={{ height: 16, width: 48, borderRadius: 3 }} />
                <div className="skeleton" style={{ height: 16, width: 40, borderRadius: 3 }} />
              </div>
            </Card>
          ))}

        {!loading &&
          models.map((m) => {
            const charge = formatMaxCharge(m);
            return (
              <Card key={m.id} padding={16}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 8,
                  }}
                >
                  <span
                    className="num"
                    style={{
                      fontSize: 11,
                      color: "var(--text-dim)",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {formatYear(m)}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      color: "var(--text-dim)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      padding: "2px 6px",
                      borderRadius: 3,
                      border: "1px solid var(--border)",
                      background: "var(--bg-elev-2)",
                    }}
                  >
                    {m.source}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: "var(--text)",
                    marginTop: 10,
                    lineHeight: 1.25,
                  }}
                >
                  {m.make} {m.model}
                </div>
                {m.variant && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      marginTop: 2,
                    }}
                  >
                    {m.variant}
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 12,
                    marginTop: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <span
                      className="num"
                      style={{ fontSize: 16, color: "var(--text)", fontWeight: 600 }}
                    >
                      {formatBattery(m)}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-dim)", marginInlineStart: 3 }}>
                      kWh
                    </span>
                  </div>
                  {charge && (
                    <div>
                      <span
                        className="num"
                        style={{ fontSize: 16, color: "var(--accent)", fontWeight: 600 }}
                      >
                        {charge.value}
                      </span>
                      <span
                        style={{ fontSize: 11, color: "var(--text-dim)", marginInlineStart: 3 }}
                      >
                        {charge.label}
                      </span>
                    </div>
                  )}
                </div>

                {m.connectorKeys.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 4,
                      marginTop: 12,
                    }}
                  >
                    {m.connectorKeys.map((k) => (
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
                )}
              </Card>
            );
          })}
      </div>
    </div>
  );
};
