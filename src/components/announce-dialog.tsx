import { useEffect, useRef, useState } from "react";
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
import "./announce-dialog.css";

// Confirm step for anything that pushes to phones: Announce (a suggested
// update) and Send now (a pending item). It renders the exact templated copy
// in all three languages plus the recipient estimate *before* the admin
// commits. Used by the Notifications page and the charger detail drawer.
// A native <dialog> (DESIGN.md "Dialog"): the browser keeps focus inside and
// closes it on Escape; a click on the backdrop closes it too.

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
  const ref = useRef<HTMLDialogElement>(null);
  const notNow = useRef<HTMLButtonElement>(null);
  // Where focus was before the dialog opened; it goes back there after.
  const opener = useRef<Element | null>(typeof document === "undefined" ? null : document.activeElement);
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

  // Opened once mounted; unmounting removes it from the top layer.
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    const previous = opener.current;
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);

  // Escape never reaches the charger drawer underneath, and while the POST is
  // out it closes nothing (cancelling the keydown stops the browser's close).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (busy) e.preventDefault();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [busy]);

  // The confirm button was disabled while busy, which dropped focus.
  useEffect(() => {
    if (error) notNow.current?.focus();
  }, [error]);

  const close = () => {
    if (!busy) ref.current?.close();
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const result = action === "announce" ? await announceUpdate(id) : await releaseNotification(id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
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
    <dialog
      ref={ref}
      className="ui-dialog ann"
      aria-labelledby="announce-dialog-title"
      onCancel={(e) => {
        if (busy) e.preventDefault();
      }}
      onClose={onClose}
      onClick={(e) => {
        // The backdrop: a click outside the body lands on the dialog itself.
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="ui-dialog-body">
        <header className="ann-head">
          <h2 id="announce-dialog-title">{title}</h2>
          <p className="ann-name">
            <bdi>{chargerName}</bdi>
          </p>
          {detail && <p className="ann-meta">{detail}</p>}
        </header>

        <section className="ui-dialog-sec" aria-labelledby="announce-dialog-copy">
          <h3 id="announce-dialog-copy">What phones will show</h3>
          {preview.status === "loading" && (
            <p className="ann-meta" role="status">
              Loading preview…
            </p>
          )}
          {preview.status === "failed" && (
            <p className="ui-error" role="alert">
              Preview unavailable: {preview.error}
            </p>
          )}
          {preview.status === "ready" && (
            <>
              {LANGUAGES.map(({ key, label, dir }) => {
                const copy = preview.preview.previews[key];
                return (
                  <section key={key} className="ann-copy" aria-label={`${label} preview`}>
                    <p className="ann-lang">{label}</p>
                    {copy ? (
                      <div dir={dir} lang={key} className="ann-text">
                        <p className="ann-title">{copy.title}</p>
                        <p className="ann-body">{copy.body}</p>
                      </div>
                    ) : (
                      <p className="ann-meta">No copy in {label}.</p>
                    )}
                  </section>
                );
              })}
              <p className="ann-line">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
                </svg>
                <span>{estimateLabel(preview.preview)}</span>
              </p>
              {preview.preview.kind === "charger_added" && (
                <p className="ann-meta">
                  This is the copy for this charger alone. People with several new chargers in their regions get one combined digest.
                </p>
              )}
            </>
          )}
        </section>

        <section className="ui-dialog-sec" aria-label="When it goes out">
          <p className={quiet ? "ann-line ann-quiet" : "ann-line ann-line-2"}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            <span>
              {quiet
                ? "Quiet hours now (22:00–08:00 Tunis): it goes out at 08:00."
                : "The dispatcher runs every 5 minutes; it goes out at the next run."}
            </span>
          </p>
          {error && (
            <p className="ui-error" role="alert">
              {error}
            </p>
          )}
        </section>

        <div className="ui-dialog-end">
          <button ref={notNow} type="button" className="ui-btn" onClick={close} disabled={busy}>
            Not now
          </button>
          <button
            type="button"
            className="ui-btn ui-btn-primary"
            onClick={() => void confirm()}
            disabled={busy || preview.status === "loading"}
          >
            {busy ? "Sending…" : action === "announce" ? "Announce" : "Send now"}
          </button>
        </div>
      </div>
    </dialog>
  );
};
