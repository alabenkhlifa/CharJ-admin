import { useMemo, useState } from "react";
import { APIProvider, InfoWindow, Map, Marker } from "@vis.gl/react-google-maps";
import { Card } from "../components/card";
import {
  CHARGERS,
  CONNECTOR_COLORS,
  CONNECTOR_LABELS,
  STATUS_COLORS,
  type Charger,
  type ChargerStatus,
} from "../data/mock";
import {
  TUNISIA_CENTER,
  TUNISIA_ZOOM,
  darkMapStyle,
  lightMapStyle,
} from "../lib/map-styles";
import { useCurrentTheme } from "../lib/use-theme";

const STATUS_LABEL: Record<ChargerStatus, string> = {
  operational: "Operational",
  under_repair: "Under repair",
  planned: "Planned",
  unknown: "Unknown",
};

const LEGEND: { label: string; status: ChargerStatus }[] = [
  { label: "Operational", status: "operational" },
  { label: "Under repair", status: "under_repair" },
  { label: "Planned", status: "planned" },
  { label: "Unknown", status: "unknown" },
];

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "";

const MissingKey = () => (
  <Card padding={24}>
    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)", marginBottom: 6 }}>
      Google Maps API key missing
    </div>
    <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
      Set <code style={codeStyle}>VITE_GOOGLE_MAPS_API_KEY</code> in{" "}
      <code style={codeStyle}>charj-admin/.env</code> (use the same value as the mobile app's{" "}
      <code style={codeStyle}>GOOGLE_MAPS_API_KEY</code>) and restart{" "}
      <code style={codeStyle}>npm run dev</code>.
    </div>
  </Card>
);

const codeStyle = {
  padding: "1px 5px",
  borderRadius: 3,
  background: "var(--bg-elev-2)",
  border: "1px solid var(--border)",
  fontFamily: "JetBrains Mono, ui-monospace, monospace",
  fontSize: 11,
  color: "var(--text)",
};

const buildPinIcon = (color: string): google.maps.Symbol => ({
  path: "M 0,0 m -8,0 a 8,8 0 1,0 16,0 a 8,8 0 1,0 -16,0",
  fillColor: color,
  fillOpacity: 1,
  strokeColor: "#0a0a0b",
  strokeWeight: 1.5,
  scale: 1,
  anchor: { x: 0, y: 0 } as google.maps.Point,
});

export const MapPage = () => {
  const theme = useCurrentTheme();
  const [selected, setSelected] = useState<Charger | null>(null);

  const styles = useMemo(
    () => (theme === "dark" ? darkMapStyle : lightMapStyle),
    [theme],
  );

  if (!API_KEY) {
    return (
      <div className="fade-in">
        <h1 style={{ margin: "0 0 16px", fontSize: 22, fontWeight: 600 }}>Map</h1>
        <MissingKey />
      </div>
    );
  }

  return (
    <div
      className="fade-in"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 280px",
        gap: 16,
        height: "calc(100vh - var(--topbar-h) - 56px)",
      }}
    >
      <Card padding={0} style={{ position: "relative", overflow: "hidden", minHeight: 500 }}>
        <APIProvider apiKey={API_KEY}>
          <Map
            defaultCenter={TUNISIA_CENTER}
            defaultZoom={TUNISIA_ZOOM}
            styles={styles}
            disableDefaultUI={false}
            zoomControl
            streetViewControl={false}
            mapTypeControl={false}
            fullscreenControl={false}
            clickableIcons={false}
            gestureHandling="greedy"
            backgroundColor={theme === "dark" ? "#18181B" : "#DBEAFE"}
            style={{ width: "100%", height: "100%" }}
          >
            {CHARGERS.map((c) => (
              <Marker
                key={c.id}
                position={{ lat: c.lat, lng: c.lng }}
                icon={buildPinIcon(STATUS_COLORS[c.status])}
                title={c.name}
                onClick={() => setSelected(c)}
              />
            ))}
            {selected && (
              <InfoWindow
                position={{ lat: selected.lat, lng: selected.lng }}
                onCloseClick={() => setSelected(null)}
                pixelOffset={[0, -12]}
              >
                <div style={{ minWidth: 220, fontFamily: "Outfit, sans-serif" }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#18181b",
                      marginBottom: 4,
                    }}
                  >
                    {selected.name}
                  </div>
                  <div style={{ fontSize: 11, color: "#52525b", marginBottom: 8 }}>
                    {selected.gouv} · {selected.power} kW · {selected.hours}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 11,
                      color: STATUS_COLORS[selected.status],
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: STATUS_COLORS[selected.status],
                      }}
                    />
                    {STATUS_LABEL[selected.status]}
                  </div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {selected.connectors.map((k) => (
                      <span
                        key={k}
                        style={{
                          fontSize: 10,
                          padding: "2px 6px",
                          borderRadius: 3,
                          color: CONNECTOR_COLORS[k],
                          background: `color-mix(in srgb, ${CONNECTOR_COLORS[k]} 16%, transparent)`,
                        }}
                      >
                        {CONNECTOR_LABELS[k]}
                      </span>
                    ))}
                  </div>
                </div>
              </InfoWindow>
            )}
          </Map>
        </APIProvider>
        <div
          className="num"
          style={{
            position: "absolute",
            top: 12,
            insetInlineStart: 12,
            background: "var(--bg-elev)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: 11,
            color: "var(--text-muted)",
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          {CHARGERS.length} chargers · {CHARGERS.length} visible
        </div>
      </Card>
      <Card padding={16}>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-dim)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            marginBottom: 10,
          }}
        >
          Legend
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {LEGEND.map((l) => (
            <div
              key={l.status}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                color: "var(--text-muted)",
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: STATUS_COLORS[l.status],
                }}
              />
              {l.label}
            </div>
          ))}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-dim)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            margin: "20px 0 10px",
          }}
        >
          Filters
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
          Mirror Chargers page filters here…
        </div>
      </Card>
    </div>
  );
};
