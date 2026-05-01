import { Card, EmptyState } from "../components/card";

export const FeedbackPage = () => (
  <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Feedback</h1>
    <Card padding={0}>
      <EmptyState
        title="Feedback inbox needs an admin function"
        subtitle="The `feedback` table is service-role only — wire a Supabase Edge Function to surface it here."
      >
        <span
          style={{
            fontSize: 10,
            padding: "4px 10px",
            borderRadius: 3,
            background: "var(--bg-elev-2)",
            color: "var(--text-dim)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Coming soon
        </span>
      </EmptyState>
    </Card>
  </div>
);
