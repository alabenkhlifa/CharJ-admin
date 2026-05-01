import { Card, CardHeader, EmptyState } from "../components/card";
import { Icons } from "../lib/icons";
import { formatRelative, useReviews } from "../data/reviews";
import type { Review } from "../data/reviews";

const StarRow = ({ stars }: { stars: number }) => (
  <div style={{ display: "flex", gap: 1 }}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Icons.Star
        key={n}
        size={11}
        style={{ color: n <= stars ? "var(--amber)" : "var(--border-strong)" }}
      />
    ))}
  </div>
);

const ReviewRow = ({ r }: { r: Review }) => (
  <div
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
        gap: 12,
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
        <span
          className="num"
          style={{
            fontSize: 12,
            fontWeight: 500,
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            color: "var(--text)",
          }}
        >
          {r.raterShort}
        </span>
        <span
          style={{
            fontSize: 11,
            color: "var(--text-dim)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={r.chargerName}
        >
          · {r.chargerName}
        </span>
      </div>
      <StarRow stars={r.rating} />
    </div>
    {r.comment ? (
      <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.55 }}>{r.comment}</div>
    ) : (
      <div
        style={{
          fontSize: 12,
          color: "var(--text-dim)",
          fontStyle: "italic",
          lineHeight: 1.55,
        }}
      >
        (no comment)
      </div>
    )}
    <div
      style={{
        marginTop: 8,
        fontSize: 10,
        color: "var(--text-dim)",
      }}
      className="num"
    >
      {formatRelative(r.createdAt)}
    </div>
  </div>
);

export const ReviewsPage = () => {
  const { data, loading, error } = useReviews();

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Reviews</h1>

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
          Failed to load reviews: {error}
        </div>
      )}

      <Card>
        <CardHeader
          title="Recent reviews"
          subtitle={
            loading
              ? "Loading…"
              : `Latest ${data.length} · all chargers`
          }
          periodSelector={false}
        />

        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                style={{
                  padding: 12,
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  background: "var(--bg-elev-2)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div className="skeleton" style={{ height: 12, width: "40%" }} />
                <div className="skeleton" style={{ height: 12, width: "85%" }} />
                <div className="skeleton" style={{ height: 10, width: "20%" }} />
              </div>
            ))}
          </div>
        )}

        {!loading && !error && data.length === 0 && (
          <EmptyState
            title="No reviews yet"
            subtitle="When users rate a charger, their review will appear here."
          />
        )}

        {!loading && data.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {data.map((r) => (
              <ReviewRow key={r.id} r={r} />
            ))}
          </div>
        )}

        <div
          style={{
            marginTop: 16,
            paddingTop: 12,
            borderTop: "1px dashed var(--border)",
            fontSize: 11,
            color: "var(--text-dim)",
            lineHeight: 1.5,
          }}
        >
          Moderation queue (hide / approve / report triage) requires an admin
          Edge Function with service-role access — not yet built. The
          `review_reports` table is service-role only and isn't readable from
          the anon client.
        </div>
      </Card>
    </div>
  );
};
