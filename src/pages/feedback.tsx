import { Card } from "../components/card";

type FeedbackItem = {
  id: string;
  from: string;
  subj: string;
  cat: string;
  t: string;
  unread: boolean;
};

const ITEMS: FeedbackItem[] = [
  { id: "fb-2841", from: "ali.r", subj: "Charger at IKEA always offline", cat: "charger_issue", t: "12m", unread: true },
  { id: "fb-2840", from: "fatma.m", subj: "Add charging session history", cat: "feature_request", t: "1h", unread: true },
  { id: "fb-2839", from: "noha.b", subj: "App crashes on Android 12", cat: "bug", t: "3h", unread: false },
  { id: "fb-2838", from: "khalil.t", subj: "Thank you for this app!", cat: "general", t: "5h", unread: false },
];

export const FeedbackPage = () => (
  <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Feedback</h1>
    <Card padding={0}>
      <div
        className="feedback-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          minHeight: 500,
        }}
      >
        <div style={{ borderInlineEnd: "1px solid var(--border)" }}>
          {ITEMS.map((f, i) => (
            <div
              key={f.id}
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid var(--border)",
                background: i === 0 ? "var(--surface-hover)" : "transparent",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: f.unread ? 600 : 400,
                    color: f.unread ? "var(--text)" : "var(--text-muted)",
                  }}
                >
                  {f.from}
                </span>
                <span style={{ fontSize: 10, color: "var(--text-dim)" }}>{f.t}</span>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: f.unread ? "var(--text)" : "var(--text-muted)",
                  marginTop: 4,
                  fontWeight: f.unread ? 500 : 400,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {f.subj}
              </div>
              <div style={{ marginTop: 6 }}>
                <span
                  style={{
                    fontSize: 10,
                    padding: "1px 6px",
                    borderRadius: 3,
                    background: "var(--bg-elev-2)",
                    color: "var(--text-dim)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {f.cat.replace("_", " ")}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: 24 }}>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-dim)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            fb-2841 · charger issue
          </div>
          <h2 style={{ margin: "6px 0 12px", fontSize: 18, fontWeight: 600 }}>
            Charger at IKEA always offline
          </h2>
          <div
            style={{
              display: "flex",
              gap: 16,
              fontSize: 11,
              color: "var(--text-muted)",
              marginBottom: 16,
            }}
          >
            <span>
              From: <span style={{ color: "var(--text)" }}>ali.r@gmail.com</span>
            </span>
            <span>
              App:{" "}
              <span className="num" style={{ color: "var(--text)" }}>
                1.4.2
              </span>
            </span>
            <span>
              OS: <span style={{ color: "var(--text)" }}>iOS 17.4</span>
            </span>
            <span>Device: iPhone 14</span>
          </div>
          <div
            style={{
              padding: 16,
              background: "var(--bg-elev-2)",
              borderRadius: 8,
              fontSize: 13,
              color: "var(--text)",
              lineHeight: 1.6,
            }}
          >
            Hi team, the IKEA charger has been showing as offline for 4 days now but I drove there
            and it's actually working. Please update.
          </div>
          <textarea
            placeholder="Reply to ali.r…"
            style={{
              width: "100%",
              marginTop: 16,
              padding: 12,
              background: "var(--bg-elev-2)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--text)",
              fontFamily: "inherit",
              fontSize: 13,
              minHeight: 80,
              resize: "vertical",
              outline: "none",
            }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              style={{
                padding: "8px 14px",
                background: "var(--accent)",
                color: "#0a0a0b",
                border: "none",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              Send reply
            </button>
            <button
              style={{
                padding: "8px 14px",
                background: "var(--bg-elev-2)",
                color: "var(--text-muted)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                fontSize: 12,
              }}
            >
              Convert to issue
            </button>
            <button
              style={{
                padding: "8px 14px",
                background: "var(--bg-elev-2)",
                color: "var(--text-muted)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                fontSize: 12,
              }}
            >
              Mark resolved
            </button>
          </div>
        </div>
      </div>
    </Card>
  </div>
);
