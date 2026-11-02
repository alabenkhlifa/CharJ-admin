// What the Usage page is looking at (window, environment, platform, design)
// and the plain sentences that depend on it. No React here.

import {
  filterUsage,
  firstLuneDay,
  luneSeen,
  onPlatform,
  permissionTable,
  stepTotals,
  tapRows,
  type UsageDays,
  type UsageEnvironment,
  type UsagePlatform,
  type UsageReport,
  type UsageUi,
} from "../data/usage-report";
import { plural } from "../lib/health-format";
import { ENV_LABEL, platformName, UI_NAME, type FilterKey } from "./usage-labels";

export type UsageFilters = { days: UsageDays; platform: UsagePlatform; ui: UsageUi; env: UsageEnvironment };

export type UsageScope = UsageFilters & {
  /** The report narrowed to the platform and design filters. */
  report: UsageReport;
  /** The Lune design sent events in the window (on this platform). */
  lune: boolean;
  /** Its first day, for charts that start with it. */
  firstLune: string | null;
  /** Lune events on any platform: for counts the server doesn't split. */
  luneAnywhere: boolean;
};

export const makeScope = (raw: UsageReport, f: UsageFilters): UsageScope => {
  // Has Lune started? Asked of every design on the platform, not the filtered rows.
  const designs = onPlatform(raw, f.platform);
  return {
    ...f,
    report: filterUsage(raw, { platform: f.platform, ui: f.ui }),
    lune: luneSeen(designs),
    firstLune: firstLuneDay(designs),
    luneAnywhere: luneSeen(raw),
  };
};

export const LUNE_SOON = "Starts with the Lune update.";
export const CLASSIC_ONLY = "Only the Lune design sends these events.";

/** Under the Lune filter before any Lune event: every split section is empty for that reason. */
export const lunePending = (s: UsageScope) => s.ui === "lune" && !s.lune;

/** Classic or No label: designs that never send Lune-only events. */
export const notLune = (s: Pick<UsageScope, "ui">) => s.ui === "classic" || s.ui === "unknown";

/** Why a Lune-only chart is empty, or null when an empty one is a real zero. */
export const luneOnlyNote = (s: UsageScope): string | null => (notLune(s) ? CLASSIC_ONLY : !s.lune ? LUNE_SOON : null);

/**
 * For Lune-only counts the server doesn't split (contributions started, missing
 * cars): not shown under Classic or No label, where they'd claim Lune events
 * for another design; and not before any Lune event.
 */
export const luneUnsplitNote = (s: UsageScope): string | null => (notLune(s) ? CLASSIC_ONLY : s.luneAnywhere ? null : LUNE_SOON);

export const windowText = (days: UsageDays) => `the last ${days} days`;

/** "phones", "iOS phones", "Android phones on the Lune design". */
export const who = (s: Pick<UsageScope, "platform" | "ui">) => {
  const p = s.platform === "all" ? "" : `${platformName(s.platform)} `;
  const d = { all: "", lune: " on the Lune design", classic: " on the classic design", unknown: " on builds with no design label" }[s.ui];
  return `${p}phones${d}`;
};

/** A section the server doesn't split, while a platform or design filter is on. */
export const unsplitNote = (s: UsageScope, { platform = true, ui = true } = {}): string | null => {
  const p = platform && s.platform !== "all";
  const u = ui && s.ui !== "all";
  if (!p && !u) return null;
  const what = p && u ? "platform or design" : p ? "platform" : "design";
  return `Not split by ${what}: this counts every phone.`;
};

/** "Last 30 days · Production · iOS · Lune": only the filters the view uses. */
export const scopeLine = (f: UsageFilters, keys: FilterKey[]) =>
  [
    keys.includes("days") && `Last ${f.days} days`,
    keys.includes("env") && ENV_LABEL[f.env],
    keys.includes("platform") && f.platform !== "all" && platformName(f.platform),
    keys.includes("ui") && f.ui !== "all" && UI_NAME[f.ui],
  ]
    .filter(Boolean)
    .join(" · ");

/** "0.4 s" for a route answer; "—" when there is none. */
export const seconds = (ms: number | null) => (ms == null ? "—" : `${(ms / 1000).toFixed(1)} s`);

export type FunnelKey = "onboarding" | "trip" | "navigate" | "contributions" | "permissions";

/** One line per funnel for the overview card: its first and last step, as counts. */
/** What the Funnels card can't narrow: contributions (any filter), permissions (platform). */
export const funnelsUnsplitNote = (s: UsageScope): string | null => {
  const parts = [
    (s.platform !== "all" || s.ui !== "all") && "Contributions aren't split by platform or design",
    s.platform !== "all" && "permissions aren't split by platform",
  ].filter(Boolean);
  return parts.length ? `${parts.join(", and ")}: they count every phone.` : null;
};

export const funnelSummaries = (s: UsageScope): { key: FunnelKey; name: string; text: string }[] => {
  const f = s.report.funnels;
  const pending = lunePending(s);
  const lune = luneOnlyNote(s);
  const n = (v: number) => v.toLocaleString("en-US");
  const people = (step: string, rows = f.onboarding) => stepTotals(rows, step).users;
  const persons = (v: number) => (v === 1 ? "1 person" : `${n(v)} people`);

  const onboarding = (() => {
    if (pending) return LUNE_SOON;
    const shown = people("shown");
    const reached = people("reached_map");
    if (!shown && !people("finished") && lune) return lune;
    return `${n(shown)} shown · ${n(reached)} reached the map`;
  })();

  const trip = (() => {
    if (pending) return LUNE_SOON;
    const navigated = people("navigation_launched", f.trip);
    if (lune) return `${persons(people("route_requested", f.trip))} asked a route · ${n(navigated)} navigated`;
    return `${n(people("opened", f.trip))} opened · ${n(navigated)} navigated`;
  })();

  const navigate = (() => {
    if (pending) return LUNE_SOON;
    const taps = tapRows(s.report);
    const opened = stepTotals(f.navigate.launched, "navigation_launched").events;
    if (lune) return `${plural(opened, "navigations")} opened`;
    return `${plural(taps.reduce((a, t) => a + t.taps, 0), "taps")} · ${n(taps.reduce((a, t) => a + t.went, 0))} went`;
  })();

  const contributions = (() => {
    const c = f.contributions;
    // Started and sent are Lune-only events, and none of these are split by design.
    if (luneUnsplitNote(s)) return `${plural(c.reviews_posted, "reviews")} posted`;
    return `${plural(c.review_started, "reviews")} started · ${n(c.reviews_posted)} posted · ${plural(c.submitted, "chargers")} sent`;
  })();

  const permissions = (() => {
    if (pending) return LUNE_SOON;
    const kinds = permissionTable(s.report);
    const asked = kinds.reduce((a, k) => a + k.asked, 0);
    if (!asked && lune) return lune;
    return `${n(asked)} asked · ${n(kinds.reduce((a, k) => a + (k.results.granted ?? 0), 0))} allowed`;
  })();

  return [
    { key: "onboarding", name: "Onboarding", text: onboarding },
    { key: "trip", name: "Trip planner", text: trip },
    { key: "navigate", name: "Navigate from a charger", text: navigate },
    { key: "contributions", name: "Contributions", text: contributions },
    { key: "permissions", name: "Permissions", text: permissions },
  ];
};
