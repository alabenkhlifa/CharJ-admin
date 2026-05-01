import { Card, EmptyState as _ } from "../components/card";
import { CardHeader } from "../components/card";
import { Icons } from "../lib/icons";

void _;

type Review = { user: string; charger: string; stars: number; text: string; helpful: number };
type Reported = { user: string; text: string; reasons: string[]; count: number };

const REVIEWS: Review[] = [
  { user: "salma.k", charger: "Total Energies La Marsa", stars: 5, text: "Reliable and fast. Good location.", helpful: 12 },
  { user: "ahmed.b", charger: "IKEA Tunis", stars: 4, text: "Worked but the cable was a bit short for my car.", helpful: 7 },
  { user: "nadia.t", charger: "Audi Ennakl Lac 2", stars: 2, text: "Was occupied by ICE car for 2h. Frustrating.", helpful: 24 },
  { user: "mehdi.s", charger: "Mall of Sousse", stars: 5, text: "Two CCS plugs both worked perfectly.", helpful: 4 },
];

const REPORTED: Reported[] = [
  { user: "anonymous", text: "This charger sucks and the owner is...", reasons: ["offensive", "spam"], count: 4 },
  { user: "rival.brand", text: "Don't go here, use ours instead!", reasons: ["spam"], count: 7 },
  { user: "user.x", text: "Charger is slow", reasons: ["inaccurate"], count: 2 },
];

export const ReviewsPage = () => (
  <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Reviews & reports</h1>
    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
      <Card>
        <CardHeader title="Recent reviews" subtitle="Stream · all chargers" periodSelector={false} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {REVIEWS.map((r, i) => (
            <div
              key={i}
              style={{
                padding: 12,
                border: "1px solid var(--border)",
                borderRadius: 6,
                background: "var(--bg-elev-2)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{r.user}</span>
                  <span style={{ fontSize: 11, color: "var(--text-dim)" }}>· {r.charger}</span>
                </div>
                <div style={{ display: "flex", gap: 1 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Icons.Star
                      key={n}
                      size={11}
                      style={{ color: n <= r.stars ? "var(--amber)" : "var(--border-strong)" }}
                    />
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.55 }}>{r.text}</div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 8,
                }}
              >
                <span
                  style={{ fontSize: 10, color: "var(--text-dim)" }}
                  className="num"
                >
                  ▲ {r.helpful} found helpful
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    style={{
                      fontSize: 10,
                      padding: "3px 8px",
                      background: "transparent",
                      color: "var(--text-muted)",
                      border: "1px solid var(--border)",
                      borderRadius: 4,
                    }}
                  >
                    Hide
                  </button>
                  <button
                    style={{
                      fontSize: 10,
                      padding: "3px 8px",
                      background: "transparent",
                      color: "var(--accent)",
                      border: "1px solid var(--accent-border)",
                      borderRadius: 4,
                    }}
                  >
                    Approve
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <CardHeader title="Reported reviews" subtitle="6 in queue" periodSelector={false} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {REPORTED.map((r, i) => (
            <div
              key={i}
              style={{
                padding: 12,
                border: "1px solid var(--amber)",
                borderRadius: 6,
                background: "color-mix(in srgb, var(--amber) 8%, transparent)",
              }}
            >
              <div
                style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}
              >
                <span style={{ fontSize: 12, fontWeight: 500 }}>{r.user}</span>
                <span
                  className="num"
                  style={{
                    fontSize: 10,
                    color: "var(--amber)",
                    padding: "1px 6px",
                    background: "color-mix(in srgb, var(--amber) 15%, transparent)",
                    borderRadius: 10,
                  }}
                >
                  {r.count} reports
                </span>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  marginBottom: 8,
                  fontStyle: "italic",
                }}
              >
                "{r.text}"
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {r.reasons.map((rr) => (
                  <span
                    key={rr}
                    style={{
                      fontSize: 10,
                      padding: "2px 6px",
                      borderRadius: 3,
                      background: "var(--bg-elev-2)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {rr}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  </div>
);
