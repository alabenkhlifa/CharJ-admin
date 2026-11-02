import { useCallback } from "react";
import { errorCode, getJson, postJson, useAdminLoad, type AdminLoad } from "./admin-load";
import {
  parseReviewResult,
  parseSubmissions,
  submissionActionMessage,
  submissionsPath,
  type ReviewAction,
  type ReviewResult,
  type SubmissionFilter,
  type SubmissionsPage,
} from "./submissions-report";

// ── Charger submissions inbox ──────────────────────────────────────────────
// Source: the admin-submissions Edge Function (approve creates the charger,
// reject keeps an optional note). Who reviewed and the note live in a
// service-role-only table, so this reads through adminFetch, not the anon client.

const ENDPOINT = "admin-submissions";

const errorFrom = (text: string): string | undefined => {
  try {
    return errorCode(JSON.parse(text));
  } catch {
    return undefined;
  }
};

/** One page of one status, with the per-status counts. */
export const useSubmissions = (status: SubmissionFilter, page: number): AdminLoad<SubmissionsPage> => {
  const load = useCallback(
    async (signal: AbortSignal) =>
      parseSubmissions(await getJson(submissionsPath(status, page), signal, (s, text) => submissionActionMessage(s, errorFrom(text)))),
    [status, page],
  );
  return useAdminLoad(load);
};

/** What the approved charger starts with; blank fields stay '' (never invented). */
export type ChargerTexts = { nameAr?: string; addressAr?: string; operator?: string };

export type ReviewOutcome =
  | { ok: true; result: ReviewResult }
  | { ok: false; status: number; message: string };

const blankToUndefined = (s: string | undefined) => (s && s.trim() ? s.trim() : undefined);

/** Approve (creates the charger) or reject one submission. */
export const reviewSubmission = async (
  id: string,
  action: ReviewAction,
  note?: string,
  texts: ChargerTexts = {},
): Promise<ReviewOutcome> => {
  const payload = {
    id,
    action,
    note: blankToUndefined(note),
    ...(action === "approve"
      ? { name_ar: blankToUndefined(texts.nameAr), address_ar: blankToUndefined(texts.addressAr), operator: blankToUndefined(texts.operator) }
      : {}),
  };
  const res = await postJson(ENDPOINT, payload);
  if (!res.ok) return { ok: false, status: res.status, message: res.error ?? submissionActionMessage(res.status, errorCode(res.body)) };
  try {
    return { ok: true, result: parseReviewResult(res.body) };
  } catch {
    return { ok: false, status: res.status, message: "The review went through, but its answer couldn't be read. Refresh to see it." };
  }
};
