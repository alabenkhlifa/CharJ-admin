// Wire types + strict parsers for the `admin-notifications` Edge Function
// (../charj/supabase/functions/admin-notifications). GET returns the
// `admin_notification_overview` RPC as is; POST `preview` returns rendered
// copy. Field names stay snake_case, as on the wire.
//
// Pure module (no imports at runtime) so `node --test` can load it directly.

export type NotificationPeriod = 7 | 30 | 90;
export type UpdateClass =
  | 'planned_to_operational' | 'out_of_service' | 'back_in_service' | 'power_upgrade' | 'new_connector';
export type NotificationKind = 'charger_added' | 'charger_updated';
export type PendingState = 'held' | 'released';
export type QueueReason = 'new_charger' | 'update';
export type BatchSource = 'auto' | 'admin';
export type BatchStatus = 'claimed' | 'sending' | 'sent' | 'failed';
export type PreviewLanguage = 'fr' | 'ar' | 'en';

export interface GovernorateRef {
  code: string | null;
  name_fr: string | null;
  name_ar: string | null;
  name_en: string | null;
}

export interface PendingNotification {
  event_id: string;
  kind: NotificationKind;
  update_class: UpdateClass | null;
  reason: QueueReason;
  state: PendingState;
  note: string | null;
  // The dispatcher refused to send a run of more than 15 events.
  needs_review: boolean;
  charger_id: string;
  charger_name: string;
  governorate: GovernorateRef;
  queued_at: string;
  release_at: string;
  requested_by: string | null;
  // When it goes out: debounce for held digests, the next run for released
  // rows, already moved past quiet hours by the server.
  eta: string;
}

export interface ConnectorValue { type: string; power_kw: number | null; count: number | null }

// One side of a `charger_update_events` diff. Only the changed fields are
// present. These are free-form JSONB snapshots of charger columns, so the
// parser is lenient inside them (display only); everything else is strict.
export interface ChargerSnapshot {
  status?: string | null;
  access_type?: string | null;
  connectors?: ConnectorValue[] | null;
  working_hours?: unknown;
}

export interface SuggestedUpdate {
  update_event_id: string;
  charger_id: string;
  charger_name: string;
  update_class: UpdateClass;
  occurred_at: string;
  changed_fields: string[];
  before: ChargerSnapshot;
  after: ChargerSnapshot;
  governorate: GovernorateRef;
  recipient_estimate: number;
  push_estimate: number;
}

export interface NotificationBatch {
  batch_id: string;
  source: BatchSource;
  status: BatchStatus;
  claimed_at: string;
  sent_at: string | null;
  recipient_count: number;
  device_count: number;
  ticket_ok: number;
  ticket_error: number;
  receipt_ok: number;
  receipt_error: number;
  // Distinct users who opened it (analytics opt-outs are not counted).
  opens: number | null;
  event_count: number;
}

export interface RegionSubscribers {
  governorate_code: string;
  name_fr: string | null;
  name_ar: string | null;
  name_en: string | null;
  followers: number;
  followers_with_push: number;
}

export interface NotificationTotals {
  region_followers: number;
  region_follows: number;
  active_devices: number;
  users_with_push: number;
  pending: number;
  suggestions: number;
  batches: number;
  announcements_24h: number;
  quiet_now: boolean;
}

// Distinct users per step over the period. Each step is counted on its own
// (not conditional on the previous one), so a later step can exceed an
// earlier one, e.g. regions picked from Settings without the map card.
export interface NotificationFunnel {
  region_prompt_shown: number;
  region_prompt_accepted: number;
  permission_granted: number;
  regions_updated: number;
}

export interface NotificationsOverview {
  pending: PendingNotification[];
  suggestions: SuggestedUpdate[];
  history: NotificationBatch[];
  subscribers: RegionSubscribers[];
  totals: NotificationTotals;
  funnel: NotificationFunnel | null;
  server_time: string;
  // Set when the request was narrowed with ?charger_id=.
  charger_id: string | null;
}

export interface NotificationPreview {
  kind: NotificationKind;
  update_class: UpdateClass | null;
  charger_id: string;
  url: string;
  previews: Partial<Record<PreviewLanguage, { title: string; body: string }>>;
  recipient_estimate: number;
  push_estimate: number;
  // region | region_only_lower_bound | region_and_charger
  estimate_scope: string;
}

// ── Parsing ────────────────────────────────────────────────────────────────

type Raw = Record<string, unknown>;

const fail = (path: string): never => {
  throw new Error(`Invalid notifications response (${path})`);
};
const object = (value: unknown, path: string): Raw =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : fail(path);
const text = (value: unknown, path: string): string => (typeof value === 'string' ? value : fail(path));
const optionalText = (value: unknown, path: string): string | null =>
  value === null || value === undefined ? null : text(value, path);
const date = (value: unknown, path: string): string => {
  const result = text(value, path);
  return Number.isFinite(Date.parse(result)) ? result : fail(path);
};
const optionalDate = (value: unknown, path: string): string | null =>
  value === null || value === undefined ? null : date(value, path);
const count = (value: unknown, path: string): number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : fail(path);
const oneOf = <T extends string>(value: unknown, options: readonly T[], path: string): T =>
  typeof value === 'string' && (options as readonly string[]).includes(value) ? (value as T) : fail(path);
const rows = <T>(value: unknown, path: string, map: (row: Raw, path: string) => T): T[] =>
  Array.isArray(value) ? value.map((row: unknown, i) => map(object(row, `${path}[${i}]`), `${path}[${i}]`)) : fail(path);

const UPDATE_CLASSES = ['planned_to_operational', 'out_of_service', 'back_in_service', 'power_upgrade', 'new_connector'] as const;
const KINDS = ['charger_added', 'charger_updated'] as const;

const governorate = (row: Raw, path: string): GovernorateRef => ({
  code: optionalText(row.governorate_code, `${path}.governorate_code`),
  name_fr: optionalText(row.governorate_name_fr, `${path}.governorate_name_fr`),
  name_ar: optionalText(row.governorate_name_ar, `${path}.governorate_name_ar`),
  name_en: optionalText(row.governorate_name_en, `${path}.governorate_name_en`),
});

const finite = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

const snapshot = (value: unknown, path: string): ChargerSnapshot => {
  const raw = object(value, path);
  const result: ChargerSnapshot = {};
  if ('status' in raw) result.status = typeof raw.status === 'string' ? raw.status : null;
  if ('access_type' in raw) result.access_type = typeof raw.access_type === 'string' ? raw.access_type : null;
  if ('connectors' in raw) {
    result.connectors = Array.isArray(raw.connectors)
      ? raw.connectors.flatMap((c: unknown) =>
          c && typeof c === 'object' && typeof (c as Raw).type === 'string'
            ? [{ type: (c as Raw).type as string, power_kw: finite((c as Raw).power_kw), count: finite((c as Raw).count) }]
            : [])
      : null;
  }
  if ('working_hours' in raw) result.working_hours = raw.working_hours;
  return result;
};

const parsePending = (r: Raw, path: string): PendingNotification => ({
  event_id: text(r.event_id, `${path}.event_id`),
  kind: oneOf(r.kind, KINDS, `${path}.kind`),
  update_class: r.update_class === null || r.update_class === undefined ? null : oneOf(r.update_class, UPDATE_CLASSES, `${path}.update_class`),
  reason: oneOf(r.reason, ['new_charger', 'update'] as const, `${path}.reason`),
  state: oneOf(r.state, ['held', 'released'] as const, `${path}.state`),
  note: optionalText(r.note, `${path}.note`),
  // SQL `note = 'needs_review'` is NULL when there is no note.
  needs_review: r.needs_review === null || r.needs_review === undefined ? false
    : typeof r.needs_review === 'boolean' ? r.needs_review : fail(`${path}.needs_review`),
  charger_id: text(r.charger_id, `${path}.charger_id`),
  charger_name: text(r.charger_name, `${path}.charger_name`),
  governorate: governorate(r, path),
  queued_at: date(r.queued_at, `${path}.queued_at`),
  release_at: date(r.release_at, `${path}.release_at`),
  requested_by: optionalText(r.requested_by, `${path}.requested_by`),
  eta: optionalDate(r.eta, `${path}.eta`) ?? date(r.release_at, `${path}.release_at`),
});

const parseSuggestion = (r: Raw, path: string): SuggestedUpdate => ({
  update_event_id: text(r.update_event_id, `${path}.update_event_id`),
  charger_id: text(r.charger_id, `${path}.charger_id`),
  charger_name: text(r.charger_name, `${path}.charger_name`),
  update_class: oneOf(r.update_class, UPDATE_CLASSES, `${path}.update_class`),
  occurred_at: date(r.occurred_at, `${path}.occurred_at`),
  changed_fields: Array.isArray(r.changed_fields)
    ? r.changed_fields.map((f: unknown, i) => text(f, `${path}.changed_fields[${i}]`))
    : fail(`${path}.changed_fields`),
  before: snapshot(r.before, `${path}.before`),
  after: snapshot(r.after, `${path}.after`),
  governorate: governorate(r, path),
  recipient_estimate: count(r.recipient_estimate, `${path}.recipient_estimate`),
  push_estimate: count(r.push_estimate, `${path}.push_estimate`),
});

const parseBatch = (r: Raw, path: string): NotificationBatch => ({
  batch_id: text(r.batch_id, `${path}.batch_id`),
  source: oneOf(r.source, ['auto', 'admin'] as const, `${path}.source`),
  status: oneOf(r.status, ['claimed', 'sending', 'sent', 'failed'] as const, `${path}.status`),
  claimed_at: date(r.claimed_at, `${path}.claimed_at`),
  sent_at: optionalDate(r.sent_at, `${path}.sent_at`),
  recipient_count: count(r.recipient_count, `${path}.recipient_count`),
  device_count: count(r.device_count, `${path}.device_count`),
  ticket_ok: count(r.ticket_ok, `${path}.ticket_ok`),
  ticket_error: count(r.ticket_error, `${path}.ticket_error`),
  receipt_ok: count(r.receipt_ok, `${path}.receipt_ok`),
  receipt_error: count(r.receipt_error, `${path}.receipt_error`),
  opens: r.opens === null || r.opens === undefined ? null : count(r.opens, `${path}.opens`),
  event_count: count(r.event_count, `${path}.event_count`),
});

const parseSubscribers = (r: Raw, path: string): RegionSubscribers => ({
  governorate_code: text(r.governorate_code, `${path}.governorate_code`),
  name_fr: optionalText(r.name_fr, `${path}.name_fr`),
  name_ar: optionalText(r.name_ar, `${path}.name_ar`),
  name_en: optionalText(r.name_en, `${path}.name_en`),
  followers: count(r.followers, `${path}.followers`),
  followers_with_push: count(r.followers_with_push, `${path}.followers_with_push`),
});

const parseTotals = (value: unknown): NotificationTotals => {
  const t = object(value, 'totals');
  const n = (key: keyof Omit<NotificationTotals, 'quiet_now'>) => count(t[key], `totals.${key}`);
  return {
    region_followers: n('region_followers'), region_follows: n('region_follows'),
    active_devices: n('active_devices'), users_with_push: n('users_with_push'),
    pending: n('pending'), suggestions: n('suggestions'), batches: n('batches'),
    announcements_24h: n('announcements_24h'),
    quiet_now: typeof t.quiet_now === 'boolean' ? t.quiet_now : fail('totals.quiet_now'),
  };
};

const parseFunnel = (value: unknown): NotificationFunnel | null => {
  if (value === null || value === undefined) return null;
  const f = object(value, 'funnel');
  return {
    region_prompt_shown: count(f.region_prompt_shown, 'funnel.region_prompt_shown'),
    region_prompt_accepted: count(f.region_prompt_accepted, 'funnel.region_prompt_accepted'),
    permission_granted: count(f.permission_granted, 'funnel.permission_granted'),
    regions_updated: count(f.regions_updated, 'funnel.regions_updated'),
  };
};

export function parseNotificationsOverview(value: unknown): NotificationsOverview {
  const report = object(value, 'root');
  return {
    pending: rows(report.pending, 'pending', parsePending),
    suggestions: rows(report.suggestions, 'suggestions', parseSuggestion),
    history: rows(report.history, 'history', parseBatch),
    subscribers: rows(report.subscribers, 'subscribers', parseSubscribers),
    totals: parseTotals(report.totals),
    funnel: parseFunnel(report.funnel),
    server_time: date(report.server_time, 'server_time'),
    charger_id: optionalText(report.charger_id, 'charger_id'),
  };
}

export function parseNotificationPreview(value: unknown): NotificationPreview {
  const r = object(value, 'preview');
  const raw = object(r.previews, 'preview.previews');
  const previews: NotificationPreview['previews'] = {};
  for (const language of ['fr', 'ar', 'en'] as const) {
    if (raw[language] === undefined) continue;
    const copy = object(raw[language], `preview.previews.${language}`);
    previews[language] = {
      title: text(copy.title, `preview.previews.${language}.title`),
      body: text(copy.body, `preview.previews.${language}.body`),
    };
  }
  return {
    kind: oneOf(r.kind, KINDS, 'preview.kind'),
    update_class: r.update_class === null || r.update_class === undefined ? null : oneOf(r.update_class, UPDATE_CLASSES, 'preview.update_class'),
    charger_id: text(r.charger_id, 'preview.charger_id'),
    url: text(r.url, 'preview.url'),
    previews,
    recipient_estimate: count(r.recipient_estimate, 'preview.recipient_estimate'),
    push_estimate: count(r.push_estimate, 'preview.push_estimate'),
    estimate_scope: text(r.estimate_scope, 'preview.estimate_scope'),
  };
}

// ── Errors ─────────────────────────────────────────────────────────────────

// Turns an Edge Function error ({ error: code } + HTTP status) into copy an
// admin can act on.
export function notificationErrorMessage(status: number, code: string | null): string {
  switch (code) {
    case 'announce_rate_limited':
      return 'Already announced recently / daily limit reached. One announcement per charger per 24 h, 10 per day.';
    case 'announce_duplicate':
      return 'This update was already announced.';
    case 'announce_stale':
      return 'The charger changed since this update, or the update is older than 7 days. Refresh and check the suggestion.';
    case 'announce_not_classified':
      return 'This change is not one that can be announced.';
    case 'announce_not_found':
    case 'notification_not_found':
      return 'This item no longer exists. Refresh the page.';
    case 'notification_state':
      return 'This notification already went out, was cancelled, or was already released. Refresh the page.';
    case 'notifications_unavailable':
      return 'The notifications service is unavailable. Try again in a moment.';
  }
  if (status === 401) return 'Your admin session expired. Sign in again.';
  if (status === 403) return 'This account is not allowed to manage notifications.';
  if (status === 429) return 'Already announced recently / daily limit reached.';
  if (status === 404) return 'This item no longer exists. Refresh the page.';
  if (status === 409) return 'This item changed in the meantime. Refresh the page.';
  if (status === 400) return 'The request was rejected as invalid.';
  if (status === 503) return 'The notifications service is unavailable. Try again in a moment.';
  return `The notifications service failed (HTTP ${status}).`;
}

// ── Display helpers ────────────────────────────────────────────────────────

export const TIMEZONE = 'Africa/Tunis';
// SQL cap in admin_announce_update.
export const DAILY_ANNOUNCEMENT_CAP = 10;

export const UPDATE_CLASS_LABELS: Record<UpdateClass, string> = {
  planned_to_operational: 'Planned → operational',
  out_of_service: 'Out of service',
  back_in_service: 'Back in service',
  power_upgrade: 'Power upgrade',
  new_connector: 'New connector',
};

const STATUS_LABELS: Record<string, string> = {
  operational: 'Operational', under_repair: 'Under repair', planned: 'Planned', unknown: 'Unknown',
};
const ACCESS_LABELS: Record<string, string> = {
  public: 'Public', customers_only: 'Customers only', employees_only: 'Employees only', brand_exclusive: 'Brand exclusive',
};

export const governorateLabel = (g: { name_en: string | null; name_fr: string | null; code: string | null }): string =>
  g.name_en || g.name_fr || g.code || 'Unknown governorate';

const tunisParts = (at: Date) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? NaN);
  return { hour: get('hour'), minute: get('minute'), second: get('second') };
};

// Quiet hours: 22:00–08:00 Africa/Tunis (notification_is_quiet).
export const isQuietTime = (at: Date | string): boolean => {
  const { hour } = tunisParts(new Date(at));
  return hour >= 22 || hour < 8;
};

// The server moves an ETA that lands in quiet hours to exactly 08:00:00
// Tunis (notification_after_quiet), so that instant means "waiting for quiet
// hours to end".
export const waitsForQuietHours = (eta: string): boolean => {
  const at = new Date(eta);
  if (isQuietTime(at)) return true;
  const { hour, minute, second } = tunisParts(at);
  return hour === 8 && minute === 0 && second === 0 && at.getUTCMilliseconds() === 0;
};

export const formatCountdown = (ms: number): string => {
  if (ms <= 0) return 'due at the next run';
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `in ${hours} h ${String(minutes % 60).padStart(2, '0')} min`;
  return `in ${Math.floor(hours / 24)} d ${hours % 24} h`;
};

export const formatTunisTime = (iso: string, withDate = false): string =>
  new Date(iso).toLocaleString('en-GB', {
    timeZone: TIMEZONE,
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    ...(withDate ? { day: 'numeric', month: 'short' } : {}),
  });

// Opens / recipients. A lower bound: users with analytics off never report
// an open.
export const openRate = (batch: NotificationBatch): number | null =>
  batch.opens === null || batch.recipient_count === 0 ? null : (batch.opens / batch.recipient_count) * 100;

const CONNECTOR_ORDER = ['Type 2', 'CCS', 'CHAdeMO'];

// "Type 2 22 kW ×2 · CCS 60 kW": grouped per type (never by array position,
// same as the classifier), max power, total count.
export const connectorsLabel = (list: ConnectorValue[] | null | undefined): string => {
  if (!list || list.length === 0) return 'None';
  const byType = new Map<string, { kw: number; count: number }>();
  for (const c of list) {
    const entry = byType.get(c.type) ?? { kw: 0, count: 0 };
    entry.kw = Math.max(entry.kw, c.power_kw ?? 0);
    entry.count += c.count ?? 1;
    byType.set(c.type, entry);
  }
  const rank = (t: string) => (CONNECTOR_ORDER.includes(t) ? CONNECTOR_ORDER.indexOf(t) : CONNECTOR_ORDER.length);
  return [...byType.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([type, { kw, count: n }]) => `${type}${kw > 0 ? ` ${kw} kW` : ''}${n > 1 ? ` ×${n}` : ''}`)
    .join(' · ');
};

export interface DiffLine { field: string; before: string; after: string }

export const suggestionDiff = (s: Pick<SuggestedUpdate, 'before' | 'after'>): DiffLine[] => {
  const lines: DiffLine[] = [];
  const label = (map: Record<string, string>, v: string | null | undefined) => (v ? map[v] ?? v : '—');
  if ('status' in s.before || 'status' in s.after) {
    lines.push({ field: 'Status', before: label(STATUS_LABELS, s.before.status), after: label(STATUS_LABELS, s.after.status) });
  }
  if ('connectors' in s.before || 'connectors' in s.after) {
    lines.push({ field: 'Connectors', before: connectorsLabel(s.before.connectors), after: connectorsLabel(s.after.connectors) });
  }
  if ('access_type' in s.before || 'access_type' in s.after) {
    lines.push({ field: 'Access', before: label(ACCESS_LABELS, s.before.access_type), after: label(ACCESS_LABELS, s.after.access_type) });
  }
  if ('working_hours' in s.before || 'working_hours' in s.after) {
    lines.push({ field: 'Hours', before: 'Previous', after: 'Updated' });
  }
  return lines;
};

export const estimateLabel = (p: Pick<NotificationPreview, 'recipient_estimate' | 'push_estimate' | 'estimate_scope'>): string => {
  const people = `${p.recipient_estimate} ${p.recipient_estimate === 1 ? 'person' : 'people'}`;
  const push = `${p.push_estimate} with push enabled`;
  switch (p.estimate_scope) {
    case 'region':
      return `≈ ${people} following this governorate · ${push}`;
    case 'region_only_lower_bound':
      return `At least ${people} (governorate followers; charger followers come on top) · ${push}`;
    case 'region_and_charger':
      return `≈ ${people} following this governorate or charger · ${push}`;
    default:
      return `≈ ${people} · ${push}`;
  }
};
