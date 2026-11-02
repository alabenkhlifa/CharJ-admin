// Plain-English names for the Usage page: sections, screens, actions and the
// values the app sends (record_app_events in ../charj/supabase/migrations).
// A value with no name here is shown with its underscores turned to spaces.

import type { UsageDays, UsageEnvironment, UsagePlatform, UsageUi } from "../data/usage-report";

export const SECTIONS = [
  "activity",
  "coming-back",
  "languages",
  "screens",
  "actions",
  "funnels",
  "cars",
  "routes",
  "android-auto",
  "users",
] as const;
export type UsageSection = (typeof SECTIONS)[number];

export const SECTION_TITLE: Record<UsageSection, string> = {
  activity: "Activity",
  "coming-back": "Coming back",
  languages: "Languages",
  screens: "Screens",
  actions: "Actions",
  funnels: "Funnels",
  cars: "Cars",
  routes: "Routes",
  "android-auto": "Android Auto",
  users: "Users",
};

/** `?section=`, or the old `?tab=users` / `?tab=catalog` links (Task 6 redirects). */
export const parseSection = (section: string | null, tab: string | null): UsageSection | null => {
  if (section && (SECTIONS as readonly string[]).includes(section)) return section as UsageSection;
  if (tab === "users") return "users";
  if (tab === "catalog") return "cars";
  return null;
};

/** Which URL filters change what a section shows; the others are left out (no decorative controls). */
export type FilterKey = "days" | "platform" | "ui" | "env";
export const SECTION_FILTERS: Record<UsageSection | "overview", FilterKey[]> = {
  overview: ["days", "platform", "ui", "env"],
  activity: ["days", "platform", "ui", "env"],
  // Cohorts are every install week, whatever the window.
  "coming-back": ["platform", "ui", "env"],
  languages: ["days", "platform", "ui", "env"],
  screens: ["days", "platform", "ui", "env"],
  actions: ["days", "platform", "ui", "env"],
  funnels: ["days", "platform", "ui", "env"],
  // Missing cars and routes are not split by platform or design on the server.
  cars: ["days", "env"],
  routes: ["days", "env"],
  // Not measured yet: nothing to filter.
  "android-auto": [],
  users: [],
};

export const DAYS_OPTIONS: { v: UsageDays; l: string }[] = [
  { v: 7, l: "7 days" },
  { v: 30, l: "30 days" },
  { v: 90, l: "90 days" },
];
export const PLATFORM_OPTIONS: { v: UsagePlatform; l: string }[] = [
  { v: "all", l: "All phones" },
  { v: "ios", l: "iOS" },
  { v: "android", l: "Android" },
];
export const UI_OPTIONS: { v: UsageUi; l: string }[] = [
  { v: "all", l: "Any design" },
  { v: "lune", l: "Lune" },
  { v: "classic", l: "Classic" },
];
export const ENV_LABEL: Record<UsageEnvironment, string> = {
  production: "Production",
  preview: "Preview",
  development: "Development",
};

export const PLATFORM_NAME: Record<string, string> = { ios: "iOS", android: "Android", web: "Web" };
export const platformName = (p: string) => PLATFORM_NAME[p] ?? p;

export const LANGUAGE_NAME: Record<string, string> = { fr: "French", ar: "Arabic", en: "English" };
export const languageName = (l: string) => LANGUAGE_NAME[l] ?? l.toUpperCase();

const human = (value: string) => value.replace(/_/g, " ");

export const SCREEN_NAME: Record<string, string> = {
  map: "Map",
  charger: "Charger detail",
  list: "List",
  trip_planner: "Trip planner",
  settings: "Settings",
  saved_plans: "Saved trips",
  shared_plan: "Shared trip",
  onboarding: "Onboarding",
  add: "Add a charger",
  vehicle_search: "Car picker",
  updates: "Station updates",
  feedback: "Feedback",
  charger_alerts: "Charger alerts",
  charger_reviews: "All reviews",
};
export const screenName = (s: string) => SCREEN_NAME[s] ?? human(s);

const ACTION_NAME: Record<string, string> = {
  charger_viewed: "Charger opened",
  search_completed: "Map search or filter applied",
  route_requested: "Route asked",
  route_succeeded: "Route found",
  route_failed: "Route failed",
  navigation_launched: "Navigation opened",
  notification_permission_result: "Notification permission answered",
  regions_updated: "Followed regions changed",
  region_prompt_shown: "Region alerts prompt shown",
  region_prompt_responded: "Region alerts prompt answered",
  notification_opened: "Notification opened",
  onboarding_finished: "Onboarding finished",
  location_permission_result: "Location permission answered",
  filter_changed: "Map filter changed",
  list_sorted: "List sort changed",
  favorite_toggled: "Favorite on or off",
  trip_saved: "Trip saved",
  trip_shared: "Trip shared",
  vehicle_added: "Car added",
  vehicle_search_completed: "Car searched",
  review_started: "Review started",
  add_charger_started: "Add a charger started",
  charger_submitted: "Charger sent",
  language_changed: "Language changed",
  theme_changed: "Theme changed",
  directions_tapped: "Navigate tapped",
};
export const actionName = (event: string) => ACTION_NAME[event] ?? human(event);

const SOURCE: Record<string, string> = {
  map: "from the map",
  list: "from the list",
  favorites: "from favorites",
  search: "from search",
  trip: "from a trip",
  updates: "from station updates",
  notification: "from a notification",
  link: "from a link",
  charger: "from a charger",
  trip_planner: "from the trip planner",
  onboarding: "in onboarding",
  settings: "in settings",
  card: "from the alerts card",
  prompt: "from the prompt",
  inbox: "from the inbox",
};

const DETAIL: Record<string, Record<string, string>> = {
  app_opened: { launch: "launch", foreground: "back to the app", enabled: "analytics turned on" },
  favorite_toggled: { true: "on", false: "off" },
  language_changed: { fr: "to French", ar: "to Arabic", en: "to English" },
  theme_changed: { auto: "auto", light: "light", dark: "dark" },
  region_prompt_responded: { accepted: "accepted", dismissed: "dismissed" },
  vehicle_search_completed: { found: "found a car", no_result: "found nothing" },
  onboarding_finished: { added: "with a car", skipped: "car skipped" },
  route_failed: { network: "connection failure", no_route: "no driving route", service_unavailable: "routing service down" },
  search_completed: { all: "all", fast: "fast" },
  filter_changed: { all: "all", fast: "fast" },
};

export const RESULT_NAME: Record<string, string> = { granted: "allowed", denied: "denied", undetermined: "not answered" };
export const PERMISSION_SOURCE: Record<string, string> = {
  map_locate: "Map, locate button",
  map_trip: "Map, trip button",
  trip_planner: "Trip planner",
  auto: "On its own",
  region: "Region alerts",
  settings: "Settings",
  prompt: "Region alerts prompt",
  card: "Alerts card",
  inbox: "Inbox",
};

/** "on", "from the map", "no source (older build)". */
export const detailName = (event: string, detail: string): string => {
  if (detail === "") return event === "charger_viewed" || event === "navigation_launched" ? "no source (older build)" : "";
  if (event === "location_permission_result" || event === "notification_permission_result") {
    const [result, source] = detail.split(":");
    return `${RESULT_NAME[result] ?? human(result)}, ${(PERMISSION_SOURCE[source] ?? human(source ?? "")).toLowerCase()}`;
  }
  return DETAIL[event]?.[detail] ?? (["charger_viewed", "navigation_launched", "vehicle_added", "regions_updated"].includes(event) ? SOURCE[detail] : undefined) ?? human(detail);
};

export const WARNING_NAME: Record<string, string> = {
  none: "No warning",
  brand_exclusive: "Brand-only warning",
  private_emergency: "Private, emergency only",
  employees_only: "Employees-only warning",
  customers_only: "Customers-only warning",
  closed_today: "Closed today",
  closed_later: "Closes later today",
  closed_permanent: "Closed for good",
};
export const warningName = (w: string) => WARNING_NAME[w] ?? human(w);

export const FAILURE_NAME: Record<string, string> = {
  network: "Connection failure",
  no_route: "No driving route",
  service_unavailable: "Routing service unavailable",
  unknown: "No reason recorded",
};
export const failureName = (r: string) => FAILURE_NAME[r] ?? human(r);

export const PERMISSION_NAME: Record<string, string> = { location: "Location", notification: "Notifications" };
export const permissionName = (k: string) => PERMISSION_NAME[k] ?? human(k);
