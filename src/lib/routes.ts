import type { IconKey } from "./icons";

export type RouteKey =
  | "summary"
  | "usage"
  | "community"
  | "chargers"
  | "notifications"
  | "settings";

export type NavItem = {
  k: RouteKey;
  l: string;
  ic: IconKey;
  // On the phone tab bar. Notifications is reached from Settings on phones.
  tab: boolean;
};

export const NAV: NavItem[] = [
  { k: "summary", l: "Summary", ic: "Overview", tab: true },
  { k: "usage", l: "Usage", ic: "Phone", tab: true },
  { k: "community", l: "Community", ic: "Feedback", tab: true },
  { k: "chargers", l: "Chargers", ic: "Charger", tab: true },
  { k: "notifications", l: "Notifications", ic: "Bell", tab: false },
  { k: "settings", l: "Settings", ic: "Settings", tab: true },
];

export const DEFAULT_ROUTE: RouteKey = "summary";
