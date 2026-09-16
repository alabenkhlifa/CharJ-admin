import { useCallback, useEffect, useState } from "react";

// ── Driver visit reports (`charging_confirmations`) ───────────────────────
// Source: the admin-confirmations Edge Function. The table is service-role
// only — REVOKEd from anon/authenticated — so this cannot go through the
// normal supabase-js anon client like reviews/submissions do.

export type VisitOutcome = "charged" | "could_not_charge";

export type VisitFailureReason =
  | "not_working"
  | "access_denied"
  | "occupied"
  | "connector_problem"
  | "other";

export type Visit = {
  id: string;
  chargerId: string;
  chargerName: string;
  chargerCity: string;
  userId: string;
  outcome: VisitOutcome;
  reason: VisitFailureReason | null;
  connectorType: string | null;
  visitDate: string;
  submittedAt: string;
  hiddenAt: string | null;
  hiddenReason: string | null;
};

export type VisitSummary = {
  total: number;
  charged: number;
  couldNotCharge: number;
  hidden: number;
  last7Days: number;
  contributors: number;
};

export type VisitOutcomeFilter = "all" | VisitOutcome;
export type VisitVisibility = "visible" | "hidden" | "all";

type RawVisit = {
  id: string;
  charger_id: string;
  charger_name: string | null;
  charger_city: string | null;
  user_id: string;
  outcome: VisitOutcome;
  reason: VisitFailureReason | null;
  connector_type: string | null;
  visit_date: string;
  submitted_at: string;
  hidden_at: string | null;
  hidden_reason: string | null;
};

type RawResponse = {
  items: RawVisit[];
  page: number;
  perPage: number;
  total: number;
  summary: {
    total: number;
    charged: number;
    could_not_charge: number;
    hidden: number;
    last_7_days: number;
    contributors: number;
  };
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_API_SECRET ?? "";
const ADMIN_CONFIGURED = Boolean(SUPABASE_URL && ADMIN_SECRET);
const ENDPOINT = `${SUPABASE_URL}/functions/v1/admin-confirmations`;

const EMPTY_SUMMARY: VisitSummary = {
  total: 0,
  charged: 0,
  couldNotCharge: 0,
  hidden: 0,
  last7Days: 0,
  contributors: 0,
};

const mapVisit = (r: RawVisit): Visit => ({
  id: r.id,
  chargerId: r.charger_id,
  chargerName: r.charger_name ?? "Unknown charger",
  chargerCity: r.charger_city ?? "",
  userId: r.user_id,
  outcome: r.outcome,
  reason: r.reason,
  connectorType: r.connector_type,
  visitDate: r.visit_date,
  submittedAt: r.submitted_at,
  hiddenAt: r.hidden_at,
  hiddenReason: r.hidden_reason,
});

export const REASON_LABELS: Record<VisitFailureReason, string> = {
  not_working: "Charger not working",
  access_denied: "Access denied",
  occupied: "Occupied",
  connector_problem: "Connector problem",
  other: "Other",
};

// `visit_date` is a DATE ("2026-09-16"). Parsing it with `new Date()` treats
// it as UTC midnight, which renders as the previous day for anyone west of
// Greenwich. Format the parts by hand instead.
export const formatVisitDate = (value: string): string => {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

type UseVisitsState = {
  data: Visit[];
  summary: VisitSummary;
  total: number;
  loading: boolean;
  error: string | null;
};

export const useVisits = (
  page: number,
  perPage: number,
  outcome: VisitOutcomeFilter,
  visibility: VisitVisibility,
) => {
  const [state, setState] = useState<UseVisitsState>({
    data: [],
    summary: EMPTY_SUMMARY,
    total: 0,
    loading: true,
    error: null,
  });
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(() => setRevision((n) => n + 1), []);

  useEffect(() => {
    if (!ADMIN_CONFIGURED) {
      setState({
        data: [],
        summary: EMPTY_SUMMARY,
        total: 0,
        loading: false,
        error: "Admin API not configured. Set VITE_SUPABASE_URL + VITE_ADMIN_API_SECRET.",
      });
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);

    (async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const url = `${ENDPOINT}?page=${page}&perPage=${perPage}&outcome=${outcome}&visibility=${visibility}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${ADMIN_SECRET}` },
          signal: controller.signal,
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(
            res.status === 401
              ? "Your admin credentials could not be verified."
              : `HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
          );
        }
        const json = (await res.json()) as RawResponse;
        if (cancelled) return;
        setState({
          data: (json.items ?? []).map(mapVisit),
          summary: {
            total: json.summary?.total ?? 0,
            charged: json.summary?.charged ?? 0,
            couldNotCharge: json.summary?.could_not_charge ?? 0,
            hidden: json.summary?.hidden ?? 0,
            last7Days: json.summary?.last_7_days ?? 0,
            contributors: json.summary?.contributors ?? 0,
          },
          total: json.total ?? 0,
          loading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof DOMException && err.name === "AbortError"
            ? "Request timed out."
            : err instanceof Error
              ? err.message
              : String(err);
        setState({ data: [], summary: EMPTY_SUMMARY, total: 0, loading: false, error: msg });
      } finally {
        window.clearTimeout(timeout);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [page, perPage, outcome, visibility, revision]);

  return { ...state, refresh };
};

// Hide / unhide a single report. Resolves to an error string, or null on success.
export const moderateVisit = async (
  id: string,
  hidden: boolean,
  reason?: string,
): Promise<string | null> => {
  if (!ADMIN_CONFIGURED) return "Admin API not configured.";
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ADMIN_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id, hidden, reason: hidden ? reason : undefined }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return `HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`;
    }
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
};
