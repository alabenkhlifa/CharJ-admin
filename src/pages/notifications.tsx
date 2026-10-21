import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AnnounceDialog } from "../components/announce-dialog";
import { Card, CardHeader, EmptyState } from "../components/card";
import { Funnel, HBarList } from "../components/charts";
import { Pagination, usePaginated } from "../components/pagination";
import { SelectChip } from "../components/select-chip";
import { Th } from "../components/table";
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
import { Icons } from "../lib/icons";
import "./notifications.css";

// Region alerts admin. Pending digests / released announcements, update
// suggestions to announce, what went out, and who's listening. Everything
// comes from the admin-notifications Edge Function; pushes are templated, so
// there is no free-text field anywhere on this page.

type DialogTarget = { action: "announce" | "release"; id: string; chargerName: string; detail: string };

const useNow = (intervalMs: number) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
};

const Chip = ({ color, children, title }: { color: string; children: ReactNode; title?: string }) => (
  <span
    className="notif-chip"
    title={title}
    style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
  >
    {children}
  </span>
);

const ChargerName = ({ id, name, onOpen }: { id: string; name: string; onOpen?: (id: string) => void }) =>
  onOpen ? (
    <button type="button" className="notif-name" title="Open in Chargers" onClick={() => onOpen(id)}>
      {name}
    </button>
  ) : (
    <span className="notif-name">{name}</span>
  );

const kindLabel = (item: PendingNotification) =>
  item.kind === "charger_added"
    ? "New charger"
    : item.update_class
      ? UPDATE_CLASS_LABELS[item.update_class]
      : "Update";

// ── Pending ────────────────────────────────────────────────────────────────

type PendingRowProps = {
  item: PendingNotification;
  now: number;
  onSendNow: (target: DialogTarget) => void;
  onChanged: (message: string) => void;
  onOpenCharger?: (id: string) => void;
};

const PendingRow = ({ item, now, onSendNow, onChanged, onOpenCharger }: PendingRowProps) => {
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
    <div className="notif-item" data-testid="pending-item">
      <div>
        <ChargerName id={item.charger_id} name={item.charger_name} onOpen={onOpenCharger} />
        <span className="notif-chips">
          <Chip color={item.kind === "charger_added" ? "var(--accent)" : "var(--violet)"}>{label}</Chip>
          <Chip color={item.state === "held" ? "var(--slate)" : "var(--blue)"}>
            {item.state === "held" ? "Held" : "Released"}
          </Chip>
          {item.needs_review && <Chip color="var(--amber)">Needs review</Chip>}
        </span>
        <div className="notif-meta">
          {governorateLabel(item.governorate)} · queued {formatTunisTime(item.queued_at, true)}
          {item.requested_by ? " · released by an admin" : ""}
        </div>
        {item.needs_review && (
          <div className="notif-note">
            More than 15 events were waiting, so the dispatcher holds them for a human check. Send now releases this one.
          </div>
        )}
      </div>
      <div className="notif-when">
        <strong>{formatCountdown(Date.parse(item.eta) - now)}</strong>
        ≈ {formatTunisTime(item.eta, true)} Tunis
        {quiet && <div className="notif-note">Waits for quiet hours to end (08:00).</div>}
      </div>
      <div className="notif-actions">
        <span title={canRelease ? "Skip the hold and send at the next dispatcher run" : "Already released. It goes out at the next dispatcher run."}>
          <button
            type="button"
            className="notif-btn primary"
            disabled={!canRelease || busy}
            onClick={() =>
              onSendNow({ action: "release", id: item.event_id, chargerName: item.charger_name, detail: label })
            }
          >
            Send now
          </button>
        </span>
        <button type="button" className="notif-btn" disabled={busy} onClick={() => setConfirming((v) => !v)}>
          Cancel
        </button>
      </div>
      {confirming && (
        <div className="notif-item-full notif-confirm" role="group" aria-label="Confirm cancel">
          <span>Cancel this notification? Nobody will get it, and it can't be re-queued.</span>
          <button type="button" className="notif-btn danger" disabled={busy} onClick={() => void cancel()}>
            {busy ? "Cancelling…" : "Yes, cancel it"}
          </button>
          <button type="button" className="notif-btn" disabled={busy} onClick={() => setConfirming(false)}>
            Keep it
          </button>
        </div>
      )}
      {error && <div className="notif-item-full notif-error" role="alert">{error}</div>}
    </div>
  );
};

// ── Suggested updates ──────────────────────────────────────────────────────

type SuggestionRowProps = {
  item: SuggestedUpdate;
  capReached: boolean;
  onAnnounce: (target: DialogTarget) => void;
  onChanged: (message: string) => void;
  onOpenCharger?: (id: string) => void;
};

const SuggestionRow = ({ item, capReached, onAnnounce, onChanged, onOpenCharger }: SuggestionRowProps) => {
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
    <div className="notif-item" data-testid="suggestion-item">
      <div>
        <ChargerName id={item.charger_id} name={item.charger_name} onOpen={onOpenCharger} />
        <span className="notif-chips">
          <Chip color="var(--violet)">{label}</Chip>
        </span>
        <div className="notif-meta">
          {governorateLabel(item.governorate)} · changed {formatRelative(item.occurred_at)}
        </div>
        <dl className="notif-diff">
          {suggestionDiff(item).map((line) => (
            <div key={line.field} style={{ display: "contents" }}>
              <dt>{line.field}</dt>
              <dd>
                <span className="before">{line.before}</span> → {line.after}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="notif-when" title="Followers of the governorate or of this charger, each counted once">
        <strong className="num">{item.recipient_estimate.toLocaleString()} recipients</strong>
        {item.push_estimate.toLocaleString()} with push
      </div>
      <div className="notif-actions">
        <span title={capReached ? `Daily limit reached (${DAILY_ANNOUNCEMENT_CAP} announcements in 24 h)` : "Preview the copy, then announce"}>
          <button
            type="button"
            className="notif-btn primary"
            disabled={busy || capReached}
            onClick={() =>
              onAnnounce({ action: "announce", id: item.update_event_id, chargerName: item.charger_name, detail: label })
            }
          >
            Announce
          </button>
        </span>
        <button type="button" className="notif-btn" disabled={busy} onClick={() => void dismiss()}>
          {busy ? "Dismissing…" : "Dismiss"}
        </button>
      </div>
      {error && <div className="notif-item-full notif-error" role="alert">{error}</div>}
    </div>
  );
};

// ── History ────────────────────────────────────────────────────────────────

const OPEN_RATE_HINT = "A lower bound: people who turned analytics off are not counted as opens.";

const HistoryRow = ({ batch }: { batch: NotificationBatch }) => {
  const rate = openRate(batch);
  const errors = batch.ticket_error + batch.receipt_error;
  return (
    <tr>
      <td>
        {formatTunisTime(batch.sent_at ?? batch.claimed_at, true)}
        {batch.status !== "sent" && (
          <span style={{ marginInlineStart: 6 }}>
            <Chip color={batch.status === "failed" ? "var(--red)" : "var(--amber)"}>{batch.status}</Chip>
          </span>
        )}
      </td>
      <td>
        <Chip color={batch.source === "admin" ? "var(--violet)" : "var(--slate)"}>
          {batch.source === "admin" ? "Admin" : "Auto"}
        </Chip>
      </td>
      <td className="end">{batch.event_count}</td>
      <td className="end">{batch.recipient_count.toLocaleString()}</td>
      <td className="end">{batch.device_count.toLocaleString()}</td>
      <td className="end">{batch.ticket_ok.toLocaleString()}</td>
      <td className="end">{batch.receipt_ok.toLocaleString()}</td>
      <td className="end" style={{ color: errors ? "var(--red)" : undefined }} title={`${batch.ticket_error} ticket errors · ${batch.receipt_error} receipt errors`}>
        {errors.toLocaleString()}
      </td>
      <td className="end">{batch.opens === null ? "—" : batch.opens.toLocaleString()}</td>
      <td className="end">
        {rate === null ? "—" : <span className="notif-hint" title={OPEN_RATE_HINT}>≥ {rate.toFixed(0)}%</span>}
      </td>
    </tr>
  );
};

const HistoryCard = ({ history, days }: { history: NotificationBatch[]; days: NotificationPeriod }) => {
  const { page, perPage, setPage, setPerPage, pageItems, total } = usePaginated(history, days, 10);
  return (
    <Card padding={0}>
      <div style={{ padding: "16px 16px 0" }}>
        <CardHeader
          title="History"
          subtitle={`Dispatcher runs in the last ${days} days. One row per batch; a batch can carry several events.`}
        />
      </div>
      {history.length === 0 ? (
        <EmptyState title="Nothing sent yet" subtitle={`No notification went out in the last ${days} days.`} />
      ) : (
        <>
          <div className="notif-table-scroll">
            <table className="notif-table">
              <thead>
                <tr>
                  <Th>Date (Tunis)</Th>
                  <Th>Source</Th>
                  <Th style={{ textAlign: "end" }}>Events</Th>
                  <Th style={{ textAlign: "end" }}>Recipients</Th>
                  <Th style={{ textAlign: "end" }}>Devices</Th>
                  <Th style={{ textAlign: "end" }}>
                    <span className="notif-hint" title="Pushes Expo accepted (ticket OK)">Accepted</span>
                  </Th>
                  <Th style={{ textAlign: "end" }}>
                    <span className="notif-hint" title="Delivery receipts that came back OK">Receipts OK</span>
                  </Th>
                  <Th style={{ textAlign: "end" }}>Errors</Th>
                  <Th style={{ textAlign: "end" }}>
                    <span className="notif-hint" title="Distinct people who opened it">Opens</span>
                  </Th>
                  <Th style={{ textAlign: "end" }}>
                    <span className="notif-hint" title={OPEN_RATE_HINT}>Open rate</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((batch) => (
                  <HistoryRow key={batch.batch_id} batch={batch} />
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} perPage={perPage} total={total} onPageChange={setPage} onPerPageChange={setPerPage} />
        </>
      )}
    </Card>
  );
};

// ── Subscribers ────────────────────────────────────────────────────────────

const FUNNEL_STAGES = [
  { key: "region_prompt_shown", stage: "Map card shown", color: "var(--accent)" },
  { key: "region_prompt_accepted", stage: "Accepted", color: "var(--blue)" },
  { key: "permission_granted", stage: "Permission granted", color: "var(--violet)" },
  { key: "regions_updated", stage: "Regions saved", color: "var(--green)" },
] as const;

const SubscribersCard = ({ data, days }: { data: NotificationsOverview; days: NotificationPeriod }) => {
  const regions = data.subscribers
    .filter((s) => s.followers > 0)
    .sort((a, b) => b.followers - a.followers || a.governorate_code.localeCompare(b.governorate_code))
    .map((s) => ({ name: governorateLabel({ ...s, code: s.governorate_code }), count: s.followers, op: s.followers_with_push }));
  const t = data.totals;
  const funnel = data.funnel;
  return (
    <div className="notif-subscribers">
      <Card>
        <CardHeader title="Subscribers by governorate" subtitle="Users who follow each governorate. Picked regions always feed the inbox; push needs a device with notifications on." />
        {regions.length === 0 ? (
          <EmptyState title="No region followers yet" subtitle="People pick governorates in the app (1.3.0+); they show up here." />
        ) : (
          <>
            <div className="notif-legend" aria-hidden="true">
              <span><i style={{ background: "var(--slate)" }} />Followers (inbox)</span>
              <span><i style={{ background: "var(--green)" }} />With push</span>
            </div>
            <HBarList data={regions} color="var(--slate)" showOp />
          </>
        )}
      </Card>
      <Card>
        <CardHeader title="Reach" subtitle="Right now, not limited to the period." />
        <div className="notif-totals">
          {[
            { label: "Users following", value: t.region_followers },
            { label: "Region follows", value: t.region_follows },
            { label: "Users with push", value: t.users_with_push },
            { label: "Active devices", value: t.active_devices },
          ].map((s) => (
            <div key={s.label} className="notif-total">
              <div>{s.label}</div>
              <div>{s.value.toLocaleString()}</div>
            </div>
          ))}
        </div>
        <CardHeader title="Opt-in funnel" subtitle={`Distinct users per step, last ${days} days. Each step is counted on its own, so a later step can be larger (e.g. regions picked from Settings).`} />
        {funnel && funnel.region_prompt_shown > 0 ? (
          <Funnel data={FUNNEL_STAGES.map((s) => ({ stage: s.stage, value: funnel[s.key], color: s.color }))} />
        ) : (
          <dl className="notif-stage-list">
            {FUNNEL_STAGES.map((s) => (
              <div key={s.key} style={{ display: "contents" }}>
                <dt>{s.stage}</dt>
                <dd className="num">{funnel ? funnel[s.key].toLocaleString() : "—"}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>
    </div>
  );
};

// ── Page ───────────────────────────────────────────────────────────────────

const PERIOD_OPTIONS: { v: `${NotificationPeriod}`; l: string }[] = [
  { v: "7", l: "Last 7 days" },
  { v: "30", l: "Last 30 days" },
  { v: "90", l: "Last 90 days" },
];

type NotificationsPageProps = { onOpenCharger?: (chargerId: string) => void };

export const NotificationsPage = ({ onOpenCharger }: NotificationsPageProps = {}) => {
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
    <section className="notif-page fade-in" aria-label="Notifications">
      <div className="notif-heading">
        <div>
          <h1>Notifications</h1>
          <p>Region alerts: new-charger digests and the updates you choose to announce.</p>
        </div>
        <div className="notif-controls">
          <SelectChip
            label="History"
            value={String(days) as `${NotificationPeriod}`}
            options={PERIOD_OPTIONS}
            onChange={(v) => setDays(Number(v) as NotificationPeriod)}
          />
          <button type="button" className="notif-btn" onClick={refresh} disabled={loading}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Icons.Sync size={12} />
              {loading ? "Refreshing…" : "Refresh"}
            </span>
          </button>
        </div>
      </div>

      <div className="notif-mode" role="note" aria-label="Mode">
        <span>
          <Icons.Clock size={13} />
          The dispatcher sends whatever is due every 5 min. Quiet hours 22:00–08:00 (Africa/Tunis): anything due then waits until 08:00.
        </span>
        {data?.totals.quiet_now && <Chip color="var(--amber)">Quiet hours now</Chip>}
      </div>

      {notice && (
        <div className="notif-banner ok" role="status">
          <span>{notice}</span>
          <button type="button" aria-label="Dismiss message" onClick={() => setNotice(null)}>
            <Icons.X size={13} />
          </button>
        </div>
      )}
      {error && (
        <div className="notif-banner error" role="alert">
          <span>{data ? `Couldn't refresh: ${error}` : `Couldn't load notifications: ${error}`}</span>
          <button type="button" className="notif-btn" onClick={refresh}>Try again</button>
        </div>
      )}

      {!data && loading && (
        <Card padding={0}>
          <div className="notif-skeleton" role="status" aria-label="Loading notifications">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 14, width: `${70 - i * 10}%` }} />
            ))}
          </div>
        </Card>
      )}

      {data && (
        <>
          <Card padding={0}>
            <div style={{ padding: "16px 16px 0" }}>
              <CardHeader
                title={`Pending · ${data.pending.length}`}
                subtitle="New chargers wait 30 min after the latest add (at most 2 h) and go out as one digest per user. Released announcements go at the next run."
              />
            </div>
            {data.pending.length === 0 ? (
              <EmptyState title="Nothing pending" subtitle="When you add a charger, its digest waits here for 30 minutes before it goes out." />
            ) : (
              <div className="notif-list">
                {data.pending.map((item) => (
                  <PendingRow
                    key={item.event_id}
                    item={item}
                    now={now}
                    onSendNow={setDialog}
                    onChanged={changed}
                    onOpenCharger={onOpenCharger}
                  />
                ))}
              </div>
            )}
          </Card>

          <Card padding={0}>
            <div style={{ padding: "16px 16px 0" }}>
              <CardHeader
                title={`Suggested updates · ${data.suggestions.length}`}
                subtitle={`Meaningful changes from the last 7 days. Nothing is sent unless you announce it. ${data.totals.announcements_24h} of ${DAILY_ANNOUNCEMENT_CAP} announcements used in the last 24 h; one per charger per 24 h.`}
              />
            </div>
            {data.suggestions.length === 0 ? (
              <EmptyState
                title="No updates to announce"
                subtitle="Planned → operational, out of / back in service, more power or a new connector type show up here."
              />
            ) : (
              <div className="notif-list">
                {data.suggestions.map((item) => (
                  <SuggestionRow
                    key={item.update_event_id}
                    item={item}
                    capReached={capReached}
                    onAnnounce={setDialog}
                    onChanged={changed}
                    onOpenCharger={onOpenCharger}
                  />
                ))}
              </div>
            )}
          </Card>

          <HistoryCard history={data.history} days={days} />

          <SubscribersCard data={data} days={days} />

          <p className="notif-footnote">
            Recipients are users; devices are their phones with push on. Accepted = pushes Expo took; receipts come back about
            15 minutes later. Opens count distinct users who tapped the push; users with analytics turned off are never counted,
            so the open rate is a lower bound. Server time {formatTunisTime(data.server_time, true)} Tunis.
          </p>
        </>
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
    </section>
  );
};
