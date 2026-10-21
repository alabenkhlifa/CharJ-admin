import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { adminFetch } from "./admin-fetch";
import { AdminSessionContext, onAuthNotice, type AdminSession } from "./admin-session";
import { SUPABASE_CONFIGURED, supabase } from "./supabase";

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
            signOut: async () => {
              await supabase.auth.signOut();
            },
          }
        : null,
    [session],
  );

  if (session === undefined) {
    return <div style={{ minHeight: "100vh", background: "var(--bg)" }} />;
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

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(circle at 30% 20%, rgba(11, 216, 182, 0.08), transparent 50%), var(--bg)",
        padding: 20,
      }}
    >
      <form
        onSubmit={(e) => void submit(e)}
        key={shake}
        style={{
          width: "min(360px, 100%)",
          background: "var(--bg-elev)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: 28,
          display: "flex",
          flexDirection: "column",
          gap: 18,
          animation: shake > 0 ? "shake 0.32s" : undefined,
          boxShadow: "0 12px 40px rgba(0, 0, 0, 0.3)",
        }}
      >
        <style>{`
          @keyframes shake {
            10%, 90% { transform: translateX(-1px); }
            20%, 80% { transform: translateX(2px); }
            30%, 50%, 70% { transform: translateX(-4px); }
            40%, 60% { transform: translateX(4px); }
          }
        `}</style>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 11,
              display: "grid",
              placeItems: "center",
              background: "linear-gradient(135deg, var(--accent) 0%, #06a085 100%)",
              color: "#0a0a0b",
              boxShadow: "0 0 0 1px var(--accent-border), 0 8px 24px rgba(11, 216, 182, 0.25)",
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M13 2 4 14h7l-1 8 9-12h-7Z" />
            </svg>
          </div>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 17,
                fontWeight: 600,
                color: "var(--text)",
                letterSpacing: "-0.02em",
              }}
            >
              Charj Admin
            </div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
              Sign in to continue
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Field
            label="Email"
            value={email}
            onChange={setEmail}
            type="email"
            autoFocus
            invalid={err !== null}
          />
          <Field
            label="Password"
            value={pass}
            onChange={setPass}
            type="password"
            invalid={err !== null}
          />
        </div>

        {err && (
          <div
            style={{
              fontSize: 12,
              color: "var(--red)",
              background: "color-mix(in srgb, var(--red) 12%, transparent)",
              border: "1px solid color-mix(in srgb, var(--red) 28%, transparent)",
              padding: "8px 10px",
              borderRadius: 6,
            }}
          >
            {err}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          style={{
            background: "var(--accent)",
            color: "#0a0a0b",
            border: "none",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 13,
            fontWeight: 600,
            cursor: busy ? "progress" : "pointer",
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <div
          style={{
            fontSize: 10,
            color: "var(--text-dim)",
            textAlign: "center",
            letterSpacing: "0.04em",
          }}
        >
          Internal tool · Charj Admin
        </div>
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
  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    <span
      style={{
        fontSize: 10,
        color: "var(--text-dim)",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        fontWeight: 500,
      }}
    >
      {label}
    </span>
    <input
      type={type}
      value={value}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
      autoComplete={type === "password" ? "current-password" : "email"}
      style={{
        height: 38,
        padding: "0 12px",
        background: "var(--bg-elev-2)",
        border: `1px solid ${invalid ? "color-mix(in srgb, var(--red) 50%, transparent)" : "var(--border)"}`,
        borderRadius: 8,
        color: "var(--text)",
        fontFamily: "inherit",
        fontSize: 13,
        outline: "none",
      }}
    />
  </label>
);
