import { createClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

if (!URL || !ANON) {
  // Fail loud at module import — easier than chasing "fetch returned null"
  // surprises later. The admin can still render with mock data only if we
  // gate at the call site.
  // eslint-disable-next-line no-console
  console.warn(
    "[charj-admin] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — Supabase queries will fail.",
  );
}

export const supabase = createClient(URL, ANON, {
  auth: {
    // No auth flow yet; treat the admin as a stateless anon client.
    // Supabase persists tokens by default, so disable to keep things clean.
    persistSession: false,
    autoRefreshToken: false,
  },
});

export const SUPABASE_CONFIGURED = Boolean(URL && ANON);
