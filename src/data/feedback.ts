import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "../lib/admin-fetch";
import { SUPABASE_CONFIGURED } from "../lib/supabase";
import {
  EMPTY_FEEDBACK_SUMMARY,
  feedbackErrorMessage,
  parseFeedbackResponse,
  type FeedbackCategoryFilter,
  type FeedbackItem,
  type FeedbackStatus,
  type FeedbackSummary,
} from "./feedback-report";

// ── App feedback inbox ─────────────────────────────────────────────────────
// Source: the admin-feedback Edge Function. `feedback` is service-role only
// (the app inserts with the anon key, nobody else can read it), so this cannot
// go through the anon supabase-js client like reviews/submissions do.

const ENDPOINT = "admin-feedback";
const NOT_CONFIGURED = "Admin API not configured. Set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.";

type UseFeedbackState = {
  data: FeedbackItem[];
  summary: FeedbackSummary;
  total: number;
  loading: boolean;
  error: string | null;
};

export const useFeedback = (
  page: number,
  perPage: number,
  status: FeedbackStatus,
  category: FeedbackCategoryFilter,
) => {
  // Unconfigured is known before the first render: start in that state rather than setting it from the effect.
  const [state, setState] = useState<UseFeedbackState>({
    data: [],
    summary: EMPTY_FEEDBACK_SUMMARY,
    total: 0,
    loading: SUPABASE_CONFIGURED,
    error: SUPABASE_CONFIGURED ? null : NOT_CONFIGURED,
  });
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(() => setRevision((n) => n + 1), []);

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) return;

    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);

    (async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const url = `${ENDPOINT}?page=${page}&perPage=${perPage}&status=${status}&category=${category}`;
        const res = await adminFetch(url, { signal: controller.signal });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(feedbackErrorMessage(res.status, text));
        }
        const parsed = parseFeedbackResponse(await res.json());
        if (cancelled) return;
        setState({ data: parsed.items, summary: parsed.summary, total: parsed.total, loading: false, error: null });
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof DOMException && err.name === "AbortError"
            ? "Request timed out."
            : err instanceof Error
              ? err.message
              : String(err);
        setState({ data: [], summary: EMPTY_FEEDBACK_SUMMARY, total: 0, loading: false, error: msg });
      } finally {
        window.clearTimeout(timeout);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [page, perPage, status, category, revision]);

  return { ...state, refresh };
};

// Resolve / reopen one row. Resolves to an error string, or null on success.
export const setFeedbackResolved = async (id: string, resolved: boolean): Promise<string | null> => {
  if (!SUPABASE_CONFIGURED) return "Admin API not configured.";
  try {
    const res = await adminFetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, resolved }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return feedbackErrorMessage(res.status, text);
    }
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
};
