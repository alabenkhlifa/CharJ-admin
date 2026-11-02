import { useState, type ReactNode } from "react";
import { moderateVisit, useVisits } from "../../data/visits";
import {
  flipVisit,
  formatVisitDate,
  REASON_LABELS,
  VISITS_PER_PAGE,
  type Visit,
  type VisitOutcomeFilter,
  type VisitVisibility,
} from "../../data/visits-report";
import { countOrPercent } from "../../lib/health-format";
import type { RouteParams } from "../../lib/use-route";
import { Empty } from "../../ui/empty";
import { HealthCard } from "../../ui/health-card";
import { Pager } from "../../ui/pager";
import { Pill } from "../../ui/pill";
import { Segmented } from "../../ui/segmented";
import { ComIcon, LOADING, Note, RefreshButton, RetryLine, Stats, Waiting, When } from "./bits";
import { nf, shortId, useClampPage } from "./format";
import type { CommunityView } from "./params";

// Driver visits: the "did you charge here?" reports drivers send after a
// visit (the old Driver visits page, admin-confirmations). Hide needs a
// reason and takes the report out of the app at once; unhide puts it back.
// A driver's short id opens them in Usage → Users.

type Props = {
  view: CommunityView["visits"];
  onParams: (patch: RouteParams) => void;
  onChanged: () => void;
  onOpenDriver: (userId: string) => void;
};

const OUTCOME_OPTIONS: { v: VisitOutcomeFilter; l: string }[] = [
  { v: "all", l: "All outcomes" },
  { v: "charged", l: "Charged" },
  { v: "could_not_charge", l: "Couldn't charge" },
];
const VISIBILITY_OPTIONS: { v: VisitVisibility; l: string }[] = [
  { v: "visible", l: "Visible" },
  { v: "hidden", l: "Hidden" },
  { v: "all", l: "All" },
];
const WINDOW_OPTIONS: { v: string; l: string }[] = [
  { v: "all", l: "All time" },
  { v: "7", l: "7 days" },
  { v: "30", l: "30 days" },
  { v: "90", l: "90 days" },
];

type RowProps = { visit: Visit; onOpenDriver: (id: string) => void; onFlip: (next: Visit) => void };

const VisitRow = ({ visit, onOpenDriver, onFlip }: RowProps) => {
  // Hiding needs a reason (the RPC refuses a blank one): the form opens inline.
  const [hiding, setHiding] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hidden = visit.hiddenAt !== null;
  const apply = async (hide: boolean) => {
    setBusy(true);
    setError(null);
    const why = reason.trim();
    const err = await moderateVisit(visit.id, hide, why);
    setBusy(false);
    if (err) return setError(err);
    setHiding(false);
    setReason("");
    onFlip({ ...visit, hiddenAt: hide ? new Date().toISOString() : null, hiddenReason: hide ? why : null });
  };
  const failed = visit.outcome === "could_not_charge";
  return (
    <li className="com-item">
      <div className="com-top">
        <h3 className="com-title">
          <bdi>{visit.chargerName}</bdi>
        </h3>
        <When iso={visit.submittedAt} />
      </div>
      <p className="com-meta">
        {visit.chargerCity && (
          <>
            <bdi>{visit.chargerCity}</bdi>
            {" · "}
          </>
        )}
        visited {formatVisitDate(visit.visitDate)}
      </p>
      <p className="com-tags">
        <span className={failed ? "com-vote com-failed" : "com-vote"}>{failed ? "Couldn't charge" : "Charged"}</span>
        {visit.reason && <span className="com-meta">{REASON_LABELS[visit.reason]}</span>}
        {visit.connectorType && <Pill>{visit.connectorType}</Pill>}
        {hidden && <Pill>Hidden</Pill>}
      </p>
      <p className="com-meta">
        Driver{" "}
        <button type="button" className="com-id" onClick={() => onOpenDriver(visit.userId)} title={`Open ${visit.userId} in Usage → Users`}>
          {shortId(visit.userId)}
        </button>
      </p>
      {hidden && visit.hiddenReason && (
        <p className="com-meta">
          Hidden: <bdi>{visit.hiddenReason}</bdi>
        </p>
      )}
      {hiding ? (
        <form
          className="com-form"
          onSubmit={(e) => {
            e.preventDefault();
            void apply(true);
          }}
        >
          <label className="com-field">
            Why hide it? (1–500 characters, kept with the report)
            <input className="com-input" dir="auto" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <div className="com-actions">
            <button type="submit" className="com-btn" disabled={busy || !reason.trim()}>
              {busy ? "Hiding…" : "Hide"}
            </button>
            <button type="button" className="com-btn" onClick={() => setHiding(false)} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="com-actions">
          {hidden ? (
            <button type="button" className="com-btn" onClick={() => void apply(false)} disabled={busy}>
              {busy ? "Unhiding…" : "Unhide"}
            </button>
          ) : (
            <button type="button" className="com-btn" onClick={() => setHiding(true)}>
              Hide…
            </button>
          )}
        </div>
      )}
      {error && (
        <p className="com-error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
};

export const VisitsTab = ({ view, onParams, onChanged, onOpenDriver }: Props) => {
  const visits = useVisits(view);
  const data = visits.data;
  const { page, since } = view;
  const past = useClampPage(page, data?.total ?? null, VISITS_PER_PAGE, (n) => onParams({ page: n > 1 ? String(n) : null }));

  let body: ReactNode;
  if (visits.error) body = <RetryLine onRetry={visits.refresh}>Couldn't load visits. {visits.error}</RetryLine>;
  else if (!data || past) body = <Waiting>{LOADING}</Waiting>;
  else if (!data.items.length)
    body = (
      <Empty size="body">
        No visit reports match{since ? ` in the last ${since} days` : ""}. When a driver says whether they charged at a station, the report
        lands here.
      </Empty>
    );
  else
    body = (
      <>
        <ul className="com-list" aria-label="Visit reports">
          {data.items.map((v) => (
            <VisitRow
              key={v.id}
              visit={v}
              onOpenDriver={onOpenDriver}
              onFlip={(next) => {
                visits.patch((d) => flipVisit(d, v, next));
                onChanged();
              }}
            />
          ))}
        </ul>
        {data.total > VISITS_PER_PAGE && (
          <Pager
            label="Visit reports"
            page={page}
            perPage={VISITS_PER_PAGE}
            total={data.total}
            busy={visits.loading}
            onPage={(n) => onParams({ page: n > 1 ? String(n) : null })}
          />
        )}
      </>
    );

  const s = data?.summary;
  const tried = s ? s.charged + s.couldNotCharge : 0;
  return (
    <div className="com-grid">
      <HealthCard
        title="Driver visits"
        id="com-visits"
        color="navigate"
        icon={<ComIcon name="pin" />}
        meta={s ? `${nf.format(s.total)} ${s.total === 1 ? "report" : "reports"}` : undefined}
        index={0}
      >
        {s && data && (
          <>
            <Stats
              items={[
                { value: s.total, label: "Reports, all time" },
                { value: s.couldNotCharge, label: "Couldn't charge", alarm: true },
                { value: s.last7Days, label: "Last 7 days" },
                { value: s.contributors, label: "Drivers" },
              ]}
            />
            <p className="com-meta">
              {tried ? `Visits that ended charged: ${countOrPercent(s.charged, tried)}.` : "No visit says whether it charged yet."}
              {s.hidden > 0 && ` ${nf.format(s.hidden)} hidden from the app.`}
              {data.windowCouldNotCharge !== null &&
                ` ${nf.format(data.windowCouldNotCharge)} couldn't charge in the last ${since} days (hidden ones left out).`}
            </p>
          </>
        )}
        <div className="com-bar">
          {/* A select: "Couldn't charge" needs more room than a third of a phone card. */}
          <label className="com-select">
            Outcome
            <select value={view.outcome} onChange={(e) => onParams({ outcome: e.target.value === "all" ? null : e.target.value, page: null })}>
              {OUTCOME_OPTIONS.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.l}
                </option>
              ))}
            </select>
          </label>
          <Segmented label="Shown in the app" value={view.visibility} options={VISIBILITY_OPTIONS} onChange={(v) => onParams({ visibility: v === "visible" ? null : v, page: null })} />
          <Segmented label="Visit date" value={since ? String(since) : "all"} options={WINDOW_OPTIONS} onChange={(v) => onParams({ since: v === "all" ? null : v, page: null })} />
          <RefreshButton
            busy={visits.loading}
            onRefresh={() => {
              visits.refresh();
              onChanged();
            }}
          />
        </div>
        {body}
        <Note>
          Reports are dated driver experiences: they don't change a charger's status on their own. The app shows a charger's last 5 visible
          reports from the past 30 days; this page has every report. Hiding takes a report out of the app at once.
        </Note>
      </HealthCard>
    </div>
  );
};
