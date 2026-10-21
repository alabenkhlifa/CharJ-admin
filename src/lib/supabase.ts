import { createClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export const SUPABASE_URL = URL;
export const SUPABASE_ANON_KEY = ANON;

if (!URL || !ANON) {
  // Fail loud at module import — easier than chasing "fetch returned null"
  // surprises later. The admin can still render with mock data only if we
  // gate at the call site.
  // eslint-disable-next-line no-console
  console.warn(
    "[charj-admin] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — Supabase queries will fail.",
  );
}

export const SUPABASE_CONFIGURED = Boolean(URL && ANON);

// createClient throws on empty URL. When env vars are missing (e.g. local
// dev with no .env populated), hand it a placeholder so the module loads.
// Downstream hooks must short-circuit on !SUPABASE_CONFIGURED before
// touching this client.
//
// The admin signs in with Supabase Auth (email + password, see
// lib/auth-gate.tsx). The session lives in localStorage under its own key so
// it never collides with another Supabase app on the same origin, and is
// refreshed in the background. Once signed in, PostgREST reads run as the
// `authenticated` role instead of `anon` — every table the dashboard reads
// grants both.
export const supabase = createClient(
  SUPABASE_CONFIGURED ? URL : "https://placeholder.invalid",
  SUPABASE_CONFIGURED ? ANON : "placeholder",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storage: typeof window === "undefined" ? undefined : window.localStorage,
      storageKey: "charj-admin-auth",
      // Password sign-in only. Never parse tokens out of the URL — the hash
      // belongs to the router (#/chargers?…).
      detectSessionInUrl: false,
    },
  },
);
