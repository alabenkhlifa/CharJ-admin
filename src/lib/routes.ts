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
  count?: number;
  accent?: boolean;
};

export const NAV: NavItem[] = [
  { k: "overview", l: "Overview", ic: "Overview", shortcut: "g o" },
  { k: "chargers", l: "Chargers", ic: "Charger", shortcut: "g c", count: 412 },
  { k: "submissions", l: "Submissions", ic: "Submission", count: 47, accent: true },
  { k: "feedback", l: "Feedback", ic: "Feedback", shortcut: "g f", count: 23 },
  { k: "reviews", l: "Reviews", ic: "Reviews", count: 6 },
  { k: "users", l: "Users", ic: "Users" },
  { k: "vehicles", l: "Vehicles", ic: "Vehicle" },
  { k: "map", l: "Map", ic: "Map" },
  { k: "settings", l: "Settings", ic: "Settings" },
];
