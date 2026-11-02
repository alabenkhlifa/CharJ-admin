// ── Charger submissions (`community_submissions`) — shapes and parsing ────
// Source: the admin-submissions Edge Function (../charj/supabase/functions/admin-submissions).
//   GET  ?status=pending|approved|rejected|all&page&perPage → { items, page, perPage, total, counts }
//   POST { id, action: 'approve'|'reject', note?, name_ar?, address_ar?, operator? }
//        → { ok, submission_id, status, charger_id }; 409 already_reviewed; 422 { error: <reason> }
// Pure module (no runtime imports) so `node --test` can load it directly. A
// body in an unexpected shape throws: unknown, never drawn as zero.

export const SUBMISSION_STATUSES = ["pending", "approved", "rejected"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];
export type SubmissionFilter = SubmissionStatus | "all";
export const SUBMISSION_FILTERS: readonly SubmissionFilter[] = [...SUBMISSION_STATUSES, "all"];
export type ReviewAction = "approve" | "reject";

export const SUBMISSIONS_PER_PAGE = 25;

export type SubmissionConnector = {
  /** As the driver picked it ("Type 2", "CCS", "CHAdeMO"); '' when missing. */
  type: string;
  powerKw: number | null;
  count: number | null;
};

export type Submission = {
  id: string;
  /** The anonymous session that sent it ('' when blank). */
  submittedBy: string;
  name: string;
  address: string;
  connectors: SubmissionConnector[];
  /** The stored value when it isn't a list (old rows kept text the server couldn't decode). */
  connectorsRaw: string | null;
  photos: string[];
  notes: string;
  status: SubmissionStatus;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  /** The charger an approval created. */
  chargerId: string | null;
  appVersion: string;
  createdAt: string;
  /** Null when the row has no usable pin (never 0, 0). */
  lat: number | null;
  lng: number | null;
};

export type SubmissionCounts = Record<SubmissionStatus, number>;

export type SubmissionsPage = {
  items: Submission[];
  page: number;
  perPage: number;
  total: number;
  counts: SubmissionCounts;
};

export type ReviewResult = {
  submissionId: string;
  status: Exclude<SubmissionStatus, "pending">;
  /** The new charger on approve; null on reject. */
  chargerId: string | null;
};

const BAD = "Unexpected response.";
const bad = (): never => {
  throw new Error(BAD);
};
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const object = (value: unknown): Record<string, unknown> => (isObject(value) ? value : bad());
const count = (value: unknown): number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : bad();
const str = (value: unknown): string => (typeof value === "string" ? value : "");
const strOrNull = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const finite = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
const positive = (value: unknown): number | null => {
  const n = finite(value);
  return n !== null && n > 0 ? n : null;
};

const parseConnector = (raw: unknown): SubmissionConnector | null => {
  if (!isObject(raw)) return null;
  const n = positive(raw.count);
  return { type: str(raw.type).trim(), powerKw: positive(raw.power_kw), count: n !== null && Number.isInteger(n) ? n : null };
};

const isStatus = (value: unknown): value is SubmissionStatus =>
  typeof value === "string" && (SUBMISSION_STATUSES as readonly string[]).includes(value);

const parseItem = (raw: unknown): Submission | null => {
  if (!isObject(raw) || typeof raw.id !== "string" || !raw.id) return null;
  const list = Array.isArray(raw.connectors) ? raw.connectors : null;
  const lat = finite(raw.lat);
  const lng = finite(raw.lng);
  const pinned = lat !== null && lng !== null;
  return {
    id: raw.id,
    submittedBy: str(raw.submitted_by).trim(),
    name: str(raw.name).trim(),
    address: str(raw.address).trim(),
    connectors: (list ?? []).map(parseConnector).filter((c): c is SubmissionConnector => c !== null),
    connectorsRaw: list ? null : raw.connectors == null ? null : typeof raw.connectors === "string" ? raw.connectors : JSON.stringify(raw.connectors),
    photos: Array.isArray(raw.photos) ? raw.photos.filter((p): p is string => typeof p === "string" && p !== "") : [],
    notes: str(raw.notes),
    status: isStatus(raw.status) ? raw.status : "pending",
    reviewedAt: strOrNull(raw.reviewed_at),
    reviewedBy: strOrNull(raw.reviewed_by),
    reviewNote: strOrNull(raw.review_note),
    chargerId: strOrNull(raw.charger_id),
    appVersion: str(raw.app_version),
    createdAt: str(raw.created_at),
    lat: pinned ? lat : null,
    lng: pinned ? lng : null,
  };
};

/** admin-submissions GET → one page of submissions and the per-status counts. */
export const parseSubmissions = (raw: unknown): SubmissionsPage => {
  const body = object(raw);
  const counts = object(body.counts);
  if (!Array.isArray(body.items)) bad();
  return {
    items: (body.items as unknown[]).map(parseItem).filter((s): s is Submission => s !== null),
    page: finite(body.page) ?? 1,
    perPage: finite(body.perPage) ?? SUBMISSIONS_PER_PAGE,
    total: count(body.total ?? 0),
    counts: { pending: count(counts.pending), approved: count(counts.approved), rejected: count(counts.rejected) },
  };
};

/** admin-submissions POST 200 → what the review did. */
export const parseReviewResult = (raw: unknown): ReviewResult => {
  const body = object(raw);
  if (body.ok !== true || typeof body.submission_id !== "string") bad();
  if (body.status !== "approved" && body.status !== "rejected") bad();
  return {
    submissionId: body.submission_id as string,
    status: body.status as ReviewResult["status"],
    chargerId: typeof body.charger_id === "string" && body.charger_id ? body.charger_id : null,
  };
};

export const submissionsPath = (status: SubmissionFilter, page: number): string =>
  `admin-submissions?status=${status}&page=${page}&perPage=${SUBMISSIONS_PER_PAGE}`;

const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

/** "2 × Type 2 · 22 kW", as far as the driver filled it in. */
export const connectorLine = (c: SubmissionConnector): string => {
  const what = c.type || "Unknown type";
  const power = c.powerKw === null ? "power not given" : `${nf.format(c.powerKw)} kW`;
  return c.count === null ? `${what} · ${power}` : `${c.count} × ${what} · ${power}`;
};

// The admin_review_submission reasons (migrations 20261102000007 / 000008), in plain words.
const REASONS: Record<string, string> = {
  already_reviewed: "Someone already reviewed this",
  name_missing: "This submission has no name, so it can't become a charger.",
  name_too_long: "The name is longer than the chargers table allows.",
  address_too_long: "The address is longer than the chargers table allows.",
  connectors_invalid:
    "The connectors can't be used as they are: each needs a type (Type 2, CCS or CHAdeMO), a power above 0 and a count.",
  location_invalid: "The pin isn't a valid location.",
  city_not_found: "No city matches this location. Check the pin, or add the city in Chargers first.",
  note_too_long: "The note is too long (2,000 characters at most).",
  name_ar_too_long: "The Arabic name is too long (200 characters at most).",
  address_ar_too_long: "The Arabic address is too long (200 characters at most).",
  operator_too_long: "The operator is too long (200 characters at most).",
  admin_required: "This action needs a signed-in admin.",
  invalid_action: "The server didn't understand this action.",
  invalid_submission: "This submission can't become a charger.",
};

/**
 * What an approve or reject answer means, in plain words. `reason` is the
 * server's `error` code when it sent one (422 carries why).
 */
export const submissionActionMessage = (status: number, reason?: string): string => {
  if (status === 409) return REASONS.already_reviewed;
  if (status === 404) return "This submission no longer exists.";
  if (status === 422) {
    if (reason && REASONS[reason]) return REASONS[reason];
    return reason ? `This submission can't become a charger (${reason}).` : REASONS.invalid_submission;
  }
  if (status === 401) return "Your admin credentials could not be verified.";
  if (status === 403) return "This action needs a signed-in admin.";
  if (status === 400) return "The server refused this request.";
  if (status === 503) return "Submissions are unavailable right now. Try again.";
  return `Something went wrong (HTTP ${status}). Try again.`;
};

// ── Nearby check: a charger already within 100 m is probably this one ────

const EARTH_M = 6_371_008.8;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Haversine distance in metres. */
export const distanceMeters = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(a)));
};

export type NearbyCharger = { id: string; name: string; meters: number };

export const NEARBY_METERS = 100;

/** Chargers within `radius` metres of the pin, nearest first, distance rounded to the metre. */
export const nearbyChargers = (
  lat: number,
  lng: number,
  chargers: readonly { id: string; name: string; lat: number; lng: number }[],
  radius = NEARBY_METERS,
): NearbyCharger[] =>
  chargers
    .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng))
    .map((c) => ({ id: c.id, name: c.name, meters: distanceMeters(lat, lng, c.lat, c.lng) }))
    .filter((c) => c.meters <= radius)
    .sort((a, b) => a.meters - b.meters)
    .map((c) => ({ ...c, meters: Math.round(c.meters) }));

/** The pin on Google Maps (a link, not a second live map). */
export const mapsUrl = (lat: number, lng: number): string =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;

// ── Photos ──
// Anyone can send a submission, so its photo URLs are untrusted: an outside
// URL would load from the admin's browser (a tracking pixel: their IP and the
// time) or be a link dressed as "Photo 1". Only the app's own uploads are
// shown: this project's public charger-photos bucket, the same rule
// admin_review_submission uses before it copies photos onto a charger
// (../charj/supabase/migrations/20261102000008_submission_reviews_private.sql).

/** Where the app uploads a submission's photos: `<project URL>/storage/v1/object/public/charger-photos/`. */
export const appPhotoPrefix = (supabaseUrl: string): string => `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/charger-photos/`;

const isAppPhoto = (url: string, prefix: string): boolean => {
  if (!url.startsWith(prefix) || url.length === prefix.length) return false;
  // Belt and braces: the parsed URL must still be that host and bucket.
  try {
    const at = new URL(url);
    const base = new URL(prefix);
    return at.origin === base.origin && at.pathname.startsWith(base.pathname);
  } catch {
    return false;
  }
};

/** A submission's photos split into the app's own uploads (safe to load) and how many point anywhere else. */
export const splitPhotos = (photos: string[], supabaseUrl: string): { app: string[]; other: number } => {
  const prefix = supabaseUrl ? appPhotoPrefix(supabaseUrl) : null;
  const app = prefix ? photos.filter((p) => isAppPhoto(p, prefix)) : [];
  return { app, other: photos.length - app.length };
};

/** "1 photo not from the app", "2 photos not from the app"; null when there are none. */
export const otherPhotosLine = (n: number): string | null =>
  n > 0 ? `${n.toLocaleString("en-US")} ${n === 1 ? "photo" : "photos"} not from the app` : null;
