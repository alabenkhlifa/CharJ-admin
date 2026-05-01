import { useState } from "react";
import { Card } from "../components/card";

type Tab = "pending" | "review" | "approved" | "rejected";

const TABS: { k: Tab; l: string; n: number }[] = [
  { k: "pending", l: "Pending", n: 47 },
  { k: "review", l: "Under review", n: 18 },
  { k: "approved", l: "Approved", n: 92 },
  { k: "rejected", l: "Rejected", n: 46 },
];

type SubmissionItem = {
  id: string;
  who: string;
  type: string;
  name: string;
  gouv: string;
  t: string;
};

const ITEMS: SubmissionItem[] = [
  { id: "s-401", who: "khaled.b", type: "new charger", name: "Hammamet Yasmine — Plage", gouv: "Nabeul", t: "12 min ago" },
  { id: "s-400", who: "sarra.m", type: "edit", name: "Total Energies La Marsa — hours", gouv: "Tunis", t: "1 h ago" },
  { id: "s-399", who: "mehdi.k", type: "report broken", name: "Carrefour Lac — connector damaged", gouv: "Tunis", t: "2 h ago" },
  { id: "s-398", who: "anonymous", type: "new charger", name: "Tozeur centre-ville", gouv: "Tozeur", t: "3 h ago" },
  { id: "s-397", who: "youssef.t", type: "new charger", name: "Aéroport Tunis–Carthage P3", gouv: "Tunis", t: "5 h ago" },
];

export const SubmissionsPage = () => {
  const [tab, setTab] = useState<Tab>("pending");

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>
        Submissions
      </h1>
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)" }}>
        {TABS.map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            style={{
              background: "transparent",
              border: "none",
              padding: "10px 14px",
              fontSize: 13,
              color: tab === t.k ? "var(--text)" : "var(--text-muted)",
              borderBottom: `2px solid ${tab === t.k ? "var(--accent)" : "transparent"}`,
              marginBottom: -1,
              fontWeight: tab === t.k ? 500 : 400,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {t.l}{" "}
            <span
              className="num"
              style={{
                fontSize: 11,
                color: "var(--text-dim)",
                background: "var(--bg-elev-2)",
                padding: "1px 6px",
                borderRadius: 10,
              }}
            >
              {t.n}
            </span>
          </button>
        ))}
      </div>
      <div
        className="card-grid-260"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 12,
        }}
      >
        {ITEMS.map((it) => (
          <Card key={it.id} padding={16}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <span style={{ fontSize: 11, color: "var(--text-dim)" }} className="num">
                #{it.id}
              </span>
              <span
                style={{
                  fontSize: 10,
                  padding: "2px 8px",
                  borderRadius: 3,
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {it.type}
              </span>
            </div>
            <div
              style={{ fontSize: 14, fontWeight: 500, color: "var(--text)", marginBottom: 4 }}
            >
              {it.name}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {it.gouv} · by {it.who}
            </div>
            <div
              style={{
                height: 80,
                marginTop: 10,
                background: "var(--bg-elev-2)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                display: "grid",
                placeItems: "center",
                color: "var(--text-dim)",
                fontSize: 10,
              }}
            >
              Mini map · {it.gouv}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
              <button
                style={{
                  flex: 1,
                  padding: "6px 10px",
                  background: "var(--accent)",
                  color: "#0a0a0b",
                  border: "none",
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 500,
                }}
              >
                Approve
              </button>
              <button
                style={{
                  flex: 1,
                  padding: "6px 10px",
                  background: "var(--bg-elev-2)",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  fontSize: 11,
                }}
              >
                Reject
              </button>
              <button
                style={{
                  padding: "6px 10px",
                  background: "var(--bg-elev-2)",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  fontSize: 11,
                }}
              >
                ···
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
