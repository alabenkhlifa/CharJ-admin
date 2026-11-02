// ── App feedback (`feedback`) — shapes and parsing ─────────────────────────
// Source: the admin-feedback Edge Function (../charj/supabase/functions/admin-feedback).
// Pure module (no imports at runtime) so `node --test` can load it directly.

export const FEEDBACK_CATEGORIES = ["bug", "suggestion", "compliment", "charger_data", "other", "design"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];
/** The Lune design card's thumbs up / down, with an optional comment. */
export type FeedbackVote = "up" | "down";
export type FeedbackStatus = "open" | "resolved" | "all";
/** `requests`: every category but the informational ones (admin-feedback). */
export type FeedbackCategoryFilter = "all" | "requests" | FeedbackCategory;

export type FeedbackItem = {
  id: string;
  deviceId: string;
  category: FeedbackCategory;
  /** Design votes only; null for every other category. */
  vote: FeedbackVote | null;
  /** May be empty for a design vote (the comment is optional). */
  message: string;
  email: string;
  appVersion: string;
  platform: string;
  locale: string;
  resolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
};

export type FeedbackSummary = {
  total: number;
  open: number;
  /** Open rows that ask for something: design votes left out. */
  openRequests: number;
  resolved: number;
  last7Days: number;
  byCategory: Record<FeedbackCategory, number>;
};

export type FeedbackResponse = { items: FeedbackItem[]; total: number; summary: FeedbackSummary };

export const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: "Bug",
  suggestion: "Suggestion",
  compliment: "Compliment",
  charger_data: "Charger data",
  other: "Other",
  design: "Design (Lune)",
};

export const VOTE_LABELS: Record<FeedbackVote, string> = {
  up: "Likes it",
  down: "Doesn't like it",
};

/** Design votes inform, they ask for nothing: never counted as waiting (admin-feedback `category=requests`). */
export const INFORMATIONAL_CATEGORIES: readonly FeedbackCategory[] = ["design"];
export const isInformational = (item: Pick<FeedbackItem, "category">): boolean =>
  INFORMATIONAL_CATEGORIES.includes(item.category);

export const CATEGORY_COLORS: Record<FeedbackCategory, string> = {
  bug: "var(--red)",
  suggestion: "var(--blue)",
  compliment: "var(--green)",
  charger_data: "var(--amber)",
  other: "var(--slate)",
  design: "var(--violet)",
};

const ZERO_BY_CATEGORY = (): Record<FeedbackCategory, number> =>
  Object.fromEntries(FEEDBACK_CATEGORIES.map((c) => [c, 0])) as Record<FeedbackCategory, number>;

export const EMPTY_FEEDBACK_SUMMARY: FeedbackSummary = {
  total: 0,
  open: 0,
  openRequests: 0,
  resolved: 0,
  last7Days: 0,
  byCategory: ZERO_BY_CATEGORY(),
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const str = (value: unknown): string => (typeof value === "string" ? value : "");
const strOrNull = (value: unknown): string | null => (typeof value === "string" ? value : null);
const num = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);
const isCategory = (value: unknown): value is FeedbackCategory =>
  typeof value === "string" && (FEEDBACK_CATEGORIES as readonly string[]).includes(value);

export const parseFeedbackItem = (raw: unknown): FeedbackItem | null => {
  if (!isObject(raw) || typeof raw.id !== "string") return null;
  return {
    id: raw.id,
    deviceId: str(raw.device_id),
    category: isCategory(raw.category) ? raw.category : "other",
    vote: raw.vote === "up" || raw.vote === "down" ? raw.vote : null,
    message: str(raw.message),
    email: str(raw.email).trim(),
    appVersion: str(raw.app_version),
    platform: str(raw.platform),
    locale: str(raw.locale),
    resolved: raw.resolved === true,
    resolvedAt: strOrNull(raw.resolved_at),
    resolvedBy: strOrNull(raw.resolved_by),
    createdAt: str(raw.created_at),
  };
};

export const parseFeedbackResponse = (raw: unknown): FeedbackResponse => {
  const body = isObject(raw) ? raw : {};
  const summary = isObject(body.summary) ? body.summary : {};
  const byCategory = isObject(summary.by_category) ? summary.by_category : {};
  const items = (Array.isArray(body.items) ? body.items : [])
    .map(parseFeedbackItem)
    .filter((item): item is FeedbackItem => item !== null);
  return {
    items,
    total: num(body.total),
    summary: {
      total: num(summary.total),
      open: num(summary.open),
      openRequests: num(summary.open_requests ?? summary.open),
      resolved: num(summary.resolved),
      last7Days: num(summary.last_7_days),
      byCategory: Object.fromEntries(FEEDBACK_CATEGORIES.map((c) => [c, num(byCategory[c])])) as Record<FeedbackCategory, number>,
    },
  };
};

// "android · 1.3.0 · fr" — whatever the app sent, skipping blanks.
export const deviceLine = (item: FeedbackItem): string =>
  [item.platform, item.appVersion, item.locale].filter(Boolean).join(" · ") || "—";

export const feedbackErrorMessage = (status: number, text: string): string => {
  if (status === 401) return "Your admin credentials could not be verified.";
  if (status === 403) return "This action needs a signed-in admin.";
  if (status === 404) return "That feedback no longer exists.";
  if (status === 503) return "The feedback inbox is unavailable right now. Try again.";
  return `HTTP ${status}${text ? `: ${text.slice(0, 200)}` : ""}`;
};
