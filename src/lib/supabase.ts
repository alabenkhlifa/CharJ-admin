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

export const SUPABASE_CONFIGURED = Boolean(URL && ANON);

// createClient throws on empty URL. When env vars are missing (e.g. local
// dev with no .env populated), hand it a placeholder so the module loads.
// Downstream hooks must short-circuit on !SUPABASE_CONFIGURED before
// touching this client.
export const supabase = createClient(
  SUPABASE_CONFIGURED ? URL : "https://placeholder.invalid",
  SUPABASE_CONFIGURED ? ANON : "placeholder",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);
