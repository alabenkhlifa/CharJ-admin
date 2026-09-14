import { useEffect, useState } from 'react';
import { parseAnalyticsReport, type AnalyticsReport, type AnalyticsEnvironment, type AnalyticsPeriod } from './analytics-report';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const ADMIN_API_SECRET = import.meta.env.VITE_ADMIN_API_SECRET ?? '';

export function useAnalytics(days: AnalyticsPeriod, environment: AnalyticsEnvironment, revision: number) {
  const requestKey = JSON.stringify([days, environment, revision]);
  const [state, setState] = useState<{ data: AnalyticsReport | null; loading: boolean; error: string | null; requestKey: string }>({
    data: null, loading: true, error: null, requestKey: '',
  });
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setState({ data: null, loading: true, error: null, requestKey });
      try {
        if (!SUPABASE_URL || !ADMIN_API_SECRET) throw new Error('Admin API not configured. Set VITE_SUPABASE_URL + VITE_ADMIN_API_SECRET.');
        const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-analytics?days=${days}&environment=${environment}`, {
          headers: { Authorization: `Bearer ${ADMIN_API_SECRET}` }, signal: controller.signal,
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
  }, [days, environment, revision, requestKey]);
  return state.requestKey === requestKey ? state : { data: null, loading: true, error: null };
}
