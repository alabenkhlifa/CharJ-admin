import { useEffect, useRef, useState, type ReactNode } from "react";
import { APIProvider, Map, Marker } from "@vis.gl/react-google-maps";
import { AnnounceDialog } from "../../components/announce-dialog";
import { EditChargerDrawer } from "../../components/edit-charger-drawer";
import { setChargerStatus, verifyCharger, type SettableStatus } from "../../data/charger-actions";
import { accessLabel, sourceLabel, STATUS_LABELS } from "../../data/charger-catalog";
import { mapRawCharger, STATUS_COLORS, type Charger, type RawChargerRow } from "../../data/chargers";
import { useLocations } from "../../data/locations";
import { withCityNames } from "../../data/locations-model";
import { useChargerNotifications } from "../../data/notifications";
import { suggestionDiff, UPDATE_CLASS_LABELS } from "../../data/notifications-report";
import { AmenityIcon, labelForAmenity } from "../../lib/amenity-icons";
import { darkMapStyle, lightMapStyle, MAP_BACKGROUND, pinIcon } from "../../lib/map-styles";
import { SUPABASE_CONFIGURED } from "../../lib/supabase";
import { useCurrentTheme } from "../../lib/use-theme";
import { ChgIcon, ConnectorMarks, StatusMark } from "./bits";
import { DAYS, dayCellLabel, fmtAgo, nf, tunisDayIndex } from "./format";

// The charger's detail drawer: facts, hours, the announceable update, and the
// admin's one-tap actions (verify, operational / under repair, edit, open in
// Google Maps). A side sheet over a scrim; Escape or the scrim closes it.

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "";

type Props = {
  charger: Charger;
  /** Open in the editor rather than the detail view. */
  startEditing?: boolean;
  /**
   * False over the map view: the page's map is already the one live map, so
   * the drawer doesn't start a second Maps session.
   */
  showMap?: boolean;
  now: number;
  onClose: () => void;
  onLocalUpdate: (patch: Partial<Charger>) => void;
  refetch: () => Promise<void>;
};

const MiniMap = ({ charger }: { charger: Charger }) => {
  const theme = useCurrentTheme();
  const center = { lat: charger.lat, lng: charger.lng };
  return (
    <div className="chg-minimap">
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
        <Map
          defaultCenter={center}
          defaultZoom={14}
          styles={theme === "dark" ? darkMapStyle : lightMapStyle}
          disableDefaultUI
          gestureHandling="none"
          clickableIcons={false}
          backgroundColor={MAP_BACKGROUND[theme]}
          style={{ width: "100%", height: "100%" }}
        >
          <Marker position={center} icon={pinIcon(STATUS_COLORS[charger.status])} />
        </Map>
      </APIProvider>
    </div>
  );
};

const KV = ({ k, children, wide = false }: { k: string; children: ReactNode; wide?: boolean }) => (
  <div className={wide ? "chg-kv chg-kv-wide" : "chg-kv"}>
    <dt>{k}</dt>
    <dd>{children}</dd>
  </div>
);

const Section = ({ title, children }: { title?: string; children: ReactNode }) => (
  <section className="chg-d-sec">
    {title && <h3>{title}</h3>}
    {children}
  </section>
);

export const DetailDrawer = ({ charger, startEditing = false, showMap = true, now, onClose, onLocalUpdate, refetch }: Props) => {
  const [editing, setEditing] = useState(startEditing);
  const [saved, setSaved] = useState(false);
  const today = tunisDayIndex(now);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState<SettableStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const { cities, governorates } = useLocations();
  // An announceable update for this charger (admin-notifications, narrowed
  // to it). Silent when the function is unreachable: the button just stays
  // hidden.
  const notifications = useChargerNotifications(charger.id);
  const suggestion = notifications.data?.suggestions[0] ?? null;
  const moreSuggestions = Math.max(0, (notifications.data?.suggestions.length ?? 0) - 1);
  const [announcing, setAnnouncing] = useState(false);
  const [announced, setAnnounced] = useState<string | null>(null);
  const refreshNotifications = notifications.refresh;
  const closeRef = useRef<HTMLButtonElement>(null);

  // Keyboard users land inside the sheet that just opened.
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, []);

  // Rows open on Enter, so the drawer has to close on Escape — otherwise a
  // keyboard user is stuck behind the overlay with no way back to the table.
  useEffect(() => {
    if (editing || announcing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [editing, announcing, onClose]);

  const handleVerify = async () => {
    if (!SUPABASE_CONFIGURED) return;
    setVerifyError(null);
    setVerifying(true);
    try {
      const updated = await verifyCharger(charger.id);
      onLocalUpdate({ verified: updated.is_verified, verifiedBy: updated.verified_by });
      await refetch();
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const handleSetStatus = async (next: SettableStatus) => {
    if (!SUPABASE_CONFIGURED) return;
    if (charger.status === next) return;
    setStatusError(null);
    setStatusBusy(next);
    try {
      const updated = await setChargerStatus(charger.id, next);
      onLocalUpdate({ status: updated.status });
      // A status flip can create an announceable update.
      refreshNotifications();
      await refetch();
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setStatusBusy(null);
    }
  };

  if (editing)
    return (
      <EditChargerDrawer
        chargerId={charger.id}
        onClose={() => setEditing(false)}
        onSaved={(updated) => {
          const mapped = mapRawCharger(updated as RawChargerRow);
          if (mapped) onLocalUpdate({ ...mapped, ...withCityNames(mapped, cities, governorates) });
          setEditing(false);
          setSaved(true);
          refreshNotifications();
          void refetch();
        }}
      />
    );

  const mapsUrl = `https://www.google.com/maps?q=${charger.lat},${charger.lng}`;
  const statusButton = (next: SettableStatus) => {
    const on = charger.status === next;
    const label = STATUS_LABELS[next];
    return (
      <button
        type="button"
        className="chg-btn chg-status-btn"
        aria-pressed={on}
        disabled={on || statusBusy !== null || !SUPABASE_CONFIGURED}
        onClick={() => handleSetStatus(next)}
        title={on ? `Already ${label.toLowerCase()}` : `Set status to ${label.toLowerCase()}`}
      >
        <i className="chg-dot" style={{ background: STATUS_COLORS[next] }} />
        {statusBusy === next ? "…" : label}
      </button>
    );
  };

  return (
    <>
      <div className="chg-scrim" onClick={onClose} />
      <aside className="chg-drawer" aria-label={`${charger.name}, charger details`}>
        <header className="chg-d-head">
          <div>
            <p className="chg-d-id">{charger.id.slice(0, 8)}</p>
            <h2>
              <bdi>{charger.name}</bdi>
            </h2>
          </div>
          <button ref={closeRef} type="button" className="chg-close" onClick={onClose} aria-label="Close charger details">
            <ChgIcon name="x" />
          </button>
        </header>

        <div className="chg-d-body">
          <div className="chg-d-tags">
            {saved && (
              <p role="status" className="chg-d-done">
                Charger changes saved.
              </p>
            )}
            <StatusMark status={charger.status} />
            <span className="ui-pill chg-pill">{accessLabel(charger.access)}</span>
            {charger.verified && (
              <span className="ui-pill chg-pill chg-pill-icon">
                <ChgIcon name="verify" />
                Verified
              </span>
            )}
          </div>

          {announced && (
            <p role="status" className="chg-d-done">
              {announced}
            </p>
          )}
          {suggestion && (
            <div className="chg-announce">
              <h3>Announceable update</h3>
              <p className="chg-announce-what">{UPDATE_CLASS_LABELS[suggestion.update_class]}</p>
              {suggestionDiff(suggestion).map((line) => (
                <p key={line.field} className="chg-announce-diff">
                  {line.field}: {line.before} → <span>{line.after}</span>
                </p>
              ))}
              <p className="chg-announce-n">
                {nf.format(suggestion.recipient_estimate)} recipients · {nf.format(suggestion.push_estimate)} with push
                {moreSuggestions > 0 && ` · ${moreSuggestions} more on the Notifications page`}
              </p>
              <button type="button" className="chg-btn chg-btn-primary" onClick={() => setAnnouncing(true)}>
                <ChgIcon name="bell" /> Announce update
              </button>
            </div>
          )}

          {showMap &&
            (GOOGLE_MAPS_API_KEY ? (
              <MiniMap charger={charger} />
            ) : (
              <p className="chg-minimap chg-nokey">
                Set <code>VITE_GOOGLE_MAPS_API_KEY</code> in <code>charj-admin/.env</code> to render the map.
              </p>
            ))}

          <Section title="Connectors and power">
            <div className="chg-d-power">
              <ConnectorMarks keys={charger.connectors} />
              {charger.power > 0 ? (
                <span className="chg-d-kw">
                  <b>{nf.format(charger.power)}</b> kW
                </span>
              ) : (
                <span className="chg-dim">No power listed</span>
              )}
            </div>
          </Section>

          <Section title="Working hours">
            <ol className="chg-days">
              {DAYS.map((d, i) => (
                <li key={d} aria-current={i === today ? "date" : undefined}>
                  <span>{d}</span>
                  <b>{dayCellLabel(charger.workingHours, i)}</b>
                </li>
              ))}
            </ol>
          </Section>

          {charger.amenities.length > 0 && (
            <Section title="Amenities">
              <ul className="chg-amen">
                {charger.amenities.map((a) => (
                  <li key={a}>
                    <AmenityIcon slug={a} size={14} />
                    {labelForAmenity(a)}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section>
            <dl className="chg-kvs">
              <KV k="City">
                {charger.cityName ? (
                  <>
                    {charger.cityName}
                    {charger.cityNameAr && (
                      <span className="chg-dim">
                        {" · "}
                        <bdi>{charger.cityNameAr}</bdi>
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <bdi>{charger.city}</bdi>
                    <span className="chg-kv-flag">No city linked</span>
                  </>
                )}
              </KV>
              <KV k="Governorate">
                {charger.governorateName ? (
                  <>
                    {charger.governorateName}
                    {charger.governorateNameAr && (
                      <span className="chg-dim">
                        {" · "}
                        <bdi>{charger.governorateNameAr}</bdi>
                      </span>
                    )}
                  </>
                ) : (
                  "—"
                )}
              </KV>
              <KV k="Address" wide>
                {charger.address ? <bdi>{charger.address}</bdi> : "—"}
              </KV>
              <KV k="Address (Arabic)" wide>
                {charger.addressAr ? <bdi dir="rtl">{charger.addressAr}</bdi> : "—"}
              </KV>
              <KV k="Source">{sourceLabel(charger.source)}</KV>
              <KV k="OCM ID">{charger.ocmId ?? "—"}</KV>
              <KV k="Updated">{fmtAgo(charger.updatedAt, now)}</KV>
              <KV k="Verified by">{charger.verifiedBy ?? "—"}</KV>
              <KV k="Coordinates" wide>
                {charger.lat.toFixed(4)}, {charger.lng.toFixed(4)}
              </KV>
            </dl>
          </Section>

          <Section title="Status">
            <div className="chg-d-status" role="group" aria-label="Set status">
              {statusButton("operational")}
              {statusButton("under_repair")}
            </div>
            {statusError && <p className="chg-error">{statusError}</p>}
          </Section>

          <Section>
            <div className="chg-d-actions">
              {charger.verified ? (
                <span className="chg-d-verified">
                  <ChgIcon name="verify" />
                  Verified by {charger.verifiedBy ?? "admin"}
                </span>
              ) : (
                <button
                  type="button"
                  className="chg-btn chg-btn-primary"
                  onClick={handleVerify}
                  disabled={verifying || !SUPABASE_CONFIGURED}
                  title={SUPABASE_CONFIGURED ? undefined : "Admin API not configured"}
                >
                  <ChgIcon name="verify" /> {verifying ? "Verifying…" : "Verify"}
                </button>
              )}
              <button type="button" className="chg-btn" onClick={() => setEditing(true)} disabled={verifying || statusBusy !== null}>
                Edit charger
              </button>
              <a className="chg-btn chg-btn-icon" href={mapsUrl} target="_blank" rel="noopener noreferrer" aria-label="Open in Google Maps" title="Open in Google Maps">
                <ChgIcon name="external" />
              </a>
            </div>
            {verifyError && <p className="chg-error">{verifyError}</p>}
          </Section>
        </div>
      </aside>
      {announcing && suggestion && (
        <AnnounceDialog
          action="announce"
          id={suggestion.update_event_id}
          chargerName={charger.name}
          detail={UPDATE_CLASS_LABELS[suggestion.update_class]}
          onClose={() => setAnnouncing(false)}
          onDone={(message) => {
            setAnnouncing(false);
            setAnnounced(message);
            refreshNotifications();
          }}
        />
      )}
    </>
  );
};
