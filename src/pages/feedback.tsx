import { useState } from "react";
import { Card, EmptyState } from "../components/card";
import { DEFAULT_PAGE_SIZE, Pagination } from "../components/pagination";
import { SelectChip } from "../components/select-chip";
import { Icons } from "../lib/icons";
import { formatRelative } from "../data/reviews";
import { setFeedbackResolved, useFeedback } from "../data/feedback";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  deviceLine,
  FEEDBACK_CATEGORIES,
  isInformational,
  VOTE_LABELS,
  type FeedbackCategoryFilter,
  type FeedbackItem,
  type FeedbackStatus,
} from "../data/feedback-report";

const COLUMNS = ["Received", "Category", "Message", "Contact", "Device", ""] as const;

const CategoryChip = ({ item }: { item: FeedbackItem }) => {
  const color = CATEGORY_COLORS[item.category];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        color,
        padding: "2px 8px",
        borderRadius: 4,
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      {CATEGORY_LABELS[item.category]}
    </span>
  );
};

/** A design vote's thumb: up in green, down in red, with its words for screen readers and a glance. */
const VoteChip = ({ vote }: { vote: NonNullable<FeedbackItem["vote"]> }) => {
  const color = vote === "up" ? "var(--green)" : "var(--red)";
  const Thumb = vote === "up" ? Icons.ThumbsUp : Icons.ThumbsDown;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color, fontWeight: 500, whiteSpace: "nowrap" }}>
      <Thumb size={14} />
      {VOTE_LABELS[vote]}
    </span>
  );
};

type StatProps = { label: string; value: number | string; hint?: string };

const Stat = ({ label, value, hint }: StatProps) => (
  <Card>
    <div style={{ fontSize: 11, color: "var(--text-dim)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
      {label}
    </div>
    <div className="num" style={{ fontSize: 26, fontWeight: 600, marginTop: 6, letterSpacing: "-0.02em" }}>
      {value}
    </div>
    {hint && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{hint}</div>}
  </Card>
);

const actionBtn = {
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "4px 10px",
  fontSize: 11,
  color: "var(--text-muted)",
  fontFamily: "inherit",
} as const;

type FeedbackRowProps = { item: FeedbackItem; onChanged: () => void };

const FeedbackRow = ({ item, onChanged }: FeedbackRowProps) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    setBusy(true);
    setError(null);
    const err = await setFeedbackResolved(item.id, !item.resolved);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    onChanged();
  };

  return (
    <>
      <tr style={{ borderBottom: error ? "none" : "1px solid var(--border)", opacity: item.resolved ? 0.6 : 1, verticalAlign: "top" }}>
        <td style={{ padding: "12px 16px", whiteSpace: "nowrap", color: "var(--text-muted)" }} title={new Date(item.createdAt).toLocaleString()}>
          {formatRelative(item.createdAt)}
        </td>
        <td style={{ padding: "12px 16px" }}>
          <CategoryChip item={item} />
        </td>
        <td style={{ padding: "12px 16px", minWidth: 260, maxWidth: 560 }}>
          {item.vote && (
            <div style={{ marginBottom: item.message ? 4 : 0 }}>
              <VoteChip vote={item.vote} />
            </div>
          )}
          {/* the driver's own words: keep their line breaks, never let a long word push the table */}
          {item.message ? (
            <div style={{ color: "var(--text)", whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.5 }}>
              {item.message}
            </div>
          ) : (
            isInformational(item) && <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>No comment</div>
          )}
          {isInformational(item) && !item.resolved && (
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6 }}>Informational: not counted as waiting</div>
          )}
          {item.resolved && (
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6 }}>
              Resolved{item.resolvedBy ? ` by ${item.resolvedBy}` : ""}
              {item.resolvedAt ? ` · ${formatRelative(item.resolvedAt)}` : ""}
            </div>
          )}
        </td>
        <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
          {item.email ? (
            <a href={`mailto:${item.email}`} style={{ color: "var(--accent)", textDecoration: "none" }}>
              {item.email}
            </a>
          ) : (
            <span style={{ color: "var(--text-dim)" }}>Anonymous</span>
          )}
        </td>
        <td style={{ padding: "12px 16px", whiteSpace: "nowrap", color: "var(--text-muted)" }} className="num">
          {deviceLine(item)}
        </td>
        <td style={{ padding: "12px 16px", textAlign: "end", whiteSpace: "nowrap" }}>
          <button onClick={() => void toggle()} disabled={busy} style={actionBtn}>
            {busy ? "…" : item.resolved ? "Reopen" : "Resolve"}
          </button>
        </td>
      </tr>
      {error && (
        <tr style={{ borderBottom: "1px solid var(--border)" }}>
          <td colSpan={COLUMNS.length} style={{ padding: "0 16px 12px", fontSize: 11, color: "var(--red)" }}>
            {error}
          </td>
        </tr>
      )}
    </>
  );
};

export const FeedbackPage = () => {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [status, setStatus] = useState<FeedbackStatus>("open");
  const [category, setCategory] = useState<FeedbackCategoryFilter>("all");
  const { data, summary, total, loading, error, refresh } = useFeedback(page, perPage, status, category);

  const emptyTitle =
    status === "open" ? "No open feedback" : status === "resolved" ? "Nothing resolved yet" : "No feedback yet";
  // Design votes inform, they ask for nothing: "Open" counts what waits for a look.
  const openVotes = summary.open - summary.openRequests;

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>Feedback</h1>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
          What drivers send from Réglages → Envoyer un avis: bugs, ideas, charger data fixes and compliments, plus
          the Lune design votes from the map card.
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
          Couldn't load feedback: {error}
        </div>
      )}

      <div className="kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
        <Stat
          label="Open"
          value={summary.openRequests}
          hint={openVotes > 0 ? `Waiting for a look · ${openVotes} design votes aside` : "Waiting for a look"}
        />
        <Stat label="Resolved" value={summary.resolved} hint="Handled" />
        <Stat label="Last 7 days" value={summary.last7Days} hint="Received" />
        <Stat label="Total" value={summary.total} hint="All time" />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <SelectChip
          label="Status"
          value={status}
          active={status !== "all"}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={[
            { v: "open", l: `Open (${summary.open})` },
            { v: "resolved", l: `Resolved (${summary.resolved})` },
            { v: "all", l: "All" },
          ]}
        />
        <SelectChip
          label="Category"
          value={category}
          active={category !== "all"}
          onChange={(v) => {
            setCategory(v);
            setPage(1);
          }}
          options={[
            { v: "all", l: "All" },
            { v: "requests", l: "Requests (no design votes)" },
            ...FEEDBACK_CATEGORIES.map((c) => ({ v: c, l: `${CATEGORY_LABELS[c]} (${summary.byCategory[c]})` })),
          ]}
        />
        <button onClick={refresh} disabled={loading} style={{ ...actionBtn, padding: "7px 12px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Icons.Sync size={12} />
            {loading ? "Refreshing…" : "Refresh"}
          </span>
        </button>
      </div>

      <Card padding={0}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {COLUMNS.map((h, i) => (
                  <th
                    key={h || `col-${i}`}
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
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                    {COLUMNS.map((__, j) => (
                      <td key={j} style={{ padding: "12px 16px" }}>
                        <div className="skeleton" style={{ height: 12, width: j === 2 ? "80%" : "45%" }} />
                      </td>
                    ))}
                  </tr>
                ))}
              {!loading && !error && data.map((item) => <FeedbackRow key={item.id} item={item} onChanged={refresh} />)}
            </tbody>
          </table>
          {!loading && !error && data.length === 0 && (
            <EmptyState
              title={emptyTitle}
              subtitle="When a driver sends feedback from the app, it lands here."
            />
          )}
        </div>
        {!error && total > 0 && (
          <Pagination
            page={page}
            perPage={perPage}
            total={total}
            onPageChange={setPage}
            onPerPageChange={(n) => {
              setPerPage(n);
              setPage(1);
            }}
            loading={loading}
          />
        )}
      </Card>
    </div>
  );
};
