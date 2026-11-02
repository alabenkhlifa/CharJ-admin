import { useCallback } from "react";
import { errorCode, getJson, postJson, useAdminLoad, type AdminLoad } from "./admin-load";
import {
  designTally,
  feedbackErrorMessage,
  feedbackPath,
  parseFeedbackItem,
  parseFeedbackStrict,
  uniqueById,
  type DesignTally,
  type FeedbackCategoryFilter,
  type FeedbackItem,
  type FeedbackResponse,
  type FeedbackStatus,
} from "./feedback-report";

// ── App feedback inbox ─────────────────────────────────────────────────────
// Source: the admin-feedback Edge Function. `feedback` is service-role only
// (the app inserts with the anon key, nobody else can read it), so it goes
// through adminFetch, never the anon supabase-js client.

const ENDPOINT = "admin-feedback";

/** One page of one status and category, with the all-time summary. */
export const useFeedback = (status: FeedbackStatus, category: FeedbackCategoryFilter, page: number): AdminLoad<FeedbackResponse> => {
  const load = useCallback(
    async (signal: AbortSignal) => parseFeedbackStrict(await getJson(feedbackPath(status, category, page), signal, feedbackErrorMessage)),
    [status, category, page],
  );
  return useAdminLoad(load);
};

// The tally reads every design vote, newest first, up to this many.
const VOTE_PAGE = 100;
const VOTE_PAGES = 5;

const loadDesignVotes = async (signal: AbortSignal): Promise<DesignTally> => {
  const items: FeedbackItem[] = [];
  let total = 0;
  for (let page = 1; page <= VOTE_PAGES; page += 1) {
    const body = parseFeedbackStrict(await getJson(feedbackPath("all", "design", page, VOTE_PAGE), signal, feedbackErrorMessage));
    total = body.total;
    items.push(...body.items);
    if (body.items.length < VOTE_PAGE || items.length >= total) break;
  }
  // A vote that arrives while paging shifts the pages by one: the same row can come twice.
  const unique = uniqueById(items);
  return designTally(unique, Math.max(total, unique.length));
};

/** Design (Lune) votes as a tally: informational, never part of the queue. */
export const useDesignVotes = (): AdminLoad<DesignTally> => useAdminLoad(loadDesignVotes);

/** Resolve or reopen one row: the updated row, or why it failed. */
export const setFeedbackResolved = async (
  id: string,
  resolved: boolean,
): Promise<{ ok: true; item: FeedbackItem | null } | { ok: false; message: string }> => {
  const res = await postJson(ENDPOINT, { id, resolved });
  if (!res.ok) return { ok: false, message: res.error ?? feedbackErrorMessage(res.status, errorCode(res.body) ?? "") };
  const body = res.body;
  const item = body !== null && typeof body === "object" && "item" in body ? parseFeedbackItem(body.item) : null;
  return { ok: true, item };
};
