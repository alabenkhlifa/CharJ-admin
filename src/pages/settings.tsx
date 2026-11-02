import { useState, type ReactNode } from "react";
import { useAdminSession } from "../lib/admin-session";
import { BUILD_COMMIT, BUILD_VERSION } from "../lib/build-info";
import { useTweaks, type ThemePref } from "../lib/theme";
import { buildHash } from "../lib/use-route";
import { LargeTitle } from "../ui/large-title";
import { ListRow, ListRows } from "../ui/list-row";
import { Segmented } from "../ui/segmented";
import "./settings.css";

// Settings: the admin's real preferences, nothing that can't work yet (spec
// "Notifications · Settings"). The theme is the one shared store the large
// title's toggle uses, so both always agree. On phones the tab bar has no
// Notifications tab, so its row lives here; from 768px the sidebar lists it.

const THEME_OPTIONS: { v: ThemePref; l: string }[] = [
  { v: "system", l: "System" },
  { v: "light", l: "Light" },
  { v: "dark", l: "Dark" },
];

/** A grouped card with a plain title: settings are not categories, so no colour square. */
const Group = ({ title, children, className }: { title?: string; children: ReactNode; className?: string }) => (
  <section className={className ? `ui-card set-card ${className}` : "ui-card set-card"} aria-label={title}>
    {title && <h2 className="set-h">{title}</h2>}
    {children}
  </section>
);

const SignOut = () => {
  const session = useAdminSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!session) return null;
  const signOut = async () => {
    setBusy(true);
    setError(null);
    // On success the sign-in card replaces the whole app, this included.
    const failed = await session.signOut();
    setBusy(false);
    if (failed) setError(`Couldn't sign out: ${failed}`);
  };
  return (
    <>
      <div className="set-row">
        <div className="set-row-main">
          <span className="set-label">Signed in as</span>
          <span className="set-value set-mail">{session.email || "an admin account with no email"}</span>
        </div>
        <button type="button" className="ui-btn" onClick={() => void signOut()} disabled={busy}>
          {busy ? "Signing out…" : "Sign out"}
        </button>
      </div>
      {error && (
        <p className="ui-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
};

export const SettingsPage = () => {
  const [tweaks, setTweak, resolved] = useTweaks();
  return (
    <div className="set">
      <LargeTitle title="Settings" />
      <div className="set-grid">
        <Group className="set-phone">
          <ListRows label="Pages">
            <ListRow
              title="Notifications"
              detail="Region alerts and announcements"
              href={buildHash("notifications")}
            />
          </ListRows>
        </Group>

        <Group title="Appearance">
          <div className="set-theme">
            <Segmented label="Theme" value={tweaks.theme} options={THEME_OPTIONS} onChange={(v) => setTweak("theme", v)} />
          </div>
          <p className="set-note" aria-live="polite">
            {tweaks.theme === "system"
              ? `Follows this device's setting, ${resolved} right now.`
              : `Always ${resolved}, whatever this device uses.`}{" "}
            The switch beside every page title flips light and dark.
          </p>
        </Group>

        <Group title="Account">
          <SignOut />
        </Group>

        <Group title="This build">
          <dl className="set-build">
            <div className="set-row">
              <dt className="set-label">Version</dt>
              <dd className="set-value ui-num">{BUILD_VERSION}</dd>
            </div>
            <div className="set-row">
              <dt className="set-label">Commit</dt>
              <dd className="set-value ui-num">
                <code>{BUILD_COMMIT}</code>
              </dd>
            </div>
          </dl>
        </Group>
      </div>
    </div>
  );
};
