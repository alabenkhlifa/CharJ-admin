import { useMemo, useState } from "react";
import { APIProvider, Map, Marker } from "@vis.gl/react-google-maps";
import { CHARGERS, STATUS_COLORS } from "../data/mock";
import {
  TUNISIA_CENTER,
  TUNISIA_ZOOM,
  darkMapStyle,
  lightMapStyle,
} from "../lib/map-styles";
import { useCurrentTheme } from "../lib/use-theme";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "";

const buildPinIcon = (color: string): google.maps.Symbol => ({
  path: "M 0,0 m -7,0 a 7,7 0 1,0 14,0 a 7,7 0 1,0 -14,0",
  fillColor: color,
  fillOpacity: 1,
  strokeColor: "#0a0a0b",
  strokeWeight: 1.2,
  scale: 1,
  anchor: { x: 0, y: 0 } as google.maps.Point,
});

type TunisiaMapProps = {
  height?: number;
};

export const TunisiaMap = ({ height = 360 }: TunisiaMapProps) => {
  const theme = useCurrentTheme();
  const [opOnly, setOpOnly] = useState(false);

  const styles = useMemo(
    () => (theme === "dark" ? darkMapStyle : lightMapStyle),
    [theme],
  );

  const visible = useMemo(
    () => (opOnly ? CHARGERS.filter((c) => c.status === "operational") : CHARGERS),
    [opOnly],
  );

  if (!API_KEY) {
    return (
      <div
        style={{
          height,
          display: "grid",
          placeItems: "center",
          background: "var(--bg-elev-2)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          color: "var(--text-muted)",
          fontSize: 12,
          padding: 20,
          textAlign: "center",
        }}
      >
        Set <code style={codeStyle}>VITE_GOOGLE_MAPS_API_KEY</code> in{" "}
        <code style={codeStyle}>charj-admin/.env</code> to load the map.
      </div>
    );
  }

  return (
    <div style={{ position: "relative", height, width: "100%", borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)" }}>
      <APIProvider apiKey={API_KEY}>
        <Map
          defaultCenter={TUNISIA_CENTER}
          defaultZoom={TUNISIA_ZOOM}
          styles={styles}
          disableDefaultUI
          gestureHandling="greedy"
          backgroundColor={theme === "dark" ? "#18181B" : "#DBEAFE"}
          clickableIcons={false}
          style={{ width: "100%", height: "100%" }}
        >
          {visible.map((c) => (
            <Marker
              key={c.id}
              position={{ lat: c.lat, lng: c.lng }}
              icon={buildPinIcon(STATUS_COLORS[c.status])}
              title={c.name}
            />
          ))}
        </Map>
      </APIProvider>

      <div
        style={{
          position: "absolute",
          top: 10,
          insetInlineEnd: 10,
          display: "flex",
          gap: 6,
          alignItems: "center",
          zIndex: 1,
        }}
      >
        <button
          onClick={() => setOpOnly((v) => !v)}
          style={{
            fontSize: 11,
            padding: "5px 10px",
            border: "1px solid var(--border)",
            background: opOnly ? "var(--accent-soft)" : "var(--bg-elev)",
            color: opOnly ? "var(--accent)" : "var(--text-muted)",
            borderRadius: 6,
          }}
        >
          {opOnly ? "● " : "○ "}Operational only
        </button>
      </div>

      <div
        className="num"
        style={{
          position: "absolute",
          bottom: 10,
          insetInlineStart: 10,
          background: "var(--bg-elev)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: "5px 10px",
          fontSize: 11,
          color: "var(--text-muted)",
          zIndex: 1,
          pointerEvents: "none",
        }}
      >
        {visible.length} chargers · 24 gouvernorats
      </div>
    </div>
  );
};

const codeStyle = {
  padding: "1px 5px",
  borderRadius: 3,
  background: "var(--bg-elev)",
  border: "1px solid var(--border)",
  fontFamily: "JetBrains Mono, ui-monospace, monospace",
  fontSize: 11,
  color: "var(--text)",
};
