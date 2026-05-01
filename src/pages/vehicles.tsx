import { Card } from "../components/card";

type Vehicle = { model: string; year: number; battery: number; color: string; count: number };

const VEHICLES: Vehicle[] = [
  { model: "Tesla Model 3", year: 2023, battery: 60, color: "#0a0a0b", count: 84 },
  { model: "VW ID.4", year: 2024, battery: 77, color: "#3B82F6", count: 42 },
  { model: "Hyundai Kona EV", year: 2022, battery: 64, color: "#FFFFFF", count: 38 },
  { model: "Renault Zoé", year: 2021, battery: 52, color: "#EF4444", count: 64 },
  { model: "BYD Atto 3", year: 2024, battery: 60, color: "#10B981", count: 28 },
  { model: "Audi Q4 e-tron", year: 2024, battery: 82, color: "#8B5CF6", count: 18 },
];

export const VehiclesPage = () => (
  <div className="fade-in">
    <h1 style={{ margin: "0 0 16px", fontSize: 22, fontWeight: 600 }}>Vehicles</h1>
    <div
      className="card-grid-260"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 12,
      }}
    >
      {VEHICLES.map((v, i) => (
        <Card key={i} padding={16}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 8,
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 4,
                background: v.color,
                border: "1px solid var(--border-strong)",
              }}
            />
            <span className="num" style={{ fontSize: 11, color: "var(--text-dim)" }}>
              {v.year}
            </span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{v.model}</div>
          <div className="num" style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {v.battery} kWh
          </div>
          <div
            style={{
              marginTop: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: "var(--text-dim)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Owners
            </span>
            <span
              className="num"
              style={{ fontSize: 16, color: "var(--accent)", fontWeight: 600 }}
            >
              {v.count}
            </span>
          </div>
        </Card>
      ))}
    </div>
  </div>
);
