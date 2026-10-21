import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { iconBtnStyle } from "./charts";
import { Icons } from "../lib/icons";
import {
  announceUpdate,
  previewNotification,
  releaseNotification,
} from "../data/notifications";
import {
  estimateLabel,
  isQuietTime,
  type NotificationPreview,
  type PreviewLanguage,
} from "../data/notifications-report";

// Confirm step for anything that pushes to phones: Announce (a suggested
// update) and Send now (a pending item). It renders the exact templated copy
// in all three languages plus the recipient estimate *before* the admin
// commits. Used by the Notifications page and the charger detail drawer.

type AnnounceDialogProps = {
  // announce → update_event_id, release → event_id
  action: "announce" | "release";
  id: string;
  chargerName: string;
  // e.g. "Back in service" or "New charger digest"
  detail?: string;
  onClose: () => void;
  // Success: the parent refreshes and shows `message`.
  onDone: (message: string) => void;
};

const LANGUAGES: { key: PreviewLanguage; label: string; dir: "ltr" | "rtl" }[] = [
  { key: "fr", label: "French", dir: "ltr" },
  { key: "ar", label: "Arabic", dir: "rtl" },
  { key: "en", label: "English", dir: "ltr" },
];

type PreviewState =
  | { status: "loading" }
  | { status: "ready"; preview: NotificationPreview }
  | { status: "failed"; error: string };

export const AnnounceDialog = ({ action, id, chargerName, detail, onClose, onDone }: AnnounceDialogProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<PreviewState>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void previewNotification(action === "announce" ? { update_event_id: id } : { event_id: id }).then((result) => {
      if (!active) return;
      setPreview(result.ok ? { status: "ready", preview: result.preview } : { status: "failed", error: result.error });
    });
    return () => {
      active = false;
    };
  }, [action, id]);

  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.focus();
    return () => {
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);

  // Escape is caught on window in the capture phase: it works even when focus
  // fell to <body> (a clicked button that got disabled), and it never reaches
  // the charger drawer's own Escape handler underneath.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (!busy) onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [busy, onClose]);

  const close = () => {
    if (!busy) onClose();
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const result = action === "announce" ? await announceUpdate(id) : await releaseNotification(id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      // The confirm button was disabled while busy, which drops focus.
      ref.current?.focus();
      return;
    }
    onDone(
      action === "announce"
        ? `Announcement queued for ${chargerName}. The dispatcher sends it at its next run.`
        : `${chargerName} released. The dispatcher sends it at its next run.`,
    );
  };

  const quiet = isQuietTime(new Date());
  const title = action === "announce" ? "Announce update" : "Send now";

  return (
    <>
      <div onClick={close} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 70, animation: "fadeIn .15s" }} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="announce-dialog-title"
        tabIndex={-1}
        className="announce-dialog"
        onKeyDown={(e) => {
          if (e.key !== "Tab") return;
          const elements = Array.from(ref.current?.querySelectorAll<HTMLElement>("button:not(:disabled)") ?? []);
          const first = elements[0];
          const last = elements.at(-1);
          if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) {
            e.preventDefault();
            first?.focus();
          }
        }}
        style={{
          position: "fixed",
          zIndex: 71,
          insetInline: 0,
          marginInline: "auto",
          top: "50%",
          transform: "translateY(-50%)",
          width: "min(560px, calc(100vw - 32px))",
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
          overflowX: "hidden",
          background: "var(--bg-elev)",
          border: "1px solid var(--border-strong)",
          borderRadius: 12,
          boxShadow: "0 24px 60px rgba(0,0,0,.35)",
          outline: "none",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={smallLbl}>{title}</div>
            <h2 id="announce-dialog-title" style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 600, overflowWrap: "anywhere" }}>
              {chargerName}
            </h2>
            {detail && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{detail}</div>}
          </div>
          <button type="button" onClick={close} aria-label="Close" disabled={busy} style={iconBtnStyle}>
            <Icons.X size={14} />
          </button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={smallLbl}>What phones will show</div>
          {preview.status === "loading" && (
            <div role="status" style={{ fontSize: 12, color: "var(--text-muted)" }}>Loading preview…</div>
          )}
          {preview.status === "failed" && (
            <div role="alert" style={warnBox}>Preview unavailable: {preview.error}</div>
          )}
          {preview.status === "ready" && (
            <>
              {LANGUAGES.map(({ key, label, dir }) => {
                const copy = preview.preview.previews[key];
                return (
                  <section
                    key={key}
                    aria-label={`${label} preview`}
                    style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", background: "var(--bg-elev-2)" }}
                  >
                    <div style={{ ...smallLbl, marginBottom: 4 }}>{key.toUpperCase()} · {label}</div>
                    {copy ? (
                      <div dir={dir} lang={key} style={{ overflowWrap: "anywhere" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{copy.title}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{copy.body}</div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: "var(--text-dim)" }}>—</div>
                    )}
                  </section>
                );
              })}
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: "var(--text)" }}>
                <Icons.Users size={14} style={{ color: "var(--text-dim)", flexShrink: 0, marginTop: 2 }} />
                <span>{estimateLabel(preview.preview)}</span>
              </div>
              {preview.preview.kind === "charger_added" && (
                <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                  This is the copy for this charger alone. People with several new chargers in their regions get one combined digest.
                </div>
              )}
            </>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: quiet ? "var(--amber)" : "var(--text-muted)" }}>
            <Icons.Clock size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              {quiet
                ? "Quiet hours now (22:00–08:00 Tunis): it goes out at 08:00."
                : "The dispatcher runs every 5 minutes; it goes out at the next run."}
            </span>
          </div>
          {error && <div role="alert" style={errorBox}>{error}</div>}
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={close} disabled={busy} style={secondaryBtn}>
            Not now
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={busy || preview.status === "loading"}
            style={{ ...primaryBtn, opacity: busy || preview.status === "loading" ? 0.6 : 1 }}
          >
            {busy ? "Sending…" : action === "announce" ? "Announce" : "Send now"}
          </button>
        </div>
      </div>
    </>
  );
};

const smallLbl: CSSProperties = {
  fontSize: 10,
  color: "var(--text-dim)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const errorBox: CSSProperties = {
  padding: "8px 10px",
  border: "1px solid color-mix(in srgb, var(--red) 35%, transparent)",
  background: "color-mix(in srgb, var(--red) 10%, transparent)",
  borderRadius: 6,
  color: "var(--red)",
  fontSize: 12,
};

const warnBox: CSSProperties = {
  ...errorBox,
  border: "1px solid color-mix(in srgb, var(--amber) 35%, transparent)",
  background: "color-mix(in srgb, var(--amber) 10%, transparent)",
  color: "var(--amber)",
};

const secondaryBtn: CSSProperties = {
  padding: "8px 14px",
  background: "var(--bg-elev-2)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 500,
};

const primaryBtn: CSSProperties = {
  padding: "8px 14px",
  background: "var(--accent)",
  color: "#0a0a0b",
  border: "none",
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
};
