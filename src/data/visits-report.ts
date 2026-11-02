// ── Driver visit reports (`charging_confirmations`) — shapes and parsing ──
// Source: the admin-confirmations Edge Function (../charj/supabase/functions/admin-confirmations).
//   GET  ?page&perPage&outcome=all|charged|could_not_charge&visibility=visible|hidden|all[&since_days=1..90]
//        → { items, page, perPage, total, summary } (summary is all-time; since_days adds summary.window)
//   POST { id, hidden, reason? } → hide / unhide one report (a reason is required to hide)
// Pure module (only pure imports) so `node --test` can load it directly. A
// body in an unexpected shape throws: unknown, never drawn as zero.

import { MONTHS } from "../lib/health-format.ts";

export type VisitOutcome = "charged" | "could_not_charge";
export type VisitFailureReason = "not_working" | "access_denied" | "occupied" | "connector_problem" | "other";
export type VisitOutcomeFilter = "all" | VisitOutcome;
export type VisitVisibility = "visible" | "hidden" | "all";
/** A visit-date window in days; null = all time. */
export type VisitWindow = 7 | 30 | 90 | null;

export const VISIT_OUTCOMES: readonly VisitOutcomeFilter[] = ["all", "charged", "could_not_charge"];
export const VISIT_VISIBILITIES: readonly VisitVisibility[] = ["visible", "hidden", "all"];
export const VISIT_WINDOWS: readonly Exclude<VisitWindow, null>[] = [7, 30, 90];
export const VISITS_PER_PAGE = 25;

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

export type VisitsPage = {
  items: Visit[];
  total: number;
  summary: VisitSummary;
  /** Visible "couldn't charge" reports inside the asked window; null when no window was asked. */
  windowCouldNotCharge: number | null;
};

export type VisitsView = {
  outcome: VisitOutcomeFilter;
  visibility: VisitVisibility;
  since: VisitWindow;
  page: number;
};

export const REASON_LABELS: Record<VisitFailureReason, string> = {
  not_working: "Charger not working",
  access_denied: "Access denied",
  occupied: "Occupied",
  connector_problem: "Connector problem",
  other: "Other",
};

const BAD = "Unexpected response.";
const bad = (): never => {
  throw new Error(BAD);
};
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const count = (value: unknown): number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : bad();
const str = (value: unknown): string => (typeof value === "string" ? value : "");
const strOrNull = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const isReason = (value: unknown): value is VisitFailureReason =>
  typeof value === "string" && Object.hasOwn(REASON_LABELS, value);

const parseVisit = (raw: unknown): Visit | null => {
  if (!isObject(raw) || typeof raw.id !== "string" || !raw.id) return null;
  return {
    id: raw.id,
    chargerId: str(raw.charger_id),
    chargerName: str(raw.charger_name).trim() || "Unknown charger",
    chargerCity: str(raw.charger_city).trim(),
    userId: str(raw.user_id),
    outcome: raw.outcome === "could_not_charge" ? "could_not_charge" : "charged",
    reason: isReason(raw.reason) ? raw.reason : null,
    connectorType: strOrNull(raw.connector_type),
    visitDate: str(raw.visit_date),
    submittedAt: str(raw.submitted_at),
    hiddenAt: strOrNull(raw.hidden_at),
    hiddenReason: strOrNull(raw.hidden_reason),
  };
};

/** admin-confirmations GET → one page of visits and the all-time summary. */
export const parseVisits = (raw: unknown): VisitsPage => {
  if (!isObject(raw) || !Array.isArray(raw.items) || !isObject(raw.summary)) bad();
  const body = raw as Record<string, unknown>;
  const s = body.summary as Record<string, unknown>;
  return {
    items: (body.items as unknown[]).map(parseVisit).filter((v): v is Visit => v !== null),
    total: count(body.total ?? 0),
    summary: {
      total: count(s.total),
      charged: count(s.charged),
      couldNotCharge: count(s.could_not_charge),
      hidden: count(s.hidden),
      last7Days: count(s.last_7_days),
      contributors: count(s.contributors),
    },
    windowCouldNotCharge: isObject(s.window) ? count(s.window.could_not_charge) : null,
  };
};

export const visitsPath = ({ outcome, visibility, since, page }: VisitsView): string =>
  `admin-confirmations?page=${page}&perPage=${VISITS_PER_PAGE}&outcome=${outcome}&visibility=${visibility}${since ? `&since_days=${since}` : ""}`;

export const visitErrorMessage = (status: number, text: string): string => {
  if (status === 401) return "Your admin credentials could not be verified.";
  if (status === 403) return "This action needs a signed-in admin.";
  if (status === 400) return text.includes("reason") ? "Hiding a report needs a reason of 1 to 500 characters." : "The server refused this request.";
  return `Something went wrong (HTTP ${status}). Try again.`;
};

// `visit_date` is a DATE ("2026-09-16"): format the parts by hand, never
// through `new Date()` (UTC midnight renders as the day before west of Greenwich).
export const formatVisitDate = (value: string): string => {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d || m > 12) return value;
  return `${d} ${MONTHS[m - 1]} ${y}`;
};
