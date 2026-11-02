// ── Review reports (`review_reports`) — shapes and parsing ────────────────
// Source: the admin-review-reports Edge Function (../charj/supabase/functions/admin-review-reports).
//   GET  ?status=open|resolved|all&page&perPage → { items, page, perPage, total, open }
//   POST { id, resolved } → { ok, item }. Nothing is hidden or deleted.
// Pure module (no runtime imports) so `node --test` can load it directly. A
// body in an unexpected shape throws: unknown, never drawn as zero.

export const REPORT_STATUSES = ["open", "resolved", "all"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORTS_PER_PAGE = 25;

/** The app's review_report_reason enum (20260422000001_review_reports.sql). */
export const REPORT_REASON_LABELS: Record<string, string> = {
  spam: "Spam",
  inappropriate_language: "Inappropriate language",
  irrelevant: "Irrelevant",
  personal_info: "Personal info",
  other: "Other",
};

export type ReportedReview = {
  id: string;
  /** 1–5. */
  stars: number;
  comment: string;
  createdAt: string;
  chargerId: string;
  /** '' when the charger has no name (or is gone). */
  chargerName: string;
};

export type ReviewReport = {
  id: string;
  reason: string;
  reasonLabel: string;
  /** What the reporter wrote; may be empty. */
  notes: string;
  createdAt: string;
  resolved: boolean;
  /** Null when the review no longer exists. */
  review: ReportedReview | null;
};

export type ReviewReportsPage = {
  items: ReviewReport[];
  page: number;
  perPage: number;
  total: number;
  /** Every unresolved report, whatever the filter. */
  open: number;
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
const finite = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

const parseReview = (raw: unknown): ReportedReview | null => {
  if (!isObject(raw) || typeof raw.id !== "string") return null;
  const stars = finite(raw.rating);
  return {
    id: raw.id,
    stars: stars === null ? 0 : Math.min(5, Math.max(1, Math.round(stars))),
    comment: str(raw.comment),
    createdAt: str(raw.created_at),
    chargerId: str(raw.charger_id),
    chargerName: str(raw.charger_name).trim(),
  };
};

/** One report as the list and the POST return it; null without an id. */
export const parseReportItem = (raw: unknown): ReviewReport | null => {
  if (!isObject(raw) || typeof raw.id !== "string" || !raw.id) return null;
  const reason = str(raw.reason);
  return {
    id: raw.id,
    reason,
    reasonLabel: REPORT_REASON_LABELS[reason] ?? reason,
    notes: str(raw.notes),
    createdAt: str(raw.created_at),
    resolved: raw.resolved === true,
    review: parseReview(raw.rating),
  };
};

/** admin-review-reports GET → one page of reports and the open count. */
export const parseReviewReports = (raw: unknown): ReviewReportsPage => {
  if (!isObject(raw) || !Array.isArray(raw.items)) bad();
  const body = raw as Record<string, unknown>;
  return {
    items: (body.items as unknown[]).map(parseReportItem).filter((r): r is ReviewReport => r !== null),
    page: finite(body.page) ?? 1,
    perPage: finite(body.perPage) ?? REPORTS_PER_PAGE,
    total: count(body.total ?? 0),
    open: count(body.open),
  };
};

export const reportsPath = (status: ReportStatus, page: number): string =>
  `admin-review-reports?status=${status}&page=${page}&perPage=${REPORTS_PER_PAGE}`;

export const reportErrorMessage = (status: number): string => {
  if (status === 401) return "Your admin credentials could not be verified.";
  if (status === 403) return "This action needs a signed-in admin.";
  if (status === 404) return "That report no longer exists.";
  if (status === 400) return "The server refused this request.";
  if (status === 503) return "Review reports are unavailable right now. Try again.";
  return `Something went wrong (HTTP ${status}). Try again.`;
};
