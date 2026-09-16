import { useState } from "react";
import { Card, EmptyState } from "../components/card";
import { DEFAULT_PAGE_SIZE, Pagination } from "../components/pagination";
import { SelectChip } from "../components/select-chip";
import { Icons } from "../lib/icons";
import { formatRelative } from "../data/reviews";
import {
  formatVisitDate,
  moderateVisit,
  REASON_LABELS,
  useVisits,
  type Visit,
  type VisitOutcomeFilter,
  type VisitVisibility,
} from "../data/visits";

const MONO_FONT = "JetBrains Mono, ui-monospace, monospace";

const COLUMNS = [
  "Visit date",
  "Charger",
  "Outcome",
  "Connector",
  "Driver",
  "Reported",
  "",
] as const;

const OutcomeChip = ({ visit }: { visit: Visit }) => {
  const charged = visit.outcome === "charged";
  const color = charged ? "var(--green)" : "var(--red)";
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
      {charged ? "Charged" : "Couldn't charge"}
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

type VisitRowProps = {
  visit: Visit;
  onOpenDriver: (userId: string) => void;
  onModerated: () => void;
};

const VisitRow = ({ visit, onOpenDriver, onModerated }: VisitRowProps) => {
  // Hiding needs a reason (the RPC rejects a blank one), so the form expands
  // inline. Deliberately NOT window.prompt() — a modal dialog blocks the page.
  const [hiding, setHiding] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = async (hidden: boolean) => {
    setBusy(true);
    setError(null);
    const err = await moderateVisit(visit.id, hidden, reason.trim());
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setHiding(false);
    setReason("");
    onModerated();
  };

  const isHidden = Boolean(visit.hiddenAt);

  return (
    <>
      <tr style={{ borderBottom: error || hiding ? "none" : "1px solid var(--border)", opacity: isHidden ? 0.55 : 1 }}>
        <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }} className="num">
          {formatVisitDate(visit.visitDate)}
        </td>
        <td style={{ padding: "12px 16px", minWidth: 0 }}>
          <div style={{ fontWeight: 500, color: "var(--text)" }}>{visit.chargerName}</div>
          {visit.chargerCity && (
            <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{visit.chargerCity}</div>
          )}
        </td>
        <td style={{ padding: "12px 16px" }}>
          <OutcomeChip visit={visit} />
          {visit.reason && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              {REASON_LABELS[visit.reason] ?? visit.reason}
            </div>
          )}
        </td>
        <td style={{ padding: "12px 16px", color: visit.connectorType ? "var(--text)" : "var(--text-dim)" }}>
          {visit.connectorType ?? "—"}
        </td>
        <td style={{ padding: "12px 16px" }}>
          <button
            onClick={() => onOpenDriver(visit.userId)}
            title={`Open ${visit.userId} in Users`}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              fontFamily: MONO_FONT,
              fontSize: 12,
              color: "var(--accent)",
              cursor: "pointer",
            }}
          >
            {visit.userId.slice(0, 8)}…
          </button>
        </td>
        <td style={{ padding: "12px 16px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
          {formatRelative(visit.submittedAt)}
        </td>
        <td style={{ padding: "12px 16px", textAlign: "end", whiteSpace: "nowrap" }}>
          {isHidden ? (
            <button onClick={() => void apply(false)} disabled={busy} style={actionBtn}>
              {busy ? "…" : "Unhide"}
            </button>
          ) : (
            <button onClick={() => setHiding((v) => !v)} disabled={busy} style={actionBtn}>
              Hide
            </button>
          )}
        </td>
      </tr>

      {isHidden && visit.hiddenReason && !hiding && (
        <tr style={{ borderBottom: "1px solid var(--border)" }}>
          <td colSpan={COLUMNS.length} style={{ padding: "0 16px 12px", fontSize: 11, color: "var(--text-dim)" }}>
            Hidden: {visit.hiddenReason}
          </td>
        </tr>
      )}

      {hiding && (
        <tr style={{ borderBottom: "1px solid var(--border)" }}>
          <td colSpan={COLUMNS.length} style={{ padding: "0 16px 12px" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for hiding (required, 1–500 chars)"
                maxLength={500}
                style={{
                  flex: 1,
                  minWidth: 220,
                  height: 32,
                  paddingInline: 10,
                  background: "var(--bg-elev-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  color: "var(--text)",
                  fontFamily: "inherit",
                  fontSize: 12,
                  outline: "none",
                }}
              />
              <button
                onClick={() => void apply(true)}
                disabled={busy || reason.trim().length === 0}
                style={{
                  ...actionBtn,
                  borderColor: "var(--accent-border)",
                  color: reason.trim() ? "var(--accent)" : "var(--text-dim)",
                }}
              >
                {busy ? "Hiding…" : "Confirm"}
              </button>
              <button onClick={() => setHiding(false)} disabled={busy} style={actionBtn}>
                Cancel
              </button>
            </div>
          </td>
        </tr>
      )}

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

const actionBtn = {
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "4px 10px",
  fontSize: 11,
  color: "var(--text-muted)",
  fontFamily: "inherit",
} as const;

type VisitsPageProps = {
  onOpenDriver?: (userId: string) => void;
};

export const VisitsPage = ({ onOpenDriver }: VisitsPageProps = {}) => {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [outcome, setOutcome] = useState<VisitOutcomeFilter>("all");
  const [visibility, setVisibility] = useState<VisitVisibility>("visible");
  const { data, summary, total, loading, error, refresh } = useVisits(
    page,
    perPage,
    outcome,
    visibility,
  );

  const successRate =
    summary.charged + summary.couldNotCharge > 0
      ? `${((summary.charged / (summary.charged + summary.couldNotCharge)) * 100).toFixed(0)}%`
      : "—";

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>
          Driver visits
        </h1>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
          Charging confirmations drivers submit after visiting a station — whether they
          charged, and if not, why.
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
          Couldn't load visits: {error}
        </div>
      )}

      <div
        className="kpi-grid"
        style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 12 }}
      >
        <Stat label="Total reports" value={summary.total} hint="All time" />
        <Stat label="Charged" value={summary.charged} hint={`${successRate} success rate`} />
        <Stat label="Couldn't charge" value={summary.couldNotCharge} hint="Reported failures" />
        <Stat label="Last 7 days" value={summary.last7Days} hint="By visit date" />
        <Stat label="Drivers" value={summary.contributors} hint="Distinct reporters" />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <SelectChip
          label="Outcome"
          value={outcome}
          onChange={(v) => {
            setOutcome(v);
            setPage(1);
          }}
          options={[
            { v: "all", l: "All" },
            { v: "charged", l: "Charged" },
            { v: "could_not_charge", l: "Couldn't charge" },
          ]}
        />
        <SelectChip
          label="Visibility"
          value={visibility}
          onChange={(v) => {
            setVisibility(v);
            setPage(1);
          }}
          options={[
            { v: "visible", l: "Visible" },
            { v: "hidden", l: `Hidden (${summary.hidden})` },
            { v: "all", l: "All" },
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
                        <div className="skeleton" style={{ height: 12, width: j === 1 ? "70%" : "45%" }} />
                      </td>
                    ))}
                  </tr>
                ))}
              {!loading &&
                !error &&
                data.map((v) => (
                  <VisitRow
                    key={v.id}
                    visit={v}
                    onOpenDriver={(id) => onOpenDriver?.(id)}
                    onModerated={refresh}
                  />
                ))}
            </tbody>
          </table>
          {!loading && !error && data.length === 0 && (
            <EmptyState
              title="No visit reports yet"
              subtitle="When a driver confirms whether they charged at a station, the report lands here."
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

      <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5 }}>
        Reports are dated driver experiences — they do not change a charger's status or
        reliability on their own. The app shows only the last 5 visible reports from the
        past 30 days per charger; this page shows every report ever submitted. Hiding a
        report removes it from the app immediately.
      </div>
    </div>
  );
};
