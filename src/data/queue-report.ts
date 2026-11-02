// ── The admin's to-do queue: what waits in Community ──────────────────────
// Four admin Edge Functions, one count + the newest items each:
//   feedback        admin-feedback          summary.open_requests (design votes are informational, never waiting)
//   couldNotCharge  admin-confirmations     summary.window.could_not_charge (7 days, hidden left out)
//   submissions     admin-submissions       counts.pending
//   reports         admin-review-reports    open
// Pure module (no runtime imports) so `node --test` can load it directly.
// A source that fails or answers in an unexpected shape is unknown (null),
// never a zero, and then the total is unknown too.

export type QueueKey = "feedback" | "couldNotCharge" | "submissions" | "reports";
export const QUEUE_KEYS: readonly QueueKey[] = ["feedback", "couldNotCharge", "submissions", "reports"];

const NEWEST = 3;

export const QUEUE_PATHS: Record<QueueKey, string> = {
  feedback: `admin-feedback?status=open&category=requests&page=1&perPage=${NEWEST}`,
  couldNotCharge: `admin-confirmations?since_days=7&outcome=could_not_charge&page=1&perPage=${NEWEST}`,
  submissions: `admin-submissions?status=pending&page=1&perPage=${NEWEST}`,
  reports: `admin-review-reports?status=open&page=1&perPage=${NEWEST}`,
};

/** Each row opens its Community tab already filtered to what waits. */
export const QUEUE_LINKS: Record<QueueKey, string> = {
  feedback: "#/community?tab=feedback&status=open",
  couldNotCharge: "#/community?tab=visits&outcome=could_not_charge&since=7",
  submissions: "#/community?tab=submissions&status=pending",
  reports: "#/community?tab=reviews&reports=open",
};

/** One newest item as a plain line: what it is, and when. */
export type QueueItem = { id: string; text: string; at: string };

export type Queue = {
  feedback: { open: number; newest: QueueItem[] } | null;
  couldNotCharge: { count: number; newest: QueueItem[] } | null;
  submissions: { pending: number; newest: QueueItem[] } | null;
  reports: { open: number; newest: QueueItem[] } | null;
  errors: Partial<Record<QueueKey, string>>;
  /** Everything waiting; null while any source is unknown. */
  total: number | null;
};

const BAD = "Unexpected response.";
const bad = (): never => {
  throw new Error(BAD);
};
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : bad();
const count = (value: unknown): number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : bad();
const str = (value: unknown): string => (typeof value === "string" ? value : bad());
const optional = (value: unknown): string | null => (typeof value === "string" ? value : null);
const items = <T>(value: unknown, map: (r: Record<string, unknown>) => T): T[] =>
  Array.isArray(value) ? value.slice(0, NEWEST).map((r: unknown) => map(object(r))) : bad();
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

const REPORT_REASONS: Record<string, string> = {
  spam: "Spam",
  inappropriate_language: "Inappropriate language",
  irrelevant: "Irrelevant",
  personal_info: "Personal info",
  other: "Other",
};

// feedback-report's INFORMATIONAL_CATEGORIES (repeated: this module has no runtime imports).
const INFORMATIONAL = new Set(["design"]);

const parseFeedback = (value: unknown): NonNullable<Queue["feedback"]> => {
  const r = object(value);
  const rows = Array.isArray(r.items) ? r.items.filter((f: unknown) => !INFORMATIONAL.has(String(object(f).category))) : r.items;
  return {
    open: count(object(r.summary).open_requests),
    newest: items(rows, (f) => {
      const message = oneLine(optional(f.message) ?? "");
      return { id: str(f.id), text: message ? `“${message}”` : "No message", at: str(f.created_at) };
    }),
  };
};

const parseCouldNotCharge = (value: unknown): NonNullable<Queue["couldNotCharge"]> => {
  const r = object(value);
  return {
    count: count(object(object(r.summary).window).could_not_charge),
    newest: items(r.items, (v) => ({
      id: str(v.id),
      text: oneLine(optional(v.charger_name) ?? "") || "Unknown charger",
      at: str(v.submitted_at),
    })),
  };
};

const parseSubmissions = (value: unknown): NonNullable<Queue["submissions"]> => {
  const r = object(value);
  return {
    pending: count(object(r.counts).pending),
    newest: items(r.items, (s) => ({
      id: str(s.id),
      text: oneLine(optional(s.name) ?? "") || "Unnamed charger",
      at: str(s.created_at),
    })),
  };
};

const parseReports = (value: unknown): NonNullable<Queue["reports"]> => {
  const r = object(value);
  return {
    open: count(r.open),
    newest: items(r.items, (p) => {
      const reason = str(p.reason);
      const rating = p.rating === null || p.rating === undefined ? null : object(p.rating);
      const charger = oneLine(optional(rating?.charger_name) ?? "");
      return {
        id: str(p.id),
        text: [REPORT_REASONS[reason] ?? reason, charger].filter(Boolean).join(" · "),
        at: str(p.created_at),
      };
    }),
  };
};

const settle = <T>(result: PromiseSettledResult<unknown>, parse: (v: unknown) => T): { value: T | null; error?: string } => {
  if (result.status === "rejected") {
    const reason: unknown = result.reason;
    return { value: null, error: reason instanceof Error ? reason.message : String(reason) };
  }
  try {
    return { value: parse(result.value) };
  } catch {
    return { value: null, error: BAD };
  }
};

/** Four settled responses (JSON bodies, or why they failed) → the queue. */
export const mergeQueue = (settled: Record<QueueKey, PromiseSettledResult<unknown>>): Queue => {
  const feedback = settle(settled.feedback, parseFeedback);
  const couldNotCharge = settle(settled.couldNotCharge, parseCouldNotCharge);
  const submissions = settle(settled.submissions, parseSubmissions);
  const reports = settle(settled.reports, parseReports);

  const errors: Partial<Record<QueueKey, string>> = {};
  if (feedback.error) errors.feedback = feedback.error;
  if (couldNotCharge.error) errors.couldNotCharge = couldNotCharge.error;
  if (submissions.error) errors.submissions = submissions.error;
  if (reports.error) errors.reports = reports.error;

  const counts = [feedback.value?.open, couldNotCharge.value?.count, submissions.value?.pending, reports.value?.open];
  const total = counts.every((n): n is number => typeof n === "number") ? counts.reduce((a, n) => a + n, 0) : null;

  return {
    feedback: feedback.value,
    couldNotCharge: couldNotCharge.value,
    submissions: submissions.value,
    reports: reports.value,
    errors,
    total,
  };
};

/** One source's count, or null when it is unknown. */
export const queueCount = (queue: Queue, key: QueueKey): number | null => {
  switch (key) {
    case "feedback":
      return queue.feedback?.open ?? null;
    case "couldNotCharge":
      return queue.couldNotCharge?.count ?? null;
    case "submissions":
      return queue.submissions?.pending ?? null;
    case "reports":
      return queue.reports?.open ?? null;
  }
};

/** "just now", "3h ago", "1d ago"; a date from 30 days on. */
export const timeAgo = (iso: string, now: number): string => {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return "";
  const seconds = Math.max(0, (now - at) / 1000);
  const days = Math.floor(seconds / 86_400);
  if (days >= 30) {
    return new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Tunis" });
  }
  if (days >= 1) return `${days}d ago`;
  const hours = Math.floor(seconds / 3600);
  return hours >= 1 ? `${hours}h ago` : "just now";
};
