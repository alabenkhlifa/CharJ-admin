import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '../lib/admin-fetch';
import { SUPABASE_CONFIGURED } from '../lib/supabase';
import {
  notificationErrorMessage,
  parseNotificationPreview,
  parseNotificationsOverview,
  type NotificationPeriod,
  type NotificationPreview,
  type NotificationsOverview,
} from './notifications-report';

// Region alerts admin: the `admin-notifications` Edge Function. GET returns
// the overview (optionally narrowed with ?charger_id=), POST runs one action.
// Templates only: nothing here sends free text.

const ENDPOINT = 'admin-notifications';
const NOT_CONFIGURED = 'Admin API not configured. Set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.';

const errorCode = async (res: Response): Promise<string | null> => {
  try {
    const body: unknown = await res.json();
    return body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string'
      ? (body as { error: string }).error
      : null;
  } catch {
    return null;
  }
};

const failureMessage = (error: unknown, fallback: string) =>
  error instanceof DOMException && error.name === 'AbortError'
    ? 'Request timed out.'
    : error instanceof Error ? error.message : fallback;

async function fetchOverview(query: string, signal: AbortSignal): Promise<NotificationsOverview> {
  if (!SUPABASE_CONFIGURED) throw new Error(NOT_CONFIGURED);
  const res = await adminFetch(`${ENDPOINT}?${query}`, { signal });
  if (!res.ok) throw new Error(notificationErrorMessage(res.status, await errorCode(res)));
  return parseNotificationsOverview(await res.json());
}

type OverviewState = {
  key: string;
  data: NotificationsOverview | null;
  loading: boolean;
  error: string | null;
  // server_time − local clock when the response arrived, so countdowns use
  // the server's clock rather than a skewed laptop.
  skewMs: number;
};

const EMPTY: OverviewState = { key: '', data: null, loading: true, error: null, skewMs: 0 };

// `key` decides what counts as "the same view": a refresh keeps showing the
// previous data while it reloads, a different key starts blank.
function useOverview(query: string | null, key: string) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<OverviewState>(EMPTY);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);

  useEffect(() => {
    if (query === null) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setState((prev) => ({ ...(prev.key === key ? prev : EMPTY), key, loading: true, error: null }));
      try {
        const data = await fetchOverview(query, controller.signal);
        const skewMs = Date.parse(data.server_time) - Date.now();
        if (active) setState({ key, data, loading: false, error: null, skewMs });
      } catch (error) {
        if (active) {
          setState((prev) => ({
            ...(prev.key === key ? prev : EMPTY),
            key,
            loading: false,
            error: failureMessage(error, 'Notifications are unavailable.'),
          }));
        }
      } finally {
        clearTimeout(timeout);
      }
    });
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, key, revision]);

  const current = state.key === key ? state : EMPTY;
  return { ...current, loading: query !== null && current.loading, refresh };
}

// Notifications page: the whole overview. `days` narrows history + funnel.
export function useNotifications(days: NotificationPeriod) {
  return useOverview(`days=${days}`, `all:${days}`);
}

// Charger drawer: suggestions / pending / history for one charger. Pass null
// to skip the request.
export function useChargerNotifications(chargerId: string | null) {
  return useOverview(
    chargerId && SUPABASE_CONFIGURED ? `days=7&charger_id=${encodeURIComponent(chargerId)}` : null,
    `charger:${chargerId ?? ''}`,
  );
}

// ── Actions ────────────────────────────────────────────────────────────────

export type NotificationTarget = { event_id: string } | { update_event_id: string };
export type ActionResult = { ok: true } | { ok: false; error: string };

async function post(body: Record<string, string>): Promise<{ ok: true; json: unknown } | { ok: false; error: string }> {
  if (!SUPABASE_CONFIGURED) return { ok: false, error: NOT_CONFIGURED };
  try {
    const res = await adminFetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { ok: false, error: notificationErrorMessage(res.status, await errorCode(res)) };
    return { ok: true, json: await res.json() };
  } catch (error) {
    return { ok: false, error: failureMessage(error, 'The notifications service could not be reached.') };
  }
}

const run = async (body: Record<string, string>): Promise<ActionResult> => {
  const result = await post(body);
  return result.ok ? { ok: true } : result;
};

// Pending item: stop it from going out.
export const cancelNotification = (eventId: string) => run({ action: 'cancel', event_id: eventId });
// Held item: skip the debounce / review hold; it goes out at the next run.
export const releaseNotification = (eventId: string) => run({ action: 'release', event_id: eventId });
// Suggested update: queue the templated announcement.
export const announceUpdate = (updateEventId: string) => run({ action: 'announce', update_event_id: updateEventId });
// Suggested update: hide it without sending anything.
export const dismissSuggestion = (updateEventId: string) => run({ action: 'dismiss', update_event_id: updateEventId });

// Rendered FR / AR / EN copy + recipient estimate. Nothing is sent.
export async function previewNotification(
  target: NotificationTarget,
): Promise<{ ok: true; preview: NotificationPreview } | { ok: false; error: string }> {
  const result = await post({ action: 'preview', ...target });
  if (!result.ok) return result;
  try {
    return { ok: true, preview: parseNotificationPreview(result.json) };
  } catch (error) {
    return { ok: false, error: failureMessage(error, 'Invalid preview response') };
  }
}
