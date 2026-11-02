import {
  forceSignOut,
  NOT_ADMIN_NOTICE,
  SESSION_EXPIRED_NOTICE,
} from "./admin-session";
import { OFFLINE_MESSAGE, sessionToken } from "./session-token";
import { SUPABASE_ANON_KEY, SUPABASE_CONFIGURED, SUPABASE_URL, supabase } from "./supabase";

// Calls an admin Edge Function (`../charj/supabase/functions/admin-*`) as the
// signed-in admin: `Authorization: Bearer <session access token>` plus the
// anon `apikey`. The function checks the token against Supabase Auth and the
// `admins` table (see docs/AUTH.md).
//
//   adminFetch("admin-users?page=1")
//   adminFetch("admin-verify-charger", { method: "POST", body })
//
// No session, or the server refused its refresh token → sign out.
// A refresh that couldn't reach the server keeps the session: it throws
// "Can't reach the server." and the caller shows its usual error and retry.
// 401 → the session is no longer valid: sign out.
// 403 → signed in, but not an admin (or an anonymous user): sign out with
//       that notice.
// Callers still get the Response and handle every other status themselves.
export const adminFetch = async (path: string, init: RequestInit = {}): Promise<Response> => {
  if (!SUPABASE_CONFIGURED) {
    throw new Error("Admin API not configured. Set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.");
  }
  // getSession refreshes an expired access token before handing it back.
  const session = sessionToken(await supabase.auth.getSession());
  if (session.kind === "offline") throw new Error(OFFLINE_MESSAGE);
  if (session.kind === "signed-out") {
    await forceSignOut(SESSION_EXPIRED_NOTICE);
    throw new Error("Not signed in.");
  }
  const { token } = session;

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("apikey", SUPABASE_ANON_KEY);

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, { ...init, headers });
  // Awaited so the sign-out has landed before the caller sees the response.
  if (res.status === 401) await forceSignOut(SESSION_EXPIRED_NOTICE);
  else if (res.status === 403) await forceSignOut(NOT_ADMIN_NOTICE);
  return res;
};
