import { memo, useMemo } from "react";
import { APIProvider, Map, Marker } from "@vis.gl/react-google-maps";
import { STATUSES, STATUS_LABELS } from "../../data/charger-catalog";
import { STATUS_COLORS, type Charger } from "../../data/chargers";
import { darkMapStyle, lightMapStyle, MAP_BACKGROUND, pinIcon, TUNISIA_CENTER, TUNISIA_ZOOM } from "../../lib/map-styles";
import { useCurrentTheme } from "../../lib/use-theme";
import { nf } from "./format";

// ?view=map: every charger that matches the list's search and filters, as a
// status-coloured pin on one full-width map. A pin opens the same detail
// drawer as a row (the drawer leaves its mini map out here, so there is only
// ever one live Maps session on the page).

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "";

type Props = {
  chargers: Charger[];
  /** The whole catalogue, for "12 of 240". */
  total: number;
  loading: boolean;
  onOpen: (c: Charger) => void;
};

const Pins = memo(({ chargers, onOpen }: { chargers: Charger[]; onOpen: (c: Charger) => void }) => (
  <>
    {chargers.map((c) => (
      <Marker key={c.id} position={{ lat: c.lat, lng: c.lng }} icon={pinIcon(STATUS_COLORS[c.status])} title={c.name} onClick={() => onOpen(c)} />
    ))}
  </>
));
Pins.displayName = "ChargerPins";

export const ChargersMap = ({ chargers, total, loading, onOpen }: Props) => {
  const theme = useCurrentTheme();
  const styles = useMemo(() => (theme === "dark" ? darkMapStyle : lightMapStyle), [theme]);
  const counts = useMemo(() => {
    const n = { operational: 0, under_repair: 0, planned: 0, unknown: 0 };
    for (const c of chargers) n[c.status] += 1;
    return n;
  }, [chargers]);

  if (!API_KEY) {
    return (
      <div className="chg-map chg-map-nokey" role="note">
        <p>
          <b>Google Maps API key missing.</b> Set <code>VITE_GOOGLE_MAPS_API_KEY</code> in <code>charj-admin/.env</code> (the same
          value as the mobile app's <code>GOOGLE_MAPS_API_KEY</code>) and restart <code>npm run dev</code>.
        </p>
      </div>
    );
  }

  const shown = loading ? "Loading…" : chargers.length === total ? `${nf.format(total)} chargers` : `${nf.format(chargers.length)} of ${nf.format(total)} chargers`;

  return (
    <div className="chg-map" aria-label="Chargers map">
      <APIProvider apiKey={API_KEY}>
        <Map
          defaultCenter={TUNISIA_CENTER}
          defaultZoom={TUNISIA_ZOOM}
          styles={styles}
          disableDefaultUI
          zoomControl
          clickableIcons={false}
          gestureHandling="greedy"
          backgroundColor={MAP_BACKGROUND[theme]}
          style={{ width: "100%", height: "100%" }}
        >
          <Pins chargers={chargers} onOpen={onOpen} />
        </Map>
      </APIProvider>
      <p className="chg-map-count" role="status">
        {shown}
      </p>
      <ul className="chg-map-key" aria-label="Pin colours">
        {STATUSES.map((s) => (
          <li key={s}>
            <i className="chg-dot" style={{ background: STATUS_COLORS[s] }} />
            {STATUS_LABELS[s]}
            {!loading && <span>{nf.format(counts[s])}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
};
