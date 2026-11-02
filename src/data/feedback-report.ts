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
  /**
   * Open rows that ask for something: design votes left out. Null when the
   * server doesn't send it (an admin-feedback older than open_requests):
   * `open` counts the votes too, so it is no stand-in.
   */
  openRequests: number | null;
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
const countOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
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
      openRequests: countOrNull(summary.open_requests),
      resolved: num(summary.resolved),
      last7Days: num(summary.last_7_days),
      byCategory: Object.fromEntries(FEEDBACK_CATEGORIES.map((c) => [c, num(byCategory[c])])) as Record<FeedbackCategory, number>,
    },
  };
};

/**
 * parseFeedbackResponse for a page that shows counts: a body without its
 * items list or summary throws ("Couldn't load"), rather than reading as an
 * empty inbox.
 */
export const parseFeedbackStrict = (raw: unknown): FeedbackResponse => {
  if (!isObject(raw) || !Array.isArray(raw.items) || !isObject(raw.summary)) throw new Error("Unexpected response.");
  return parseFeedbackResponse(raw);
};

export const FEEDBACK_PER_PAGE = 25;

export const feedbackPath = (
  status: FeedbackStatus,
  category: FeedbackCategoryFilter,
  page: number,
  perPage: number = FEEDBACK_PER_PAGE,
): string => `admin-feedback?status=${status}&category=${category}&page=${page}&perPage=${perPage}`;

// ── Design (Lune) votes: a tally, never a queue item ──────────────────────

export type DesignTally = {
  up: number;
  down: number;
  /** Thumbs counted (up + down). */
  votes: number;
  /** Design rows the server has; more than `votes` when only the newest were read. */
  total: number;
  /** Newest first, with a comment, at most five. */
  comments: FeedbackItem[];
  /** Per platform, most votes first; null when no vote says its platform. */
  platforms: { platform: string; up: number; down: number }[] | null;
  /** created_at of every design row read (a row without a thumb included), newest first. */
  rowTimes: string[];
  /** Every design row on the server was read. */
  complete: boolean;
};

const LATEST_COMMENTS = 5;

/** Count design votes: thumbs, the latest comments, and a platform split when the rows carry one. */
export const designTally = (items: readonly FeedbackItem[], total: number): DesignTally => {
  const rows = items.filter((i) => i.category === "design");
  const votes = rows.filter((i) => i.vote !== null);
  const up = votes.filter((v) => v.vote === "up").length;
  const byPlatform = new Map<string, { up: number; down: number }>();
  for (const v of votes) {
    const key = v.platform.trim().toLowerCase();
    if (!key) continue;
    const row = byPlatform.get(key) ?? { up: 0, down: 0 };
    row[v.vote === "up" ? "up" : "down"] += 1;
    byPlatform.set(key, row);
  }
  const platforms = byPlatform.size
    ? [...byPlatform].map(([platform, n]) => ({ platform, ...n })).sort((a, b) => b.up + b.down - (a.up + a.down) || a.platform.localeCompare(b.platform))
    : null;
  return {
    up,
    down: votes.length - up,
    votes: votes.length,
    total,
    comments: votes
      .filter((v) => v.message.trim() !== "")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, LATEST_COMMENTS),
    platforms,
    rowTimes: rows.map((r) => r.createdAt).sort((a, b) => b.localeCompare(a)),
    complete: rows.length >= total,
  };
};

/** The first copy of each id: a page read while rows arrive can repeat one. */
export const uniqueById = <T extends { id: string }>(rows: readonly T[]): T[] => {
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
};

export type RequestStats = {
  /** Open requests; null when the server doesn't count them. */
  open: number | null;
  resolved: number | null;
  /** Requests received in the last 7 days; null when the votes read can't say how many of the week's rows were votes. */
  last7: number | null;
  total: number;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The summary's counts without the design votes: a vote never waits, so the
 * stats count requests only. All-time and resolved come straight from the
 * summary; the 7-day count needs the votes' own dates (`tally`), and is exact
 * only when the votes read reach back past the week (or are all of them).
 */
export const requestStats = (summary: FeedbackSummary, tally: DesignTally | null, now: number): RequestStats => {
  const total = Math.max(0, summary.total - summary.byCategory.design);
  const open = summary.openRequests;
  const since = now - WEEK_MS;
  const oldest = tally?.rowTimes.at(-1);
  const reachesBack = tally !== null && (tally.complete || (oldest !== undefined && Date.parse(oldest) < since));
  const votesThisWeek = tally ? tally.rowTimes.filter((t) => Date.parse(t) >= since).length : 0;
  return {
    open,
    resolved: open === null ? null : Math.max(0, total - open),
    last7: reachesBack ? Math.max(0, summary.last7Days - votesThisWeek) : null,
    total,
  };
};

/** "Open (3)" / "Resolved (1)" for the category shown; null where the server has no per-status count. */
export const statusCounts = (
  summary: FeedbackSummary,
  stats: RequestStats,
  category: FeedbackCategoryFilter,
): { open: number | null; resolved: number | null } | null => {
  if (category === "requests") return { open: stats.open, resolved: stats.resolved };
  if (category === "all") return { open: summary.open, resolved: summary.resolved };
  return null;
};

// "android · 1.3.0 · fr" — whatever the app sent, skipping blanks.
export const deviceLine = (item: FeedbackItem): string =>
  [item.platform, item.appVersion, item.locale].filter(Boolean).join(" · ") || "—";

export const feedbackErrorMessage = (status: number, text: string): string => {
  if (status === 401) return "Your admin credentials could not be verified.";
  if (status === 403) return "This action needs a signed-in admin.";
  if (status === 404) return "That feedback no longer exists.";
  if (status === 400) return "The feedback function refused this request (HTTP 400).";
  if (status === 503) return "The feedback inbox is unavailable right now. Try again.";
  return `HTTP ${status}${text ? `: ${text.slice(0, 200)}` : ""}`;
};
