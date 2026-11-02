import { isAuthRetryableFetchError } from "@supabase/supabase-js";

// What adminFetch does with `supabase.auth.getSession()`'s answer. Kept apart
// from admin-fetch (which needs Vite's env) so `node --test` can load it.
//
// getSession refreshes an expired access token first. When that refresh
// can't reach the server (offline, a 5xx), auth-js keeps the session in
// storage and answers with an AuthRetryableFetchError: the admin is still
// signed in, so this is "offline", never a sign-out. Only no session at all,
// or the server refusing the refresh token (auth-js then drops the session),
// signs the admin out.

export const OFFLINE_MESSAGE = "Can't reach the server.";

export type SessionAnswer = {
  data: { session: { access_token: string } | null };
  error: unknown;
};

export type SessionToken = { kind: "token"; token: string } | { kind: "offline" } | { kind: "signed-out" };

export const sessionToken = ({ data, error }: SessionAnswer): SessionToken => {
  if (error && isAuthRetryableFetchError(error)) return { kind: "offline" };
  const token = data.session?.access_token;
  if (error || !token) return { kind: "signed-out" };
  return { kind: "token", token };
};
