import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "../lib/admin-fetch";
import { SUPABASE_CONFIGURED } from "../lib/supabase";

// ── One admin Edge Function read, as a hook ───────────────────────────────
// `load` decides what is read: pass a useCallback keyed by the view (path,
// filters). A new `load` is a new view: its data starts empty, so a filter
// change never shows the previous view's rows or numbers. `refresh` re-reads
// the same view and keeps its data on screen meanwhile. `patch` applies a
// write the server already confirmed (a resolved row flips in place).

export const NOT_CONFIGURED = "Admin API not configured. Set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.";
const TIMEOUT_MS = 15_000;

export type Loader<T> = (signal: AbortSignal) => Promise<T>;

export type AdminLoad<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  patch: (change: (prev: T) => T) => void;
};

type Settled<T> = { load: Loader<T>; revision: number; data: T | null; error: string | null };

/** A thrown value as one plain sentence. */
export const describeError = (err: unknown): string => {
  if (err instanceof DOMException && err.name === "AbortError") return "Request timed out.";
  if (err instanceof SyntaxError) return "Unexpected response.";
  if (err instanceof Error) return err.message;
  return String(err);
};

export const useAdminLoad = <T>(load: Loader<T>): AdminLoad<T> => {
  const [revision, setRevision] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let active = true;
    void load(controller.signal)
      .then(
        (data) => ({ data, error: null }),
        (err: unknown) => ({ data: null, error: describeError(err) }),
      )
      .then((result) => {
        clearTimeout(timeout);
        if (active) setSettled({ load, revision, ...result });
      });
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [load, revision]);

  const refresh = useCallback(() => setRevision((n) => n + 1), []);
  const patch = useCallback(
    (change: (prev: T) => T) => setSettled((s) => (s && s.data !== null ? { ...s, data: change(s.data) } : s)),
    [],
  );

  if (!SUPABASE_CONFIGURED) return { data: null, loading: false, error: NOT_CONFIGURED, refresh, patch };
  const sameView = settled !== null && settled.load === load;
  const fresh = sameView && settled.revision === revision;
  return {
    data: sameView ? settled.data : null,
    loading: !fresh,
    error: fresh ? settled.error : null,
    refresh,
    patch,
  };
};

/** GET an admin function's JSON; a non-2xx answer throws `messageFor(status, body text)`. */
export const getJson = async (
  path: string,
  signal: AbortSignal,
  messageFor: (status: number, text: string) => string,
): Promise<unknown> => {
  const res = await adminFetch(path, { signal });
  if (!res.ok) throw new Error(messageFor(res.status, await res.text().catch(() => "")));
  return res.json();
};

export type PostResult = { ok: true; status: number; body: unknown } | { ok: false; status: number; body: unknown; error: string | null };

/**
 * POST JSON to an admin function. Never throws: a network failure comes back
 * as status 0 with its message in `error`.
 */
export const postJson = async (path: string, payload: unknown): Promise<PostResult> => {
  if (!SUPABASE_CONFIGURED) return { ok: false, status: 0, body: null, error: NOT_CONFIGURED };
  try {
    const res = await adminFetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body: unknown = await res.json().catch(() => null);
    return res.ok ? { ok: true, status: res.status, body } : { ok: false, status: res.status, body, error: null };
  } catch (err) {
    return { ok: false, status: 0, body: null, error: describeError(err) };
  }
};

/** The `error` code an admin function sent in its JSON body, if any. */
export const errorCode = (body: unknown): string | undefined =>
  body !== null && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : undefined;
