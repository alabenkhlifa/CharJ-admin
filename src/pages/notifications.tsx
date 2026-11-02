import { useEffect, useState, type ReactNode } from "react";
import { AnnounceDialog } from "../components/announce-dialog";
import { formatRelative } from "../data/reviews";
import { cancelNotification, dismissSuggestion, useNotifications } from "../data/notifications";
import {
  DAILY_ANNOUNCEMENT_CAP,
  formatCountdown,
  formatTunisTime,
  governorateLabel,
  openRate,
  suggestionDiff,
  UPDATE_CLASS_LABELS,
  waitsForQuietHours,
  type NotificationBatch,
  type NotificationPeriod,
  type NotificationsOverview,
  type PendingNotification,
  type SuggestedUpdate,
} from "../data/notifications-report";
import { countOrPercentParts, plural } from "../lib/health-format";
import { buildHash } from "../lib/use-route";
import { Empty } from "../ui/empty";
import { HBars } from "../ui/hbars";
import { HealthCard } from "../ui/health-card";
import { LargeTitle } from "../ui/large-title";
import { Ladder } from "../ui/ladder";
import { Pager } from "../ui/pager";
import { Pill } from "../ui/pill";
import { Segmented } from "../ui/segmented";
import "./notifications.css";

// Region alerts admin (spec "Notifications · Settings": same content, the
// Health look). Pending digests / released announcements, update suggestions
// to announce, what went out, and who's listening. Everything comes from the
// admin-notifications Edge Function; pushes are templated, so there is no
// free-text field anywhere on this page.
//
// Colours (DESIGN.md "On Notifications"): the alerts themselves (pending,
// history) wear Screens Blue, the catalogue's colour, since every alert is
// news about a charger; suggestions wait for you, so Needs Orange; followers
// are people, Users Raspberry; the opt-in ask is Permission Rust.

type DialogTarget = { action: "announce" | "release"; id: string; chargerName: string; detail: string };

const nf = new Intl.NumberFormat("en-US");
const PER_PAGE = 10;

const useNow = (intervalMs: number) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
};

const Icon = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const ICON = {
  send: (
    <Icon>
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4z" />
    </Icon>
  ),
  megaphone: (
    <Icon>
      <path d="M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1z" />
      <path d="M17 9a3 3 0 0 1 0 6" />
    </Icon>
  ),
  history: (
    <Icon>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3 2" />
    </Icon>
  ),
  people: (
    <Icon>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
    </Icon>
  ),
  reach: (
    <Icon>
      <path d="M12 12h.01" />
      <path d="M8.5 15.5a5 5 0 0 1 0-7M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M5.6 18.4a9 9 0 0 1 0-12.8M18.4 5.6a9 9 0 0 1 0 12.8" />
    </Icon>
  ),
  check: (
    <Icon>
      <path d="M20 6 9 17l-5-5" />
    </Icon>
  ),
  clock: (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Icon>
  ),
  x: (
    <Icon>
      <path d="M6 6l12 12M6 18 18 6" />
    </Icon>
  ),
};

/** The charger's name; it opens the charger's drawer in Chargers. */
const ChargerName = ({ id, name }: { id: string; name: string }) => (
  <a className="notif-name" href={buildHash("chargers", { id })} title="Open in Chargers">
    <bdi>{name}</bdi>
  </a>
);

const kindLabel = (item: PendingNotification) =>
  item.kind === "charger_added"
    ? "New charger"
    : item.update_class
      ? UPDATE_CLASS_LABELS[item.update_class]
      : "Update";

/** A card's body while the overview loads or failed: no numbers. */
const Waiting = ({ error, onRetry }: { error: string | null; onRetry: () => void }) =>
  error ? (
    <p className="notif-retry" role="alert">
      Couldn't load. {error}{" "}
      <button type="button" onClick={onRetry}>
        Try again
      </button>
    </p>
  ) : (
    <div className="notif-wait" aria-busy="true">
      <Empty size="body">Loading…</Empty>
    </div>
  );

/** The empty state of a list card: what it means, then when it fills. */
const EmptyList = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="notif-empty">
    <Empty size="body">{title}</Empty>
    <Empty>{children}</Empty>
  </div>
);

// ── Pending ────────────────────────────────────────────────────────────────

type PendingRowProps = {
  item: PendingNotification;
  now: number;
  onSendNow: (target: DialogTarget) => void;
  onChanged: (message: string) => void;
};

const PendingRow = ({ item, now, onSendNow, onChanged }: PendingRowProps) => {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const quiet = waitsForQuietHours(item.eta);
  const canRelease = item.state === "held";
  const label = kindLabel(item);

  const cancel = async () => {
    setBusy(true);
    setError(null);
    const result = await cancelNotification(item.event_id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setConfirming(false);
    onChanged(`Cancelled the notification for ${item.charger_name}.`);
  };

  return (
    <li className="notif-item" data-testid="pending-item">
      <div className="notif-top">
        <ChargerName id={item.charger_id} name={item.charger_name} />
        <span className="notif-when">
          <strong>{formatCountdown(Date.parse(item.eta) - now)}</strong>≈ {formatTunisTime(item.eta, true)} Tunis
        </span>
      </div>
      <p className="notif-tags">
        <Pill>{label}</Pill>
        <Pill>{item.state === "held" ? "Held" : "Released"}</Pill>
        {item.needs_review && <span className="notif-flag">Needs review</span>}
      </p>
      <p className="notif-meta">
        {governorateLabel(item.governorate)} · queued {formatTunisTime(item.queued_at, true)}
        {item.requested_by ? " · released by an admin" : ""}
      </p>
      {item.needs_review && (
        <p className="notif-note">
          More than 15 events were waiting, so the dispatcher holds them for a human check. Send now releases this one.
        </p>
      )}
      {quiet && <p className="notif-note">Waits for quiet hours to end (08:00).</p>}
      <div className="notif-actions">
        <span title={canRelease ? "Skip the hold and send at the next dispatcher run" : "Already released. It goes out at the next dispatcher run."}>
          <button
            type="button"
            className="ui-btn ui-btn-primary"
            disabled={!canRelease || busy}
            onClick={() => onSendNow({ action: "release", id: item.event_id, chargerName: item.charger_name, detail: label })}
          >
            Send now
          </button>
        </span>
        <button type="button" className="ui-btn" disabled={busy} aria-expanded={confirming} onClick={() => setConfirming((v) => !v)}>
          Cancel
        </button>
      </div>
      {confirming && (
        <div className="notif-confirm" role="group" aria-label="Confirm cancel">
          <p>Cancel this notification? Nobody will get it, and it can't be re-queued.</p>
          <div className="notif-actions">
            <button type="button" className="ui-btn" disabled={busy} onClick={() => void cancel()}>
              {busy ? "Cancelling…" : "Yes, cancel it"}
            </button>
            <button type="button" className="ui-btn" disabled={busy} onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="ui-error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
};

// ── Suggested updates ──────────────────────────────────────────────────────

type SuggestionRowProps = {
  item: SuggestedUpdate;
  capReached: boolean;
  onAnnounce: (target: DialogTarget) => void;
  onChanged: (message: string) => void;
};

const SuggestionRow = ({ item, capReached, onAnnounce, onChanged }: SuggestionRowProps) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = UPDATE_CLASS_LABELS[item.update_class];

  const dismiss = async () => {
    setBusy(true);
    setError(null);
    const result = await dismissSuggestion(item.update_event_id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onChanged(`Dismissed the ${label.toLowerCase()} suggestion for ${item.charger_name}.`);
  };

  return (
    <li className="notif-item" data-testid="suggestion-item">
      <div className="notif-top">
        <ChargerName id={item.charger_id} name={item.charger_name} />
        <span className="notif-when" title="Followers of the governorate or of this charger, each counted once">
          <strong className="ui-num">{plural(item.recipient_estimate, "recipients")}</strong>
          {nf.format(item.push_estimate)} with push
        </span>
      </div>
      <p className="notif-tags">
        <Pill>{label}</Pill>
      </p>
      <p className="notif-meta">
        {governorateLabel(item.governorate)} · changed {formatRelative(item.occurred_at)}
      </p>
      <dl className="notif-diff">
        {suggestionDiff(item).map((line) => (
          <div key={line.field}>
            <dt>{line.field}</dt>
            <dd>
              <span className="before">{line.before}</span> → {line.after}
            </dd>
          </div>
        ))}
      </dl>
      <div className="notif-actions">
        <span title={capReached ? `Daily limit reached (${DAILY_ANNOUNCEMENT_CAP} announcements in 24 h)` : "Preview the copy, then announce"}>
          <button
            type="button"
            className="ui-btn ui-btn-primary"
            disabled={busy || capReached}
            onClick={() => onAnnounce({ action: "announce", id: item.update_event_id, chargerName: item.charger_name, detail: label })}
          >
            Announce
          </button>
        </span>
        <button type="button" className="ui-btn" disabled={busy} onClick={() => void dismiss()}>
          {busy ? "Dismissing…" : "Dismiss"}
        </button>
      </div>
      {error && (
        <p className="ui-error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
};

// ── History ────────────────────────────────────────────────────────────────

const OPEN_RATE_HINT = "A lower bound: people who turned analytics off are not counted as opens.";

/** "≥ 25%" from 10 recipients; "2 of 5" under 10 (no percentage of a handful); "—" when unknown. */
const OpenRate = ({ batch }: { batch: NotificationBatch }) => {
  const rate = openRate(batch);
  if (rate === null || batch.opens === null) return <>—</>;
  const { percent, counts } = countOrPercentParts(batch.opens, batch.recipient_count);
  return (
    <span className="notif-hint" title={`${OPEN_RATE_HINT} ${counts} recipients opened it.`}>
      {percent ? `≥ ${rate.toFixed(0)}%` : counts}
    </span>
  );
};

const batchWhen = (batch: NotificationBatch) => formatTunisTime(batch.sent_at ?? batch.claimed_at, true);
const batchErrors = (batch: NotificationBatch) => batch.ticket_error + batch.receipt_error;
const errorsTitle = (batch: NotificationBatch) => `${batch.ticket_error} ticket errors · ${batch.receipt_error} receipt errors`;

const HistoryRow = ({ batch }: { batch: NotificationBatch }) => {
  const errors = batchErrors(batch);
  return (
    <tr>
      <td>
        {batchWhen(batch)}
        {batch.status !== "sent" && <span className={batch.status === "failed" ? "notif-status notif-failed" : "notif-status"}>{batch.status}</span>}
      </td>
      <td>{batch.source === "admin" ? "Admin" : "Auto"}</td>
      <td className="ui-end">{nf.format(batch.event_count)}</td>
      <td className="ui-end">{nf.format(batch.recipient_count)}</td>
      <td className="ui-end">{nf.format(batch.device_count)}</td>
      <td className="ui-end">{nf.format(batch.ticket_ok)}</td>
      <td className="ui-end">{nf.format(batch.receipt_ok)}</td>
      <td className={errors ? "ui-end notif-failed" : "ui-end"} title={errorsTitle(batch)}>
        {nf.format(errors)}
      </td>
      <td className="ui-end">{batch.opens === null ? "—" : nf.format(batch.opens)}</td>
      <td className="ui-end">
        <OpenRate batch={batch} />
      </td>
    </tr>
  );
};

/** "10 opens (≥ 25%)", "2 of 5 opened" under 10 recipients; kept on one line. */
const OpensLine = ({ batch }: { batch: NotificationBatch }) => {
  if (batch.opens === null) return <span className="ui-nw">opens not known</span>;
  if (openRate(batch) === null) return <span className="ui-nw">{plural(batch.opens, "opens")}</span>;
  return batch.recipient_count >= 10 ? (
    <span className="ui-nw">
      {plural(batch.opens, "opens")} (<OpenRate batch={batch} />)
    </span>
  ) : (
    <span className="ui-nw notif-hint" title={OPEN_RATE_HINT}>
      {nf.format(batch.opens)} of {nf.format(batch.recipient_count)} opened
    </span>
  );
};

/** The same batch as a list row, for a page too narrow for ten columns. */
const HistoryItem = ({ batch }: { batch: NotificationBatch }) => {
  const errors = batchErrors(batch);
  return (
    <li className="notif-batch">
      <div className="notif-top">
        <span className="notif-batch-t">
          {batchWhen(batch)}
          {batch.status !== "sent" && <span className={batch.status === "failed" ? "notif-status notif-failed" : "notif-status"}>{batch.status}</span>}
        </span>
        <span className="notif-when">
          <strong className="ui-num">{plural(batch.recipient_count, "recipients")}</strong>
        </span>
      </div>
      <p className="notif-meta">
        {batch.source === "admin" ? "Admin" : "Auto"} · {plural(batch.event_count, "events")} · {plural(batch.device_count, "devices")}
      </p>
      <p className="notif-meta">
        {nf.format(batch.ticket_ok)} accepted · {nf.format(batch.receipt_ok)} receipts OK ·{" "}
        <span className={errors ? "notif-failed" : undefined} title={errorsTitle(batch)}>
          {plural(errors, "errors")}
        </span>{" "}
        · <OpensLine batch={batch} />
      </p>
    </li>
  );
};

const HistoryCard = ({ history, days, index }: { history: NotificationBatch[]; days: NotificationPeriod; index: number }) => {
  const [page, setPage] = useState({ days, at: 1 });
  // A new period starts on its first page.
  const at = page.days === days ? page.at : 1;
  const pages = Math.max(1, Math.ceil(history.length / PER_PAGE));
  const current = Math.min(at, pages);
  const rows = history.slice((current - 1) * PER_PAGE, current * PER_PAGE);
  return (
    <HealthCard title="History" color="screens" icon={ICON.history} meta={`${days} days`} index={index} wide>
      <p className="notif-lede">Dispatcher runs in the last {days} days. One row per batch; a batch can carry several events.</p>
      {history.length === 0 ? (
        <EmptyList title="Nothing sent yet">No notification went out in the last {days} days.</EmptyList>
      ) : (
        <>
          <div className="ui-table-wrap notif-history-table">
            <table className="ui-table notif-table">
              <caption className="ui-sr">Notification batches, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Date (Tunis)</th>
                  <th scope="col">Source</th>
                  <th scope="col" className="ui-end">Events</th>
                  <th scope="col" className="ui-end">Recipients</th>
                  <th scope="col" className="ui-end">Devices</th>
                  <th scope="col" className="ui-end">
                    <span className="notif-hint" title="Pushes Expo accepted (ticket OK)">Accepted</span>
                  </th>
                  <th scope="col" className="ui-end">
                    <span className="notif-hint" title="Delivery receipts that came back OK">Receipts OK</span>
                  </th>
                  <th scope="col" className="ui-end">Errors</th>
                  <th scope="col" className="ui-end">
                    <span className="notif-hint" title="Distinct people who opened it">Opens</span>
                  </th>
                  <th scope="col" className="ui-end">
                    <span className="notif-hint" title={OPEN_RATE_HINT}>Open rate</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((batch) => (
                  <HistoryRow key={batch.batch_id} batch={batch} />
                ))}
              </tbody>
            </table>
          </div>
          <ul className="notif-list notif-history-list" aria-label="Notification batches, newest first">
            {rows.map((batch) => (
              <HistoryItem key={batch.batch_id} batch={batch} />
            ))}
          </ul>
          {history.length > PER_PAGE && (
            <Pager page={current} perPage={PER_PAGE} total={history.length} onPage={(n) => setPage({ days, at: n })} label="History" />
          )}
        </>
      )}
    </HealthCard>
  );
};

// ── Followers ──────────────────────────────────────────────────────────────

const FUNNEL_STAGES = [
  { key: "region_prompt_shown", stage: "Map card shown" },
  { key: "region_prompt_accepted", stage: "Accepted" },
  { key: "permission_granted", stage: "Permission granted" },
  { key: "regions_updated", stage: "Regions saved" },
] as const;

const SubscribersCard = ({ data, index }: { data: NotificationsOverview; index: number }) => {
  const regions = data.subscribers
    .filter((s) => s.followers > 0)
    .sort((a, b) => b.followers - a.followers || a.governorate_code.localeCompare(b.governorate_code))
    .map((s) => {
      // With push is a subset of the followers: the two parts add up to them.
      const push = Math.min(s.followers_with_push, s.followers);
      return { name: governorateLabel({ ...s, code: s.governorate_code }), values: [push, s.followers - push] };
    });
  return (
    <HealthCard title="Subscribers by governorate" color="users" icon={ICON.people} meta="right now" index={index}>
      <p className="notif-lede">
        Users who follow each governorate. Picked regions always feed the inbox; push needs a device with notifications on.
      </p>
      {regions.length === 0 ? (
        <EmptyList title="No region followers yet">People pick governorates in the app (1.3.0+); they show up here.</EmptyList>
      ) : (
        <HBars
          rows={regions}
          series={[
            { name: "With push", tone: "users" },
            { name: "Inbox only", tone: "idle" },
          ]}
          label="Followers by governorate"
          labelHeader="Governorate"
        />
      )}
    </HealthCard>
  );
};

const ReachCard = ({ data, index }: { data: NotificationsOverview; index: number }) => {
  const t = data.totals;
  return (
    <HealthCard title="Reach" color="users" icon={ICON.reach} meta="right now" index={index}>
      <div className="notif-stats">
        {[
          { label: "Users following", value: t.region_followers },
          { label: "Region follows", value: t.region_follows },
          { label: "Users with push", value: t.users_with_push },
          { label: "Active devices", value: t.active_devices },
        ].map((s) => (
          <div key={s.label}>
            <b>{nf.format(s.value)}</b>
            <span>{s.label}</span>
          </div>
        ))}
      </div>
      <p className="notif-lede">Not limited to the period.</p>
    </HealthCard>
  );
};

const OptInCard = ({ data, days, index }: { data: NotificationsOverview; days: NotificationPeriod; index: number }) => {
  const funnel = data.funnel;
  return (
    <HealthCard title="Opt-in funnel" color="permissions" icon={ICON.check} meta={`${days} days`} index={index}>
      <p className="notif-lede">
        Distinct users per step, last {days} days. Each step is counted on its own, so a later step can be larger (e.g.
        regions picked from Settings).
      </p>
      {funnel ? (
        <Ladder tone="permissions" steps={FUNNEL_STAGES.map((s) => ({ name: s.stage, value: funnel[s.key] }))} />
      ) : (
        <Empty>Not tracked for this period.</Empty>
      )}
    </HealthCard>
  );
};

// ── Page ───────────────────────────────────────────────────────────────────

const PERIOD_OPTIONS: { v: NotificationPeriod; l: string }[] = [
  { v: 7, l: "7 days" },
  { v: 30, l: "30 days" },
  { v: 90, l: "90 days" },
];

export const NotificationsPage = () => {
  const [days, setDays] = useState<NotificationPeriod>(30);
  const { data, loading, error, refresh, skewMs } = useNotifications(days);
  const now = useNow(15_000) + skewMs;
  const [dialog, setDialog] = useState<DialogTarget | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const changed = (message: string) => {
    setNotice(message);
    refresh();
  };
  const capReached = (data?.totals.announcements_24h ?? 0) >= DAILY_ANNOUNCEMENT_CAP;

  return (
    <div className="notif">
      <LargeTitle title="Notifications" subtitle="Region alerts: new-charger digests and the updates you choose to announce." />

      <p className="notif-mode" role="note" aria-label="Mode">
        {ICON.clock}
        <span>
          The dispatcher sends whatever is due every 5 min. Quiet hours 22:00–08:00 (Africa/Tunis): anything due then waits
          until 08:00.
          {data?.totals.quiet_now && <Pill>Quiet hours now</Pill>}
        </span>
      </p>

      <div className="notif-controls">
        <Segmented label="History and opt-in period" value={days} options={PERIOD_OPTIONS} onChange={setDays} />
        <button type="button" className="ui-link notif-refresh" onClick={refresh} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {notice && (
        <p className="ui-notice notif-banner" role="status">
          <span>{notice}</span>
          <button type="button" className="notif-x" aria-label="Dismiss message" onClick={() => setNotice(null)}>
            {ICON.x}
          </button>
        </p>
      )}
      {error && data && (
        <p className="notif-retry" role="alert">
          Couldn't refresh: {error}{" "}
          <button type="button" onClick={refresh}>
            Try again
          </button>
        </p>
      )}

      <div className="notif-grid">
        <HealthCard
          title="Pending"
          color="screens"
          icon={ICON.send}
          meta={data ? `${nf.format(data.pending.length)} queued` : undefined}
          index={0}
        >
          <p className="notif-lede">
            New chargers wait 30 min after the latest add (at most 2 h) and go out as one digest per user. Released
            announcements go at the next run.
          </p>
          {!data ? (
            <Waiting error={error} onRetry={refresh} />
          ) : data.pending.length === 0 ? (
            <EmptyList title="Nothing pending">When you add a charger, its digest waits here for 30 minutes before it goes out.</EmptyList>
          ) : (
            <ul className="notif-list" aria-label="Pending notifications">
              {data.pending.map((item) => (
                <PendingRow key={item.event_id} item={item} now={now} onSendNow={setDialog} onChanged={changed} />
              ))}
            </ul>
          )}
        </HealthCard>

        <HealthCard
          title="Suggested updates"
          color="needs-you"
          icon={ICON.megaphone}
          meta={data ? `${nf.format(data.suggestions.length)} to review` : undefined}
          index={1}
        >
          <p className="notif-lede">
            Meaningful changes from the last 7 days. Nothing is sent unless you announce it.
            {data && (
              <>
                {" "}
                {nf.format(data.totals.announcements_24h)} of {DAILY_ANNOUNCEMENT_CAP} announcements used in the last 24 h; one
                per charger per 24 h.
              </>
            )}
          </p>
          {!data ? (
            <Waiting error={error} onRetry={refresh} />
          ) : data.suggestions.length === 0 ? (
            <EmptyList title="No updates to announce">
              Planned → operational, out of / back in service, more power or a new connector type show up here.
            </EmptyList>
          ) : (
            <ul className="notif-list" aria-label="Suggested updates">
              {data.suggestions.map((item) => (
                <SuggestionRow key={item.update_event_id} item={item} capReached={capReached} onAnnounce={setDialog} onChanged={changed} />
              ))}
            </ul>
          )}
        </HealthCard>

        {data ? (
          <>
            <HistoryCard history={data.history} days={days} index={2} />
            <div className="notif-pair">
              <SubscribersCard data={data} index={3} />
              <div className="notif-stack">
                <ReachCard data={data} index={4} />
                <OptInCard data={data} days={days} index={5} />
              </div>
            </div>
          </>
        ) : (
          <HealthCard title="History" color="screens" icon={ICON.history} meta={`${days} days`} index={2} wide>
            <Waiting error={error} onRetry={refresh} />
          </HealthCard>
        )}
      </div>

      {data && (
        <p className="notif-foot">
          Recipients are users; devices are their phones with push on. Accepted = pushes Expo took; receipts come back about
          15 minutes later. Opens count distinct users who tapped the push; users with analytics turned off are never counted,
          so the open rate is a lower bound. Server time {formatTunisTime(data.server_time, true)} Tunis.
        </p>
      )}

      {dialog && (
        <AnnounceDialog
          action={dialog.action}
          id={dialog.id}
          chargerName={dialog.chargerName}
          detail={dialog.detail}
          onClose={() => setDialog(null)}
          onDone={(message) => {
            setDialog(null);
            changed(message);
          }}
        />
      )}
    </div>
  );
};
