import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { adminFetch } from "./admin-fetch";
import { AdminSessionContext, onAuthNotice, type AdminSession } from "./admin-session";
import { SUPABASE_CONFIGURED, supabase } from "./supabase";
import "../ui/ui.css";
import "./auth-gate.css";

// Real sign-in: Supabase Auth email + password. Who counts as an admin is
// decided server-side by the `admins` table, checked by every admin Edge
// Function (see docs/AUTH.md). This gate only decides what to render.

// Cheapest call that runs the full admin check: a lookup by an id that can
// never be a UUID returns an empty list without touching the database.
const ACCESS_CHECK_PATH = "admin-users?perPage=1&user=access-check";

export const AuthGate = ({ children }: { children: ReactNode }) => {
  // undefined = still restoring the stored session.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  useEffect(() => {
    // Fires INITIAL_SESSION right away, then every sign-in / refresh / sign-out.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    const offNotice = onAuthNotice((notice) => {
      setErr(notice);
      setShake((n) => n + 1);
    });
    return () => {
      data.subscription.unsubscribe();
      offNotice();
    };
  }, []);

  const admin = useMemo<AdminSession | null>(
    () =>
      session
        ? {
            email: session.user.email ?? "",
            // The server revokes the session first; when it can't be
            // reached the session stays, and the caller gets the reason.
            signOut: async () => {
              const { error } = await supabase.auth.signOut();
              return error ? error.message || "The sign-in service could not be reached." : null;
            },
          }
        : null,
    [session],
  );

  if (session === undefined) {
    return <div className="auth" />;
  }

  // While a fresh sign-in is being checked, keep the card up so a non-admin
  // never sees the dashboard flash.
  if (admin && !busy) {
    return <AdminSessionContext.Provider value={admin}>{children}</AdminSessionContext.Provider>;
  }

  const fail = (message: string) => {
    setErr(message);
    setShake((n) => n + 1);
    setPass("");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!SUPABASE_CONFIGURED) {
      fail("Supabase is not configured. Set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
      if (error) {
        fail(/invalid login credentials/i.test(error.message) ? "Invalid credentials." : error.message);
        return;
      }
      // 401/403 here signs the account straight back out with a notice.
      await adminFetch(ACCESS_CHECK_PATH).catch(() => null);
      setPass("");
    } finally {
      setBusy(false);
    }
  };

  // The Health look: one Card on the grouped ground, kit fields and buttons.
  return (
    <div className="auth">
      <form className="auth-card" onSubmit={(e) => void submit(e)} key={shake} data-shake={shake > 0 || undefined}>
        <div className="auth-head">
          <h1>Charj Admin</h1>
          <p>Sign in to continue</p>
        </div>

        <Field label="Email" value={email} onChange={setEmail} type="email" autoFocus invalid={err !== null} />
        <Field label="Password" value={pass} onChange={setPass} type="password" invalid={err !== null} />

        {err && (
          <p className="ui-error auth-error" role="alert">
            {err}
          </p>
        )}

        <button type="submit" className="ui-btn ui-btn-primary auth-submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
};

type FieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type: "email" | "password";
  autoFocus?: boolean;
  invalid?: boolean;
};

const Field = ({ label, value, onChange, type, autoFocus, invalid }: FieldProps) => (
  <label className="auth-field">
    {label}
    <input
      type={type}
      value={value}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
      autoComplete={type === "password" ? "current-password" : "email"}
      aria-invalid={invalid || undefined}
      dir="ltr"
    />
  </label>
);
