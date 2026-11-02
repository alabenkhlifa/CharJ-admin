import { useState, type ReactNode } from "react";
import type { AdminLoad } from "../../data/admin-load";
import { setFeedbackResolved, useDesignVotes, useFeedback } from "../../data/feedback";
import {
  CATEGORY_LABELS,
  deviceLine,
  FEEDBACK_CATEGORIES,
  FEEDBACK_PER_PAGE,
  isInformational,
  requestStats,
  statusCounts,
  VOTE_LABELS,
  type DesignTally,
  type FeedbackItem,
  type FeedbackResponse,
  type FeedbackStatus,
} from "../../data/feedback-report";
import { countOrPercent } from "../../lib/health-format";
import type { RouteParams } from "../../lib/use-route";
import { Empty } from "../../ui/empty";
import { HealthCard } from "../../ui/health-card";
import { Pager } from "../../ui/pager";
import { ComIcon, LOADING, Note, RefreshButton, RetryLine, Stats, Thumb, Waiting, type ComIconName } from "./bits";
import { Dots, Row } from "./row";
import { useSaving } from "./use-saving";
import { ago, nf, useClampPage, useNow } from "./format";
import type { CommunityView } from "./params";

// Feedback: what drivers send from Réglages → Envoyer un avis (the old
// Feedback page), plus the Lune design votes from the map card. Votes are
// informational: they never wait, so they stay out of Open, the badge and
// Needs you, and get their own tally card instead.

type Props = {
  view: CommunityView["feedback"];
  onParams: (patch: RouteParams) => void;
  onChanged: () => void;
};

type CardProps = Props & { votes: AdminLoad<DesignTally> };

const STATUS_OPTIONS: { v: FeedbackStatus; l: string }[] = [
  { v: "open", l: "Open" },
  { v: "resolved", l: "Resolved" },
  { v: "all", l: "All" },
];

/** The tile glyph for each kind of feedback (a design vote shows its thumb instead). */
const CATEGORY_GLYPH: Record<FeedbackItem["category"], ComIconName> = {
  bug: "bug",
  suggestion: "bulb",
  compliment: "heart",
  charger_data: "pin",
  other: "chat",
  design: "thumb",
};

const PLATFORM: Record<string, string> = { ios: "iOS", android: "Android" };
const platformName = (p: string) => PLATFORM[p] ?? p;

const Vote = ({ vote }: { vote: NonNullable<FeedbackItem["vote"]> }) => (
  <span className="com-vote">
    <Thumb up={vote === "up"} />
    {VOTE_LABELS[vote]}
  </span>
);

type RowProps = {
  item: FeedbackItem;
  onFlip: (next: FeedbackItem) => void;
  /** Wraps the POST so the card's Refresh waits for it (useSaving). */
  track: <T>(work: Promise<T>) => Promise<T>;
};

const FeedbackRow = ({ item, onFlip, track }: RowProps) => {
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = async () => {
    setBusy(true);
    setError(null);
    const res = await track(setFeedbackResolved(item.id, !item.resolved));
    setBusy(false);
    if (!res.ok) return setError(res.message);
    // The server's row when it sent one; else the change it confirmed.
    onFlip(res.item ?? { ...item, resolved: !item.resolved, resolvedAt: item.resolved ? null : new Date().toISOString(), resolvedBy: null });
  };
  const informational = isInformational(item);
  const status: ReactNode[] = [
    item.vote && <Vote vote={item.vote} />,
    item.resolved && (item.resolvedBy ? `Resolved by ${item.resolvedBy}` : "Resolved"),
    item.resolved && item.resolvedAt && ago(item.resolvedAt, now),
    informational && !item.resolved && "Informational: not counted as waiting.",
  ];
  return (
    <Row
      glyph={item.vote ? <Thumb up={item.vote === "up"} size={20} /> : <ComIcon name={CATEGORY_GLYPH[item.category]} />}
      tone={item.resolved ? null : informational ? "design" : "needs-you"}
      title={CATEGORY_LABELS[item.category]}
      when={item.createdAt}
      status={status.some(Boolean) && <Dots parts={status} />}
      meta={
        <>
          {item.email ? (
            <a href={`mailto:${item.email}`}>
              <bdi>{item.email}</bdi>
            </a>
          ) : (
            "Anonymous"
          )}
          {" · "}
          {deviceLine(item)}
        </>
      }
      actions={
        <button type="button" className="ui-btn" onClick={() => void toggle()} disabled={busy}>
          {busy ? (item.resolved ? "Reopening…" : "Resolving…") : item.resolved ? "Reopen" : "Resolve"}
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
      {item.message.trim() ? (
        <p className="com-text">
          <bdi>{item.message}</bdi>
        </p>
      ) : (
        <p className="com-aside">{informational ? "No comment" : "No message"}</p>
      )}
    </Row>
  );
};

/** Counts after a confirmed flip, so the stats don't wait for a reload. */
const flipCounts = (data: FeedbackResponse, before: FeedbackItem, after: FeedbackItem): FeedbackResponse => {
  if (before.resolved === after.resolved) return data;
  const d = after.resolved ? -1 : 1;
  const s = data.summary;
  return {
    ...data,
    items: data.items.map((i) => (i.id === after.id ? after : i)),
    summary: {
      ...s,
      open: s.open + d,
      resolved: s.resolved - d,
      openRequests: s.openRequests === null || isInformational(after) ? s.openRequests : s.openRequests + d,
    },
  };
};

const FILTER_LABEL: Record<"requests" | "all", string> = { requests: "Requests (no design votes)", all: "All, with design votes" };

const withCount = (label: string, n: number | null | undefined) => (n == null ? label : `${label} (${nf.format(n)})`);

const FeedbackCard = ({ view, onParams, onChanged, votes }: CardProps) => {
  const { status, category, page } = view;
  const now = useNow();
  const feedback = useFeedback(status, category, page);
  const data = feedback.data;
  const past = useClampPage(page, data?.total ?? null, FEEDBACK_PER_PAGE, (n) => onParams({ page: n > 1 ? String(n) : null }));
  const byCategory = data?.summary.byCategory;
  const { saving, track } = useSaving();

  let body: ReactNode;
  if (feedback.error) {
    body = (
      <RetryLine
        onRetry={feedback.refresh}
        more={
          category === "requests" && (
            <button type="button" className="com-retry-more" onClick={() => onParams({ category: "all", page: null })}>
              Show all
            </button>
          )
        }
      >
        Couldn't load feedback. {feedback.error}
        {category === "requests" && " Requests needs the updated admin-feedback function; All works meanwhile."}
      </RetryLine>
    );
  } else if (!data || past) {
    body = <Waiting>{LOADING}</Waiting>;
  } else if (!data.items.length) {
    body = (
      <Empty size="body">
        {status === "open" ? "Nothing waiting." : status === "resolved" ? "Nothing resolved yet." : "No feedback yet."} When a driver sends
        feedback from the app, it lands here.
      </Empty>
    );
  } else {
    body = (
      <>
        <ul className="com-list" aria-label="Feedback">
          {data.items.map((item) => (
            <FeedbackRow
              key={item.id}
              item={item}
              track={track}
              onFlip={(next) => {
                feedback.patch((d) => flipCounts(d, item, next));
                onChanged();
              }}
            />
          ))}
        </ul>
        {data.total > FEEDBACK_PER_PAGE && (
          <Pager
            label="Feedback"
            page={page}
            perPage={FEEDBACK_PER_PAGE}
            total={data.total}
            busy={feedback.loading}
            onPage={(n) => onParams({ page: n > 1 ? String(n) : null })}
          />
        )}
      </>
    );
  }

  const s = data?.summary;
  // Requests only: the design votes never wait, so no stat counts them.
  const stats = s ? requestStats(s, votes.data, now) : null;
  const counts = s && stats ? statusCounts(s, stats, category) : null;
  const statusOptions = STATUS_OPTIONS.map((o) =>
    o.v === "all" ? o : { ...o, l: withCount(o.l, o.v === "open" ? counts?.open : counts?.resolved) },
  );
  return (
    <HealthCard
      title="Feedback"
      id="com-feedback"
      color="needs-you"
      icon={<ComIcon name="bell" />}
      meta={stats && stats.open !== null ? `${nf.format(stats.open)} open` : undefined}
      index={0}
    >
      {s && stats && (
        <Stats
          items={[
            { value: stats.open, label: "Open requests" },
            { value: stats.resolved, label: "Resolved" },
            stats.last7 !== null
              ? { value: stats.last7, label: "Received, 7 days" }
              : { value: s.last7Days, label: "Received, 7 days, votes included" },
            { value: stats.total, label: "Received, all time" },
          ]}
        />
      )}
      {s && s.openRequests === null && <Note>Open requests need the updated admin-feedback function, so they aren't counted here yet.</Note>}
      <div className="com-bar">
        {/* A select, as on the old page: "Resolved (123)" doesn't fit a third of a phone card. */}
        <label className="com-select">
          Status
          <select value={status} onChange={(e) => onParams({ status: e.target.value === "open" ? null : e.target.value, page: null })}>
            {statusOptions.map((o) => (
              <option key={o.v} value={o.v}>
                {o.l}
              </option>
            ))}
          </select>
        </label>
        <label className="com-select">
          Show
          <select
            value={category}
            onChange={(e) => onParams({ category: e.target.value === "requests" ? null : e.target.value, page: null })}
          >
            {(["requests", "all"] as const).map((v) => (
              <option key={v} value={v}>
                {FILTER_LABEL[v]}
              </option>
            ))}
            {FEEDBACK_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
                {byCategory ? ` (${nf.format(byCategory[c])})` : ""}
              </option>
            ))}
          </select>
        </label>
        <RefreshButton
          busy={feedback.loading}
          saving={saving}
          onRefresh={() => {
            feedback.refresh();
            votes.refresh();
            onChanged();
          }}
        />
      </div>
      {body}
    </HealthCard>
  );
};

/** The Lune design card's thumbs: a tally, not a queue. Shares only from 10 votes. */
const DesignVotesCard = ({ votes }: { votes: AdminLoad<DesignTally> }) => {
  const t = votes.data;
  let body: ReactNode;
  if (votes.error) body = <RetryLine onRetry={votes.refresh}>Couldn't load the design votes. {votes.error}</RetryLine>;
  else if (!t) body = <Waiting>{LOADING}</Waiting>;
  else if (!t.votes) body = <Empty size="body">No design votes yet. They come from the Lune design card on the map.</Empty>;
  else
    body = (
      <>
        <div className="com-stats com-stats-2">
          <div>
            <b>{nf.format(t.up)}</b>
            <span className="com-vote">
              <Thumb up size={14} /> {VOTE_LABELS.up}
            </span>
          </div>
          <div>
            <b>{nf.format(t.down)}</b>
            <span className="com-vote">
              <Thumb up={false} size={14} /> {VOTE_LABELS.down}
            </span>
          </div>
        </div>
        <p className="com-meta" data-testid="vote-share">
          {t.votes >= 10
            ? `${countOrPercent(t.up, t.votes)} like it.`
            : `${nf.format(t.up)} of ${nf.format(t.votes)} like it. Counts only: under 10 votes is too few for a share.`}
          {t.total > t.votes && ` From the newest ${nf.format(t.votes)} of ${nf.format(t.total)} votes.`}
        </p>
        {t.platforms && (
          <ul className="com-near-list" aria-label="Votes by platform">
            {t.platforms.map((p) => (
              <li key={p.platform}>
                <span className="com-vote">{platformName(p.platform)}</span>
                <span>
                  {nf.format(p.up)} like · {nf.format(p.down)} don't
                </span>
              </li>
            ))}
          </ul>
        )}
        <h3 className="com-sub">Latest comments</h3>
        {t.comments.length ? (
          <ul className="com-list" aria-label="Latest comments">
            {t.comments.map((c) => (
              <Row
                key={c.id}
                glyph={c.vote ? <Thumb up={c.vote === "up"} size={20} /> : <ComIcon name="chat" />}
                tone="design"
                title={c.vote ? VOTE_LABELS[c.vote] : "Comment"}
                when={c.createdAt}
                meta={[c.platform && platformName(c.platform), c.appVersion, c.locale].filter(Boolean).join(" · ") || undefined}
              >
                <p className="com-text">
                  <bdi>{c.message}</bdi>
                </p>
              </Row>
            ))}
          </ul>
        ) : (
          <Empty>No comments yet: every vote so far is a thumb only.</Empty>
        )}
      </>
    );
  return (
    <HealthCard
      title="Design votes"
      id="com-votes"
      color="design"
      icon={<ComIcon name="thumb" />}
      meta={t && t.votes ? `${nf.format(t.votes)} ${t.votes === 1 ? "vote" : "votes"}` : undefined}
      index={1}
    >
      {body}
      <Note>Votes on the Lune design are informational: they never wait, so Open, Needs you and the badge leave them out.</Note>
    </HealthCard>
  );
};

export const FeedbackTab = (props: Props) => {
  // Read once for both cards: the tally, and the votes' dates for an exact 7-day count of requests.
  const votes = useDesignVotes();
  return (
    <div className="com-grid com-grid-split">
      <FeedbackCard {...props} votes={votes} />
      <DesignVotesCard votes={votes} />
    </div>
  );
};
