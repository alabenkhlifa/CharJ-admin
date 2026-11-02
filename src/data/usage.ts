import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "../lib/admin-fetch";
import { SUPABASE_CONFIGURED } from "../lib/supabase";
import {
  parseUsageReport,
  type UsageDays,
  type UsageEnvironment,
  type UsageReportFor,
  type UsageView,
} from "./usage-report";

// ── Usage reports (Summary and Usage pages) ────────────────────────────────
// Source: the admin-usage Edge Function. Raw analytics events are
// service-role only, so this cannot go through the anon supabase-js client.

const NOT_CONFIGURED = "Admin API not configured. Set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.";
const UNAVAILABLE = "Usage reporting is unavailable right now.";

type State<V extends UsageView> = {
  data: UsageReportFor<V> | null;
  loading: boolean;
  error: string | null;
  requestKey: string;
};

/**
 * `enabled: false` skips the request (a Usage drill-in that doesn't read the
 * report, such as Users) and reports neither loading nor an error.
 */
export const useUsage = <V extends UsageView>(
  view: V,
  days: UsageDays,
  environment: UsageEnvironment,
  { enabled = true }: { enabled?: boolean } = {},
) => {
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);
  const requestKey = JSON.stringify([view, days, environment, revision]);
  const [state, setState] = useState<State<V>>({ data: null, loading: true, error: null, requestKey: "" });

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      try {
        if (!SUPABASE_CONFIGURED) throw new Error(NOT_CONFIGURED);
        const res = await adminFetch(`admin-usage?view=${view}&days=${days}&environment=${environment}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(res.status === 401 ? "Your admin credentials could not be verified." : UNAVAILABLE);
        }
        const data = parseUsageReport(view, await res.json());
        if (data.environment !== environment) throw new Error("Invalid usage report");
        if (active) setState({ data: data as UsageReportFor<V>, loading: false, error: null, requestKey });
      } catch (err) {
        if (!active) return;
        const message =
          err instanceof DOMException && err.name === "AbortError"
            ? "Request timed out."
            : err instanceof Error
              ? err.message
              : UNAVAILABLE;
        setState({ data: null, loading: false, error: message, requestKey });
      } finally {
        clearTimeout(timeout);
      }
    });
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [view, days, environment, requestKey, enabled]);

  // A new request (another environment, or a retry) shows loading at once
  // rather than the previous environment's numbers.
  const current = !enabled
    ? { data: null, loading: false, error: null }
    : state.requestKey === requestKey
      ? state
      : { data: null, loading: true, error: null };
  return { data: current.data, loading: current.loading, error: current.error, refresh };
};
