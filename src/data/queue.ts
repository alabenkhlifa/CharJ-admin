import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "../lib/admin-fetch";
import { SUPABASE_CONFIGURED } from "../lib/supabase";
import { mergeQueue, QUEUE_KEYS, QUEUE_PATHS, type Queue, type QueueKey } from "./queue-report";

// ── What waits in Community (Summary's Needs you + the nav badge) ──────────
// Four small admin Edge Function reads in parallel; mergeQueue (pure) turns
// them into counts and newest items. One failing source leaves the others.

export type { Queue, QueueKey } from "./queue-report";

const NOT_CONFIGURED = "Admin API not configured. Set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.";

const httpMessage = (status: number) => {
  if (status === 401) return "Your admin credentials could not be verified.";
  if (status === 503) return "Unavailable right now.";
  return `HTTP ${status}`;
};

const read = async (key: QueueKey, signal: AbortSignal): Promise<unknown> => {
  try {
    const res = await adminFetch(QUEUE_PATHS[key], { signal });
    if (!res.ok) throw new Error(httpMessage(res.status));
    return await res.json();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw new Error("Request timed out.", { cause: err });
    if (err instanceof SyntaxError) throw new Error("Unexpected response.", { cause: err });
    throw err;
  }
};

export type QueueState = {
  /** The last loaded queue; kept while a refresh runs so counts don't flicker. */
  data: Queue | null;
  /** When `data` arrived (ms), the "now" for "1d ago". */
  loadedAt: number | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

/**
 * Read on mount, again on `refresh()` (every Community action calls it) and
 * whenever the window gets the focus back (another tab, the phone unlocked).
 * Moving between pages inside the app reads nothing: only a Community action
 * changes the queue from here, and that already refreshes it.
 */
export const useQueue = (): QueueState => {
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);
  const [state, setState] = useState<Omit<QueueState, "refresh">>({
    data: null,
    loadedAt: null,
    loading: SUPABASE_CONFIGURED,
    error: SUPABASE_CONFIGURED ? null : NOT_CONFIGURED,
  });

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setState((prev) => ({ ...prev, loading: true }));
      const results = await Promise.allSettled(QUEUE_KEYS.map((key) => read(key, controller.signal)));
      clearTimeout(timeout);
      if (!active) return;
      const settled = Object.fromEntries(QUEUE_KEYS.map((key, i) => [key, results[i]])) as Record<
        QueueKey,
        PromiseSettledResult<unknown>
      >;
      setState({ data: mergeQueue(settled), loadedAt: Date.now(), loading: false, error: null });
    });
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [revision]);

  useEffect(() => {
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);

  return { ...state, refresh };
};
