import { useEffect, useState } from 'react';
import { parseAnalyticsReport, type AnalyticsReport, type AnalyticsEnvironment, type AnalyticsPeriod } from './analytics-report';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';

export function useAnalytics(days: AnalyticsPeriod, environment: AnalyticsEnvironment, revision: number, accessKey: string) {
  const requestKey = JSON.stringify([days, environment, revision, accessKey]);
  const [state, setState] = useState<{ data: AnalyticsReport | null; loading: boolean; error: string | null; requestKey: string }>({
    data: null, loading: true, error: null, requestKey: '',
  });
  useEffect(() => {
    if (!accessKey) {
      void Promise.resolve().then(() => setState({ data: null, loading: false, error: null, requestKey: '' }));
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setState({ data: null, loading: true, error: null, requestKey });
      try {
        if (!SUPABASE_URL) throw new Error('Analytics reporting is not configured.');
        const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-analytics?days=${days}&environment=${environment}`, {
          headers: { Authorization: `Bearer ${accessKey}` }, signal: controller.signal,
        });
        if (!response.ok) throw new Error(response.status === 401 ? 'Your admin credentials could not be verified.' : 'Analytics reporting is unavailable.');
        const data = parseAnalyticsReport(await response.json());
        if (data.days !== days || data.environment !== environment) throw new Error('Invalid analytics response');
        if (active) setState({ data, loading: false, error: null, requestKey });
      } catch (error) {
        if (active) setState({ data: null, loading: false, error: error instanceof Error ? error.message : 'Analytics reporting is unavailable.', requestKey });
      } finally { clearTimeout(timeout); }
    });
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [days, environment, revision, accessKey, requestKey]);
  return accessKey && state.requestKey === requestKey ? state : { data: null, loading: Boolean(accessKey), error: null };
}
