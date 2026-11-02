// Amenity slug allowlist mirrors `charj/lib/amenities.ts` and the
// `set_charger_override` validator. Keep the order in sync — the modal
// renders chips in this order.
export const AMENITY_SLUGS = [
  "toilet",
  "restaurant",
  "cafe",
  "shop",
  "air_pump",
  "wifi",
  "atm",
  "lounge",
  "mosque",
  "pharmacy",
  "car_wash",
  "kids_playground",
] as const;

export type AmenitySlug = (typeof AMENITY_SLUGS)[number];

// Human-friendly labels for the chips. Admin has no i18n yet — these
// match the FR-leaning labels used in the mobile app's `locales/en.json`
// `amenities.*` keys.
export const AMENITY_LABELS: Record<AmenitySlug, string> = {
  toilet: "Toilet",
  restaurant: "Restaurant",
  cafe: "Café",
  shop: "Shop",
  air_pump: "Air pump",
  wifi: "Wi-Fi",
  atm: "ATM",
  lounge: "Lounge",
  mosque: "Mosque",
  pharmacy: "Pharmacy",
  car_wash: "Car wash",
  kids_playground: "Kids playground",
};

export const labelForAmenity = (slug: string): string =>
  (AMENITY_LABELS as Record<string, string>)[slug] ?? slug.replace(/_/g, " ");
