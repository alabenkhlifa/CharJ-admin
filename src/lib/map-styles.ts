// Mirrors charj/lib/map-styles.ts — keep these in sync with the mobile app
// so admins see the same map as users.

export const darkMapStyle: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#18181B" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#71717A" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#09090B" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ color: "#27272A" }],
  },
  {
    featureType: "administrative.land_parcel",
    elementType: "labels.text.fill",
    stylers: [{ color: "#52525B" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ visibility: "on" }, { color: "#1A2E1A" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#27272A" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#18181B" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#3F3F46" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#27272A" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#1E1E22" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#0C1929" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#3B82F6" }],
  },
];

export const lightMapStyle: google.maps.MapTypeStyle[] = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ visibility: "on" }],
  },
  {
    featureType: "transit",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#DBEAFE" }],
  },
];

// Tunisia center + initial zoom (matches mobile app's default region).
export const TUNISIA_CENTER = { lat: 34.0, lng: 9.5 };
export const TUNISIA_ZOOM = 6.5;

// What the map shows before its tiles arrive: the dark land and the light
// water of the styles above, so the first paint doesn't flash a third colour.
export const MAP_BACKGROUND = { dark: "#18181B", light: "#DBEAFE" } as const;

// Charger pins: a status-coloured dot (data/chargers.ts STATUS_COLORS) with a
// dark rim, as in the old admin map, so pale dots stay visible on light tiles.
export const PIN_STROKE = "#0a0a0b";
export const pinIcon = (fillColor: string, radius = 8): google.maps.Symbol => ({
  path: `M 0,0 m -${radius},0 a ${radius},${radius} 0 1,0 ${radius * 2},0 a ${radius},${radius} 0 1,0 -${radius * 2},0`,
  fillColor,
  fillOpacity: 1,
  strokeColor: PIN_STROKE,
  strokeWeight: 1.5,
  scale: 1,
  anchor: { x: 0, y: 0 } as google.maps.Point,
});
