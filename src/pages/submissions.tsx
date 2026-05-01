import { useMemo, useState } from "react";
import { Card, EmptyState } from "../components/card";
import { useSubmissions, type Submission, type SubmissionStatus } from "../data/submissions";

type Tab = "pending" | "review" | "approved" | "rejected";

// Map UI tabs to DB statuses. The submission_status enum only has
// pending | approved | rejected — no `under_review`. The "Under review"
// tab is kept in the UI for parity but will always show 0 today.
const TAB_TO_STATUS: Record<Tab, SubmissionStatus | null> = {
  pending: "pending",
  review: null,
  approved: "approved",
  rejected: "rejected",
};

const TAB_LABELS: { k: Tab; l: string }[] = [
  { k: "pending", l: "Pending" },
  { k: "review", l: "Under review" },
  { k: "approved", l: "Approved" },
  { k: "rejected", l: "Rejected" },
];

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

const truncate = (s: string, max = 120) =>
  s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;

const SubmissionCard = ({ s }: { s: Submission }) => (
  <Card padding={16}>
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
      }}
    >
      <span style={{ fontSize: 11, color: "var(--text-dim)" }} className="num">
        #{s.id.slice(0, 8)}
      </span>
      <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
        {fmtAgo(s.createdAt)}
      </span>
    </div>
    <div
      style={{ fontSize: 14, fontWeight: 500, color: "var(--text)", marginBottom: 4 }}
    >
      {s.name}
    </div>
    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
      by {s.submittedBy}
    </div>
    {s.notes ? (
      <div
        style={{
          fontSize: 12,
          color: "var(--text-muted)",
          marginTop: 8,
          lineHeight: 1.5,
        }}
      >
        {truncate(s.notes)}
      </div>
    ) : null}
    {s.status === "pending" ? (
      <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
        <button
          // TODO: needs service-role
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
          // TODO: needs service-role
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
      </div>
    ) : (
      <ResolvedStatusRow status={s.status} reviewedAt={s.reviewedAt} />
    )}
  </Card>
);

const ResolvedStatusRow = ({
  status,
  reviewedAt,
}: {
  status: "approved" | "rejected";
  reviewedAt: string | null;
}) => {
  const color = status === "approved" ? "var(--green)" : "var(--red)";
  const label = status === "approved" ? "Approved" : "Rejected";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginTop: 12,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          fontSize: 11,
          color,
          padding: "2px 8px",
          borderRadius: 4,
          background: `color-mix(in srgb, ${color} 12%, transparent)`,
        }}
      >
        <span
          style={{ width: 6, height: 6, borderRadius: "50%", background: color }}
        />
        {label}
      </span>
      {reviewedAt ? (
        <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
          {status === "approved" ? "approved" : "rejected"} {fmtAgo(reviewedAt)}
        </span>
      ) : null}
    </div>
  );
};

const SkeletonCard = () => (
  <Card padding={16}>
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
      }}
    >
      <div className="skeleton" style={{ height: 11, width: 60 }} />
      <div className="skeleton" style={{ height: 11, width: 70 }} />
    </div>
    <div className="skeleton" style={{ height: 14, width: "70%", marginBottom: 6 }} />
    <div className="skeleton" style={{ height: 12, width: "40%" }} />
    <div className="skeleton" style={{ height: 12, width: "90%", marginTop: 10 }} />
    <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
      <div className="skeleton" style={{ height: 24, flex: 1 }} />
      <div className="skeleton" style={{ height: 24, flex: 1 }} />
    </div>
  </Card>
);

export const SubmissionsPage = () => {
  const [tab, setTab] = useState<Tab>("pending");
  const { data: submissions, loading, error } = useSubmissions();

  const counts = useMemo<Record<Tab, number>>(() => {
    const c: Record<Tab, number> = {
      pending: 0,
      review: 0,
      approved: 0,
      rejected: 0,
    };
    for (const s of submissions) {
      if (s.status === "pending") c.pending += 1;
      else if (s.status === "approved") c.approved += 1;
      else if (s.status === "rejected") c.rejected += 1;
    }
    return c;
  }, [submissions]);

  const filtered = useMemo(() => {
    const target = TAB_TO_STATUS[tab];
    if (target === null) return [] as Submission[];
    return submissions.filter((s) => s.status === target);
  }, [submissions, tab]);

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>
          Submissions
        </h1>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
          {loading ? (
            <span style={{ color: "var(--text-dim)" }}>Loading…</span>
          ) : error ? (
            <span style={{ color: "var(--text-dim)" }}>{error}</span>
          ) : (
            <>
              <span className="num">{submissions.length}</span> total ·{" "}
              <span className="num">{counts.pending}</span> pending
            </>
          )}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--border)",
          overflowX: "auto",
          scrollbarWidth: "none",
        }}
      >
        {TAB_LABELS.map((t) => (
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
              whiteSpace: "nowrap",
              flexShrink: 0,
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
              {counts[t.k]}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div
          className="card-grid-260"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 12,
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card padding={0}>
          <EmptyState
            title={
              error
                ? "Couldn't load submissions"
                : submissions.length === 0
                  ? "No submissions yet"
                  : `No ${TAB_LABELS.find((t) => t.k === tab)?.l.toLowerCase()} submissions`
            }
            subtitle={
              error
                ? error
                : submissions.length === 0
                  ? "When users submit a new charger from the app, it'll show up here."
                  : "Switch tabs to see submissions in another state."
            }
          />
        </Card>
      ) : (
        <div
          className="card-grid-260"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 12,
          }}
        >
          {filtered.map((s) => (
            <SubmissionCard key={s.id} s={s} />
          ))}
        </div>
      )}
    </div>
  );
};
