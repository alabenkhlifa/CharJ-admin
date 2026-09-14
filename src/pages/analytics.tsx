import { useState } from 'react';
import { Card, EmptyState } from '../components/card';
import { useAnalytics } from '../data/analytics';
import { analyticsDailyCsv, routeSuccessRate, type AnalyticsEnvironment, type AnalyticsPeriod } from '../data/analytics-report';
import './analytics.css';

const format = (value: number) => value.toLocaleString('en-GB');
const failureLabels: Record<string, string> = { network: 'Connection failure', no_route: 'No driving route', service_unavailable: 'Routing service unavailable' };

export function AnalyticsPage() {
  const [days, setDays] = useState<AnalyticsPeriod>(30);
  const [environment, setEnvironment] = useState<AnalyticsEnvironment>('production');
  const [revision, setRevision] = useState(0);
  // Keep the reporting credential in memory only, never in the web bundle or storage.
  const [accessKey, setAccessKey] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const { data, loading, error } = useAnalytics(days, environment, revision, accessKey);
  const m = data?.metrics;
  const rate = data ? routeSuccessRate(data) : null;
  const cards = m ? [
    { label: 'Active users', value: format(m.active_users), hint: `Unique app users in ${days} days` },
    { label: 'Active today / 7 days', value: `${format(m.active_today)} / ${format(m.active_7_days)}`, hint: 'Calendar days in Tunisia' },
    { label: 'Returning users', value: format(m.returning_users), hint: 'Active in this period and on an earlier day' },
    { label: 'App opens', value: format(m.app_opens), hint: 'Launches and returns from background' },
    { label: 'Searches with no results', value: format(m.empty_searches), hint: `${format(m.searches)} settled searches and filters` },
    { label: 'Itinerary success', value: rate === null ? '—' : `${rate.toFixed(1)}%`, hint: `${format(m.route_successes)} succeeded · ${format(m.route_failures)} failed` },
    { label: 'Navigation launches', value: format(m.navigation_launches), hint: 'Successful handoffs to a maps app' },
    { label: 'Route response time · p95', value: m.route_p95_ms === null ? '—' : `${(m.route_p95_ms / 1000).toFixed(1)} s`, hint: `${format(m.route_pending)} ${m.route_pending === 1 ? 'request' : 'requests'} without a recorded result` },
  ] : [];

  const exportCsv = () => {
    if (!data) return;
    const url = URL.createObjectURL(new Blob([analyticsDailyCsv(data)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `charj-activity-${environment}-${days}d.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const max = Math.max(1, ...(data?.daily.map((day) => day.active_users) ?? []));

  return (
    <section className="analytics-page" aria-label="App analytics">
      <div className="analytics-heading">
        <div><h1>App analytics</h1><p>Usage, charger discovery and itinerary reliability.</p></div>
        <div className="analytics-controls">
          <label>Period<select value={days} onChange={(event) => setDays(Number(event.target.value) as AnalyticsPeriod)}>
            <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
          </select></label>
          <label>Environment<select value={environment} onChange={(event) => setEnvironment(event.target.value as AnalyticsEnvironment)}>
            <option value="production">Production</option><option value="preview">Preview</option><option value="development">Development</option>
          </select></label>
          <button onClick={() => setRevision((value) => value + 1)} disabled={!accessKey || loading}>Refresh</button>
          <button onClick={exportCsv} disabled={!data || loading}>Export daily CSV</button>
          {accessKey && <button onClick={() => setAccessKey('')}>Lock analytics</button>}
        </div>
      </div>
      {!accessKey && <Card><h2>Unlock app analytics</h2><p className="analytics-muted">Enter your analytics access key to view reports. It is kept only while this page is open.</p>
        <form className="analytics-unlock" onSubmit={(event) => { event.preventDefault(); setAccessKey(keyInput.trim()); setKeyInput(''); }}>
          <label>Analytics access key<input type="password" required autoComplete="off" value={keyInput} onChange={(event) => setKeyInput(event.target.value)} /></label>
          <button type="submit" disabled={!keyInput.trim()}>Unlock analytics</button>
        </form>
      </Card>}
      {loading && <Card><p role="status">Loading app analytics…</p></Card>}
      {error && <Card><p role="alert">{error}</p><button onClick={() => setRevision((value) => value + 1)}>Try again</button></Card>}
      {data && !loading && <>
        <div className="analytics-kpis">{cards.map((card) => <Card key={card.label}>
          <div className="analytics-kpi-label">{card.label}</div><div className="analytics-kpi-value">{card.value}</div><p className="analytics-muted">{card.hint}</p>
        </Card>)}</div>
        {m?.events_dropped ? <p role="status" className="analytics-notice">The collection limit dropped {format(m.events_dropped)} events in this period. Counts are incomplete.</p> : null}
        {m?.app_opens === 0 && <Card><EmptyState title="No app usage recorded yet" subtitle="Events will appear after an analytics-enabled app version is installed and opened. Existing usage cannot be reconstructed." /></Card>}
        <Card>
          <h2>Daily active users</h2><p className="analytics-muted">Unique users who opened Charj · {data.timezone}</p>
          <div className="analytics-chart-scroll"><div className="analytics-chart" role="img" aria-label="Daily active users. Exact values are in the table below." style={{ minWidth: data.daily.length * 14 }}>
            {data.daily.map((day) => <div className="analytics-chart-column" key={day.day} title={`${day.day}: ${day.active_users} active users`}>
              <div className="analytics-chart-bar" style={{ height: `${day.active_users / max * 100}%` }} />
            </div>)}
          </div></div>
          <div className="analytics-chart-labels"><span>{data.daily[0]?.day}</span><span>{data.daily.at(-1)?.day}</span></div>
          <details><summary>Daily activity table</summary><div className="analytics-table-scroll"><table>
            <thead><tr><th>Date</th><th>Active users</th><th>App opens</th><th>Navigation launches</th></tr></thead>
            <tbody>{data.daily.map((day) => <tr key={day.day}><td>{day.day}</td><td>{format(day.active_users)}</td><td>{format(day.app_opens)}</td><td>{format(day.navigation_launches)}</td></tr>)}</tbody>
          </table></div></details>
        </Card>
        <div className="analytics-columns">
          <Card><h2>Popular chargers</h2><p className="analytics-muted">Interest in a station, measured by views and navigation launches.</p>
            {data.top_chargers.length ? <div className="analytics-table-scroll"><table><thead><tr><th>Charger</th><th>Views</th><th>Viewers</th><th>Navigation</th></tr></thead>
              <tbody>{data.top_chargers.map((charger) => <tr key={charger.charger_id}><td>{charger.name}</td><td>{format(charger.views)}</td><td>{format(charger.viewers)}</td><td>{format(charger.navigation_launches)}</td></tr>)}</tbody>
            </table></div> : <p className="analytics-muted">No charger interactions in this period.</p>}
          </Card>
          <Card><h2>Itinerary failures</h2>
            {data.failure_reasons.length ? <table><thead><tr><th>Reason</th><th>Requests</th></tr></thead><tbody>{data.failure_reasons.map((failure) =>
              <tr key={failure.reason}><td>{failureLabels[failure.reason] ?? failure.reason}</td><td>{format(failure.count)}</td></tr>)}</tbody></table>
              : <p className="analytics-muted">No recorded itinerary failures.</p>}
            <h2 className="analytics-subheading">App versions</h2>
            {data.versions.length ? <table><thead><tr><th>Version</th><th>Platform</th><th>Users</th></tr></thead><tbody>{data.versions.map((version) =>
              <tr key={`${version.app_version}:${version.platform}`}><td>{version.app_version}</td><td>{version.platform}</td><td>{format(version.users)}</td></tr>)}</tbody></table>
              : <p className="analytics-muted">No version data yet.</p>}
          </Card>
        </div>
        <p className="analytics-footnote">Users are counted by their persistent app identity; reinstalling can create a new identity. Opted-out users and events lost before delivery are excluded. Returning users opened Charj in this period and on an earlier calendar day within the retained 90-day history. Route success uses completed requests; unmatched requests are shown separately. Navigation records a maps-app handoff, not a confirmed charging visit.</p>
        <p className="analytics-muted">Updated {new Date(data.generated_at).toLocaleString('en-GB', { timeZone: data.timezone })} · {data.timezone}</p>
      </>}
    </section>
  );
}
