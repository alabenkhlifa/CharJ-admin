import type { IconKey } from "./icons";

export type RouteKey =
  | "overview"
  | "chargers"
  | "submissions"
  | "feedback"
  | "reviews"
  | "users"
  | "vehicles"
  | "map"
  | "settings";

export type NavItem = {
  k: RouteKey;
  l: string;
  ic: IconKey;
  shortcut?: string;
  // `accent` flags items that should glow when their count is > 0
  // (e.g. pending submissions). The actual count comes from
  // `useSidebarCounts()` and is plumbed through `<Sidebar counts={...} />`.
  accent?: boolean;
};

export const NAV: NavItem[] = [
  { k: "overview", l: "Overview", ic: "Overview", shortcut: "g o" },
  { k: "chargers", l: "Chargers", ic: "Charger", shortcut: "g c" },
  { k: "submissions", l: "Submissions", ic: "Submission", accent: true },
  { k: "feedback", l: "Feedback", ic: "Feedback", shortcut: "g f" },
  { k: "reviews", l: "Reviews", ic: "Reviews" },
  { k: "users", l: "Users", ic: "Users" },
  { k: "vehicles", l: "Vehicles", ic: "Vehicle" },
  { k: "map", l: "Map", ic: "Map" },
  { k: "settings", l: "Settings", ic: "Settings" },
];
