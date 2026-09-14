import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAnalyticsReport, routeSuccessRate, analyticsDailyCsv } from '../src/data/analytics-report.ts';

const fixture = () => ({
  days: 7, environment: 'production', timezone: 'Africa/Tunis', generated_at: '2026-09-14T12:00:00Z', from: '2026-09-07T23:00:00Z',
  metrics: { active_users: 2, active_today: 1, active_7_days: 2, returning_users: 1, app_opens: 3, charger_views: 4,
    searches: 3, empty_searches: 1, route_requests: 5, route_successes: 3, route_failures: 1, route_pending: 1,
    route_p95_ms: 600, navigation_launches: 2, events_dropped: 0 },
  daily: [{ day: '2026-09-14', active_users: 1, app_opens: 2, navigation_launches: 1 }],
  top_chargers: [{ charger_id: 'station', name: 'Station', views: 4, viewers: 2, navigation_launches: 1 }],
  failure_reasons: [{ reason: 'network', count: 1 }], versions: [{ app_version: '1.2.1', platform: 'android', users: 2 }],
});

test('pending requests do not count as failures in route success', () => {
  assert.equal(routeSuccessRate(parseAnalyticsReport(fixture())), 75);
  const value = fixture(); value.metrics.route_successes = 0; value.metrics.route_failures = 0;
  assert.equal(routeSuccessRate(parseAnalyticsReport(value)), null);
});

test('exports only daily aggregate counts with no user, charger or search details', () => {
  assert.equal(analyticsDailyCsv(parseAnalyticsReport(fixture())), 'date,active_users,app_opens,navigation_launches\n2026-09-14,1,2,1');
});

test('rejects malformed data rather than displaying misleading counts or unsafe CSV', () => {
  const wrongCount = fixture(); wrongCount.metrics.app_opens = -1;
  const wrongDate = fixture(); wrongDate.daily[0].day = '=SUM(1,2)';
  for (const value of [null, {}, { ...fixture(), timezone: 'invalid' }, { ...fixture(), days: 365 },
    { ...fixture(), daily: null }, { ...fixture(), generated_at: 'yesterday' }, wrongCount, wrongDate]) {
    assert.throws(() => parseAnalyticsReport(value), /Invalid analytics response/);
  }
});
