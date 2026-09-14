export type AnalyticsEnvironment = 'production' | 'preview' | 'development';
export type AnalyticsPeriod = 7 | 30 | 90;

export interface AnalyticsReport {
  days: AnalyticsPeriod;
  environment: AnalyticsEnvironment;
  timezone: string;
  generated_at: string;
  from: string;
  metrics: {
    active_users: number; active_today: number; active_7_days: number; returning_users: number;
    app_opens: number; charger_views: number; searches: number; empty_searches: number;
    route_requests: number; route_successes: number; route_failures: number; route_pending: number;
    route_p95_ms: number | null; navigation_launches: number; events_dropped: number;
  };
  daily: { day: string; active_users: number; app_opens: number; navigation_launches: number }[];
  top_chargers: { charger_id: string; name: string; views: number; viewers: number; navigation_launches: number }[];
  failure_reasons: { reason: string; count: number }[];
  versions: { app_version: string; platform: string; users: number }[];
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid analytics response');
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid analytics response');
  return value;
}
function date(value: unknown, dayOnly = false): string {
  const result = text(value);
  if (!Number.isFinite(Date.parse(result)) || (dayOnly && !/^\d{4}-\d{2}-\d{2}$/.test(result))) throw new Error('Invalid analytics response');
  return result;
}
function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('Invalid analytics response');
  return value;
}
function rows<T>(value: unknown, map: (row: Record<string, unknown>) => T): T[] {
  if (!Array.isArray(value)) throw new Error('Invalid analytics response');
  return value.map((row: unknown) => map(object(row)));
}

export function parseAnalyticsReport(value: unknown): AnalyticsReport {
  const report = object(value);
  const m = object(report.metrics);
  if (![7, 30, 90].includes(number(report.days)) || !['production', 'preview', 'development'].includes(text(report.environment)) || report.timezone !== 'Africa/Tunis') {
    throw new Error('Invalid analytics response');
  }
  return {
    days: report.days as AnalyticsPeriod,
    environment: report.environment as AnalyticsEnvironment,
    timezone: text(report.timezone), generated_at: date(report.generated_at), from: date(report.from),
    metrics: {
      active_users: number(m.active_users), active_today: number(m.active_today), active_7_days: number(m.active_7_days),
      returning_users: number(m.returning_users), app_opens: number(m.app_opens), charger_views: number(m.charger_views),
      searches: number(m.searches), empty_searches: number(m.empty_searches), route_requests: number(m.route_requests),
      route_successes: number(m.route_successes), route_failures: number(m.route_failures), route_pending: number(m.route_pending),
      route_p95_ms: m.route_p95_ms === null ? null : number(m.route_p95_ms),
      navigation_launches: number(m.navigation_launches), events_dropped: number(m.events_dropped),
    },
    daily: rows(report.daily, (r) => ({ day: date(r.day, true), active_users: number(r.active_users), app_opens: number(r.app_opens), navigation_launches: number(r.navigation_launches) })),
    top_chargers: rows(report.top_chargers, (r) => ({ charger_id: text(r.charger_id), name: text(r.name), views: number(r.views), viewers: number(r.viewers), navigation_launches: number(r.navigation_launches) })),
    failure_reasons: rows(report.failure_reasons, (r) => ({ reason: text(r.reason), count: number(r.count) })),
    versions: rows(report.versions, (r) => ({ app_version: text(r.app_version), platform: text(r.platform), users: number(r.users) })),
  };
}

export function routeSuccessRate(report: AnalyticsReport): number | null {
  const completed = report.metrics.route_successes + report.metrics.route_failures;
  return completed ? report.metrics.route_successes / completed * 100 : null;
}

export function analyticsDailyCsv(report: AnalyticsReport): string {
  return ['date,active_users,app_opens,navigation_launches', ...report.daily.map((r) =>
    `${r.day},${r.active_users},${r.app_opens},${r.navigation_launches}`)].join('\n');
}
