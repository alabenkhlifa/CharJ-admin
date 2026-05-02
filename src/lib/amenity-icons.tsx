import type { CSSProperties, ReactNode } from "react";

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

// Each amenity's icon shape. Drawn lucide-style so they sit cleanly next
// to the rest of the dashboard's icons. Mobile uses MaterialCommunityIcons
// + Feather — these are visual analogs, not byte-for-byte copies.
const AMENITY_PATHS: Record<AmenitySlug, ReactNode> = {
  toilet: (
    <>
      <path d="M7 3h10v6a5 5 0 0 1-10 0Z" />
      <path d="M9 14v7M15 14v7" />
      <path d="M9 18h6" />
    </>
  ),
  restaurant: (
    <>
      <path d="M3 2v7a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V2" />
      <path d="M6 11v11" />
      <path d="M19 2v20" />
      <path d="M16 2c-1 1-2 3-2 5s1 3 2 3h3" />
    </>
  ),
  cafe: (
    <>
      <path d="M17 8h1a3 3 0 0 1 0 6h-1" />
      <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
      <path d="M6 2v2M10 2v2M14 2v2" />
    </>
  ),
  shop: (
    <>
      <path d="M5 7h14l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z" />
      <path d="M9 7V5a3 3 0 0 1 6 0v2" />
    </>
  ),
  air_pump: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
    </>
  ),
  wifi: (
    <>
      <path d="M5 12.5a11 11 0 0 1 14 0" />
      <path d="M2 9a16 16 0 0 1 20 0" />
      <path d="M8.5 16a6 6 0 0 1 7 0" />
      <circle cx="12" cy="20" r="0.6" fill="currentColor" />
    </>
  ),
  atm: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 10v4M18 10v4" />
    </>
  ),
  lounge: (
    <>
      <path d="M19 10V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3" />
      <path d="M3 17a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1l-1-2H7l-1 2H5a2 2 0 0 1-2-2Z" />
      <path d="M7 10v3M17 10v3" />
    </>
  ),
  mosque: (
    <>
      <path d="M3 21V11a4 4 0 0 1 4-4M21 21V11a4 4 0 0 0-4-4" />
      <path d="M7 21v-5a5 5 0 0 1 10 0v5" />
      <path d="M12 4v3" />
      <path d="M11 4h2" />
      <path d="M3 21h18" />
    </>
  ),
  pharmacy: (
    <>
      <rect x="3" y="7" width="18" height="14" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M12 11v6M9 14h6" />
    </>
  ),
  car_wash: (
    <>
      <path d="M5 17h14" />
      <path d="M3 17v-3l1.5-3.5A2 2 0 0 1 6.4 9.4h11.2A2 2 0 0 1 19.5 10.5L21 14v3" />
      <circle cx="7.5" cy="17.5" r="1.4" />
      <circle cx="16.5" cy="17.5" r="1.4" />
      <path d="M7 4v2M12 4v2M17 4v2" />
    </>
  ),
  kids_playground: (
    <>
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v6" />
      <path d="M9 10h6" />
      <path d="m9 21 3-8 3 8" />
      <path d="M7 21h10" />
    </>
  ),
};

type AmenityIconProps = {
  slug: string;
  size?: number;
  style?: CSSProperties;
};

export const AmenityIcon = ({ slug, size = 14, style }: AmenityIconProps) => {
  const content = AMENITY_PATHS[slug as AmenitySlug];
  if (!content) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      {content}
    </svg>
  );
};

export const labelForAmenity = (slug: string): string =>
  (AMENITY_LABELS as Record<string, string>)[slug] ?? slug.replace(/_/g, " ");
