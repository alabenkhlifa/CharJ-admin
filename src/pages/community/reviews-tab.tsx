import { useState, type ReactNode } from "react";
import { useReviewReports, setReportResolved } from "../../data/review-reports";
import {
  REPORTS_PER_PAGE,
  type ReportStatus,
  type ReviewReport,
  type ReviewReportsPage,
} from "../../data/review-reports-report";
import { useReviews } from "../../data/reviews";
import type { RouteParams } from "../../lib/use-route";
import { Empty } from "../../ui/empty";
import { HealthCard } from "../../ui/health-card";
import { Pager } from "../../ui/pager";
import { Pill } from "../../ui/pill";
import { Segmented } from "../../ui/segmented";
import { ComIcon, LOADING, Note, RefreshButton, RetryLine, Waiting, When } from "./bits";
import { nf, useClampPage } from "./format";
import { Row } from "./row";
import type { CommunityView } from "./params";
import { useSaving } from "./use-saving";

// Reviews: reports drivers file against a review, open first, each with
// Resolve (admin-review-reports; nothing is hidden or deleted), and below
// them the latest reviews themselves (the old Reviews page, anon `ratings`).

type Props = {
  view: CommunityView["reviews"];
  onParams: (patch: RouteParams) => void;
  onChanged: () => void;
};

const STATUS_OPTIONS: { v: ReportStatus; l: string }[] = [
  { v: "open", l: "Open" },
  { v: "resolved", l: "Resolved" },
  { v: "all", l: "All" },
];

const REVIEWS_PER_PAGE = 10;

/** Five stars as text, the missing ones faint; the count is said in words. */
export const Stars = ({ n }: { n: number }) => (
  <span className="com-stars" role="img" aria-label={`${n} of 5 stars`}>
    {"★".repeat(n)}
    <i>{"★".repeat(Math.max(0, 5 - n))}</i>
  </span>
);

type RowProps = {
  report: ReviewReport;
  onFlip: (next: ReviewReport) => void;
  /** Wraps the POST so the card's Refresh waits for it (useSaving). */
  track: <T>(work: Promise<T>) => Promise<T>;
};

const ReportRow = ({ report, onFlip, track }: RowProps) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = async () => {
    setBusy(true);
    setError(null);
    const res = await track(setReportResolved(report.id, !report.resolved));
    setBusy(false);
    if (!res.ok) return setError(res.message);
    onFlip(res.item ?? { ...report, resolved: !report.resolved });
  };
  const r = report.review;
  return (
    <Row
      glyph={<ComIcon name="flag" />}
      tone={report.resolved ? null : "actions"}
      title={report.reasonLabel || "No reason"}
      when={report.createdAt}
      status={
        <>
          {r ? (
            <>
              A review of <bdi>{r.chargerName || "an unnamed charger"}</bdi>
            </>
          ) : (
            "The review no longer exists."
          )}
          {report.resolved && <Pill>Resolved</Pill>}
        </>
      }
      actions={
        <button type="button" className="ui-btn" onClick={() => void toggle()} disabled={busy}>
          {busy ? (report.resolved ? "Reopening…" : "Resolving…") : report.resolved ? "Reopen" : "Resolve"}
        </button>
      }
      after={
        error && (
          <p className="ui-error" role="alert">
            {error}
          </p>
        )
      }
    >
      {report.notes.trim() && (
        <p className="com-text">
          <bdi>{report.notes}</bdi>
        </p>
      )}
      {/* The reported review itself, quoted: what the admin decides on, without a click. */}
      {r && (
        <figure className="com-quote" aria-label="The reported review">
          <figcaption>
            <Stars n={r.stars} />
            <span>
              posted <When iso={r.createdAt} />
            </span>
          </figcaption>
          {r.comment.trim() ? (
            <p className="com-text">
              <bdi>{r.comment}</bdi>
            </p>
          ) : (
            <p className="com-aside">No comment, stars only.</p>
          )}
        </figure>
      )}
    </Row>
  );
};

const flipped = (data: ReviewReportsPage, before: ReviewReport, after: ReviewReport): ReviewReportsPage => ({
  ...data,
  items: data.items.map((i) => (i.id === after.id ? after : i)),
  open: before.resolved === after.resolved ? data.open : Math.max(0, data.open + (after.resolved ? -1 : 1)),
});

const ReportsCard = ({ view, onParams, onChanged }: Props) => {
  const { reports: status, page } = view;
  const reports = useReviewReports(status, page);
  const { saving, track } = useSaving();
  const data = reports.data;
  const past = useClampPage(page, data?.total ?? null, REPORTS_PER_PAGE, (n) => onParams({ page: n > 1 ? String(n) : null }));
  let body: ReactNode;
  if (reports.error) body = <RetryLine onRetry={reports.refresh}>Couldn't load review reports. {reports.error}</RetryLine>;
  else if (!data || past) body = <Waiting>{LOADING}</Waiting>;
  else if (!data.items.length)
    body = (
      <Empty size="body">
        {status === "open" ? "Nothing waiting." : status === "resolved" ? "Nothing resolved yet." : "No reports yet."} When a driver
        reports a review in the app, it lands here.
      </Empty>
    );
  else
    body = (
      <>
        <ul className="com-list" aria-label="Review reports">
          {data.items.map((r) => (
            <ReportRow
              key={r.id}
              report={r}
              track={track}
              onFlip={(next) => {
                reports.patch((d) => flipped(d, r, next));
                onChanged();
              }}
            />
          ))}
        </ul>
        {data.total > REPORTS_PER_PAGE && (
          <Pager
            label="Review reports"
            page={page}
            perPage={REPORTS_PER_PAGE}
            total={data.total}
            busy={reports.loading}
            onPage={(n) => onParams({ page: n > 1 ? String(n) : null })}
          />
        )}
      </>
    );
  return (
    <HealthCard
      title="Review reports"
      id="com-reports"
      color="actions"
      icon={<ComIcon name="flag" />}
      meta={data ? `${nf.format(data.open)} open` : undefined}
      index={0}
    >
      <div className="com-bar">
        <Segmented label="Reports" value={status} options={STATUS_OPTIONS} onChange={(v) => onParams({ reports: v === "open" ? null : v, page: null })} />
        <RefreshButton
          busy={reports.loading}
          saving={saving}
          onRefresh={() => {
            reports.refresh();
            onChanged();
          }}
        />
      </div>
      {body}
      <Note>Resolving marks the report handled. The review stays as it is: nothing is hidden or deleted from here.</Note>
    </HealthCard>
  );
};

const RecentReviewsCard = ({ page, onPage }: { page: number; onPage: (n: number) => void }) => {
  const reviews = useReviews();
  const data = reviews.data;
  const past = useClampPage(page, data ? data.length : null, REVIEWS_PER_PAGE, onPage);
  const at = Math.max(1, page);
  let body: ReactNode;
  if (reviews.error) body = <RetryLine onRetry={reviews.refresh}>Couldn't load reviews. {reviews.error}</RetryLine>;
  else if (!data || past) body = <Waiting>{LOADING}</Waiting>;
  else if (!data.length) body = <Empty size="body">No reviews yet. When a driver rates a charger, the review appears here.</Empty>;
  else
    body = (
      <>
        <ul className="com-list" aria-label="Recent reviews">
          {data.slice((at - 1) * REVIEWS_PER_PAGE, at * REVIEWS_PER_PAGE).map((r) => (
            <Row
              key={r.id}
              glyph={<ComIcon name="star" />}
              tone="contributions"
              title={<bdi>{r.chargerName}</bdi>}
              when={r.createdAt}
              status={<Stars n={r.rating} />}
              meta={`By ${r.raterShort}`}
            >
              {r.comment.trim() ? (
                <p className="com-text">
                  <bdi>{r.comment}</bdi>
                </p>
              ) : (
                <p className="com-aside">No comment, stars only.</p>
              )}
            </Row>
          ))}
        </ul>
        {data.length > REVIEWS_PER_PAGE && <Pager label="Reviews" page={at} perPage={REVIEWS_PER_PAGE} total={data.length} onPage={onPage} />}
      </>
    );
  return (
    <HealthCard
      title="Recent reviews"
      id="com-reviews"
      color="contributions"
      icon={<ComIcon name="star" />}
      meta={data ? `latest ${nf.format(data.length)}` : undefined}
      index={1}
    >
      <div className="com-bar">
        <RefreshButton busy={reviews.loading} onRefresh={reviews.refresh} />
      </div>
      {body}
    </HealthCard>
  );
};

export const ReviewsTab = (props: Props) => (
  <div className="com-grid com-grid-split">
    <ReportsCard {...props} />
    <RecentReviewsCard page={props.view.reviewsPage} onPage={(n) => props.onParams({ rpage: n > 1 ? String(n) : null })} />
  </div>
);
