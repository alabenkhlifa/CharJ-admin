import { useState, type FormEvent, type ReactNode } from "react";

const STORAGE_KEY = "charj-admin:auth";
const ADMIN_USER = import.meta.env.VITE_ADMIN_USER ?? "";
const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASS ?? "";

// If neither env var is set, skip the gate entirely. Lets dev work
// without forcing every contributor to set fake credentials, and lets
// the deploy fail-open visibly if someone forgets the GH secrets.
const GATE_DISABLED = !ADMIN_USER && !ADMIN_PASS;

const isAuthed = () => {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(STORAGE_KEY) === "1";
};

export const AuthGate = ({ children }: { children: ReactNode }) => {
  const [authed, setAuthed] = useState(GATE_DISABLED || isAuthed());
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState(false);
  const [shake, setShake] = useState(0);

  if (authed) return <>{children}</>;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (user === ADMIN_USER && pass === ADMIN_PASS) {
      window.sessionStorage.setItem(STORAGE_KEY, "1");
      setAuthed(true);
      return;
    }
    setErr(true);
    setShake((n) => n + 1);
    setPass("");
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
        onSubmit={submit}
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
            label="Username"
            value={user}
            onChange={setUser}
            type="text"
            autoFocus
            invalid={err}
          />
          <Field
            label="Password"
            value={pass}
            onChange={setPass}
            type="password"
            invalid={err}
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
            Invalid credentials.
          </div>
        )}

        <button
          type="submit"
          style={{
            background: "var(--accent)",
            color: "#0a0a0b",
            border: "none",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Sign in
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
  type: "text" | "password";
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
      autoComplete={type === "password" ? "current-password" : "username"}
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
