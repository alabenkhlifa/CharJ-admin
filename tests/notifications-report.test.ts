import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  connectorsLabel,
  estimateLabel,
  formatCountdown,
  isQuietTime,
  notificationErrorMessage,
  openRate,
  parseNotificationPreview,
  parseNotificationsOverview,
  suggestionDiff,
  waitsForQuietHours,
} from '../src/data/notifications-report.ts';

const NABEUL = { governorate_code: 'TN-21', governorate_name_fr: 'Nabeul', governorate_name_ar: 'نابل', governorate_name_en: 'Nabeul' };

// Shaped like admin_notification_overview (20261021000016).
const fixture = () => ({
  pending: [{
    event_id: 'e1', kind: 'charger_added', update_class: null, reason: 'new_charger', state: 'held',
    note: null, needs_review: null as boolean | null, charger_id: 'c1', charger_name: 'Shell Hammamet', ...NABEUL,
    queued_at: '2026-10-21T09:00:00.123+00:00', release_at: '2026-10-21T09:30:00+00:00', requested_by: null,
    eta: '2026-10-21T09:30:00.123+00:00' as string | null,
  }],
  suggestions: [{
    update_event_id: 'u1', charger_id: 'c2', charger_name: 'Total Sousse', update_class: 'new_connector',
    occurred_at: '2026-10-20T12:00:00+00:00', changed_fields: ['connectors'],
    before: { connectors: [{ type: 'Type 2', power_kw: 22, count: 2 }] },
    after: { connectors: [{ type: 'CCS', power_kw: 60, count: 1 }, { type: 'Type 2', power_kw: 22, count: 2 }] },
    governorate_code: 'TN-51', governorate_name_fr: 'Sousse', governorate_name_ar: 'سوسة', governorate_name_en: 'Sousse',
    recipient_estimate: 12, push_estimate: 7,
  }],
  history: [{
    batch_id: 'b1', source: 'auto', status: 'sent', claimed_at: '2026-10-19T10:00:00+00:00', sent_at: '2026-10-19T10:00:05+00:00',
    recipient_count: 40, device_count: 44, ticket_ok: 43, ticket_error: 1, receipt_ok: 42, receipt_error: 1,
    opens: 10 as number | undefined, event_count: 2,
  }],
  subscribers: [{ governorate_code: 'TN-21', name_fr: 'Nabeul', name_ar: 'نابل', name_en: 'Nabeul', followers: 40, followers_with_push: 25 }],
  totals: {
    region_followers: 50, region_follows: 70, active_devices: 30, users_with_push: 28, pending: 1, suggestions: 1,
    batches: 1, announcements_24h: 2, quiet_now: false,
  },
  funnel: { region_prompt_shown: 100, region_prompt_accepted: 40, permission_granted: 30, regions_updated: 45 } as unknown,
  server_time: '2026-10-21T10:00:00+00:00',
});

test('parses the overview, keeps wire names, normalises nullable flags', () => {
  const report = parseNotificationsOverview(fixture());
  assert.equal(report.pending[0].needs_review, false);
  assert.deepEqual(report.pending[0].governorate, { code: 'TN-21', name_fr: 'Nabeul', name_ar: 'نابل', name_en: 'Nabeul' });
  assert.equal(report.suggestions[0].update_class, 'new_connector');
  assert.equal(report.history[0].opens, 10);
  assert.deepEqual(report.funnel, { region_prompt_shown: 100, region_prompt_accepted: 40, permission_granted: 30, regions_updated: 45 });
  assert.equal(report.totals.quiet_now, false);
  assert.equal(report.charger_id, null);
  const narrowed = parseNotificationsOverview({ ...fixture(), charger_id: 'c2' });
  assert.equal(narrowed.charger_id, 'c2');
});

test('opens and funnel are optional: missing means unknown, never zero', () => {
  const value = fixture();
  delete value.history[0].opens;
  const report = parseNotificationsOverview({ ...value, funnel: undefined });
  assert.equal(report.history[0].opens, null);
  assert.equal(report.funnel, null);
  assert.equal(openRate(report.history[0]), null);
  assert.equal(parseNotificationsOverview({ ...fixture(), funnel: null }).funnel, null);
});

test('missing eta falls back to release_at', () => {
  const value = fixture();
  value.pending[0].eta = null;
  assert.equal(parseNotificationsOverview(value).pending[0].eta, '2026-10-21T09:30:00+00:00');
});

test('rejects wrong shapes with a clear error naming the field', () => {
  const cases: [unknown, RegExp][] = [
    [null, /\(root\)/],
    [{ ...fixture(), pending: null }, /\(pending\)/],
    [{ ...fixture(), totals: undefined }, /\(totals\)/],
    [{ ...fixture(), server_time: 'yesterday' }, /\(server_time\)/],
    [{ ...fixture(), funnel: { region_prompt_shown: 1 } }, /funnel\.region_prompt_accepted/],
    [{ ...fixture(), funnel: { prompt_shown: 1, accepted: 1, permission_granted: 1, regions_saved: 1 } }, /funnel\.region_prompt_shown/],
  ];
  const mutate = (fn: (v: ReturnType<typeof fixture>) => void) => { const v = fixture(); fn(v); return v; };
  cases.push(
    [mutate((v) => { (v.pending[0] as Record<string, unknown>).state = 'sent'; }), /pending\[0\]\.state/],
    [mutate((v) => { (v.pending[0] as Record<string, unknown>).kind = 'mystery'; }), /pending\[0\]\.kind/],
    [mutate((v) => { (v.pending[0] as Record<string, unknown>).needs_review = 'yes'; }), /pending\[0\]\.needs_review/],
    [mutate((v) => { (v.suggestions[0] as Record<string, unknown>).update_class = null; }), /suggestions\[0\]\.update_class/],
    [mutate((v) => { (v.suggestions[0] as Record<string, unknown>).recipient_estimate = -1; }), /recipient_estimate/],
    [mutate((v) => { (v.history[0] as Record<string, unknown>).opens = 1.5; }), /history\[0\]\.opens/],
    [mutate((v) => { (v.history[0] as Record<string, unknown>).source = 'cron'; }), /history\[0\]\.source/],
    [mutate((v) => { (v.totals as Record<string, unknown>).quiet_now = 'no'; }), /totals\.quiet_now/],
    [mutate((v) => { (v.subscribers[0] as Record<string, unknown>).followers = '40'; }), /subscribers\[0\]\.followers/],
  );
  for (const [value, message] of cases) {
    assert.throws(() => parseNotificationsOverview(value), (error: Error) =>
      /^Invalid notifications response/.test(error.message) && message.test(error.message));
  }
});

test('before/after snapshots are display-only and tolerate odd connector rows', () => {
  const value = fixture();
  (value.suggestions[0].after.connectors as unknown[]).push('junk', { power_kw: 50 }, { type: 'CHAdeMO', power_kw: '50' });
  const [s] = parseNotificationsOverview(value).suggestions;
  assert.deepEqual(s.after.connectors?.map((c) => c.type), ['CCS', 'Type 2', 'CHAdeMO']);
  assert.deepEqual(suggestionDiff(s), [{ field: 'Connectors', before: 'Type 2 22 kW ×2', after: 'Type 2 22 kW ×2 · CCS 60 kW · CHAdeMO' }]);
  assert.deepEqual(
    suggestionDiff({ before: { status: 'planned' }, after: { status: 'operational' } }),
    [{ field: 'Status', before: 'Planned', after: 'Operational' }],
  );
});

test('connector label groups per type (never by position) and keeps the max power', () => {
  assert.equal(connectorsLabel([{ type: 'CCS', power_kw: 60, count: 1 }, { type: 'CCS', power_kw: 120, count: 1 }]), 'CCS 120 kW ×2');
  assert.equal(connectorsLabel([]), 'None');
});

test('quiet hours are 22:00–08:00 Africa/Tunis (UTC+1)', () => {
  assert.equal(isQuietTime('2026-10-21T20:59:00Z'), false); // 21:59 Tunis
  assert.equal(isQuietTime('2026-10-21T21:00:00Z'), true); // 22:00
  assert.equal(isQuietTime('2026-10-22T06:59:00Z'), true); // 07:59
  assert.equal(isQuietTime('2026-10-22T07:00:00Z'), false); // 08:00
  // An ETA pushed to exactly 08:00 Tunis by notification_after_quiet.
  assert.equal(waitsForQuietHours('2026-10-22T07:00:00+00:00'), true);
  assert.equal(waitsForQuietHours('2026-10-22T07:00:00.123+00:00'), false);
  assert.equal(waitsForQuietHours('2026-10-22T09:30:00+00:00'), false);
});

test('countdown formatting', () => {
  assert.equal(formatCountdown(-5_000), 'due at the next run');
  assert.equal(formatCountdown(30_000), 'in 1 min');
  assert.equal(formatCountdown(23 * 60_000), 'in 23 min');
  assert.equal(formatCountdown(65 * 60_000), 'in 1 h 05 min');
  assert.equal(formatCountdown(26 * 3_600_000), 'in 1 d 2 h');
});

test('open rate is opens over recipients and undefined with no recipients', () => {
  const [batch] = parseNotificationsOverview(fixture()).history;
  assert.equal(openRate(batch), 25);
  assert.equal(openRate({ ...batch, recipient_count: 0 }), null);
});

test('maps Edge Function errors to admin-facing copy', () => {
  assert.match(notificationErrorMessage(429, 'announce_rate_limited'), /^Already announced recently \/ daily limit reached/);
  assert.match(notificationErrorMessage(429, null), /^Already announced recently \/ daily limit reached/);
  assert.match(notificationErrorMessage(409, 'announce_duplicate'), /already announced/);
  assert.match(notificationErrorMessage(409, 'announce_stale'), /changed/);
  assert.match(notificationErrorMessage(409, 'notification_state'), /already went out/);
  assert.match(notificationErrorMessage(404, 'notification_not_found'), /no longer exists/);
  assert.match(notificationErrorMessage(400, 'announce_not_classified'), /cannot|not one/);
  assert.match(notificationErrorMessage(503, 'notifications_unavailable'), /unavailable/);
  assert.match(notificationErrorMessage(500, null), /HTTP 500/);
});

test('parses a preview with three languages and an estimate', () => {
  const preview = parseNotificationPreview({
    kind: 'charger_updated', update_class: 'back_in_service', charger_id: 'c1', url: '/charger/c1',
    previews: { fr: { title: 'Borne de retour', body: 'Shell Hammamet' }, ar: { title: 'عادت', body: 'شل' }, en: { title: 'Back', body: 'Shell' } },
    recipient_estimate: 12, push_estimate: 7, estimate_scope: 'region_and_charger',
  });
  assert.deepEqual(Object.keys(preview.previews), ['fr', 'ar', 'en']);
  assert.equal(estimateLabel(preview), '≈ 12 people following this governorate or charger · 7 with push enabled');
  assert.match(estimateLabel({ ...preview, estimate_scope: 'region_only_lower_bound' }), /^At least 12 people/);
  assert.throws(() => parseNotificationPreview({ ...preview, previews: { fr: { title: 1 } } }), /previews\.fr\.title/);
  assert.throws(() => parseNotificationPreview({ ...preview, push_estimate: null }), /push_estimate/);
});
