# Mock vs real

What's wired to live data, what's behind an Edge Function, what's stripped because no source exists.

✅ live anon · 🔐 live via admin EF · ⚠️ stripped (no data source)

## Overview page

| Card | Status | Source |
|---|---|---|
| Total chargers | ✅ | `count(*) from chargers` |
| Operational % | ✅ | `count(*) filter (where status='operational')` |
| Verified % | ✅ | `count(*) filter (where is_verified)` |
| New chargers this week | ✅ | `count(*) where created_at >= 7d ago` |
| Verified this week | ✅ | `count(*) where verified_at >= 7d ago` |
| Public access count | ✅ | `count(*) filter (where access_type='public')` |
| Pending submissions | ✅ | `count(*) from community_submissions where status='pending'` |
| Avg rating | ✅ | `avg(rating)` from `ratings` |
| Status donut | ✅ | `GROUP BY status` from chargers |
| Connector type stack (range-aware) | ✅ | cumulative catalogue size per connector at each bucket end; 7d/30d/90d/1y selector, daily→weekly→monthly grain |
| Power distribution histogram | ✅ | `max(power_kw)` per charger, bucketed |
| Access type split | ✅ | `GROUP BY access_type` |
| Submissions funnel + approval rate | ✅ | `GROUP BY status` from community_submissions |
| Rating trend (range-aware) | ✅ | bucketed `avg(rating)` from `ratings`; 7d/30d/90d/1y selector. A bucket with no ratings is `null` and the line breaks there rather than diving to zero stars |
| Per-card CSV export | ✅ | `lib/csv.ts`; every chart card with tabular data, plus a page-level "Export" of all KPIs and slices |
| Header "Add charger" | ✅ | navigates to `#/chargers?add=1`, which opens the modal on arrival |
| Tunisia coverage map | ✅ | full chargers list + Google Maps |
| ~~Avg uptime~~ | ⚠️ | no fleet-wide uptime metric |
| ~~Unread feedback~~ | ⚠️ | feedback is service-role; needs EF |
| ~~Open review reports~~ | ⚠️ | review_reports is service-role; needs EF |
| ~~DAU/WAU/MAU~~ | ⚠️ | no event log |
| ~~New users this week~~ | ⚠️ | no auth.users access |
| ~~Registered vehicles~~ | ⚠️ | user_vehicles is RLS-blocked from anon |
| ~~Trip plans created~~ | ⚠️ | no trips table |
| ~~Coverage by gouvernorat~~ | ⚠️ | only `city`, no gouvernorat column |
| ~~Verification velocity per admin~~ | ⚠️ | no per-row history |
| ~~Top requested locations~~ | ⚠️ | no source |
| ~~OCM sync status~~ | ⚠️ | no last-run table |
| ~~Activity feed~~ | ⚠️ | no event log |
| ~~Feedback by category area~~ | ⚠️ | feedback is service-role |

The header subtitle ("X pending submissions waiting for review") uses real `useOverviewStats` data, not mock numbers.

## Chargers page

| Field | Status | Source |
|---|---|---|
| Name, city, connectors, power, status, access, source | ✅ | `search_chargers` RPC |
| Working hours (table column + drawer grid) | ✅ | `working_hours` JSONB |
| Amenities chips in drawer (icons + labels) | ✅ | `amenities` TEXT[] from `search_chargers` |
| Verified flag | ✅ | `is_verified` |
| Verified-by chip in drawer | ✅ | `verified_by` |
| Map link button | ✅ | `window.open` to Google Maps |
| Mini map in drawer | ✅ | Google Maps via `@vis.gl/react-google-maps` |
| Pagination (table footer) | ✅ | client-side slice; `page` / `per` live in the hash, default 25/page |
| Column sorting | ✅ | all columns except Connectors; `sort=<key>:<dir>` in the hash, `aria-sort` on the header, numbers/dates start descending |
| In-table search | ✅ | name / city / id, 250 ms debounce into `q=` |
| Multi-value filters | ✅ | status, access, connector, source, city (searchable, with counts) — each a comma list in the hash |
| Single-value filters | ✅ | power bucket, verified, hours set/missing, updated within 7/30/90 days |
| Updated column | ✅ | `updated_at`, relative, full timestamp on hover |
| CSV export | ✅ | the rows currently shown, in the shown order, incl. lat/lng and id |
| Keyboard | ✅ | rows are focusable, Enter/Space opens the drawer, Escape closes it |
| **Verify** button → mark verified | 🔐 | `admin-verify-charger` EF |
| **Add charger** modal | 🔐 | `admin-add-charger` EF — same fields as the `charger-adder` agent's migration template |
| Deep-link from topbar search | ✅ | `#/chargers?id=<uuid>`; `App.tsx` reads the hash param, page opens drawer on mount |
| ~~Edit override~~ | ⚠️ | UI exists but no-op for now |
| ~~Gouvernorat column~~ | ⚠️ | no column — replaced by `city` |

## Submissions page

| Field | Status |
|---|---|
| Status tabs + counts | ✅ |
| Card list (id, name, submitter, notes, created date) | ✅ |
| `reviewed_at` chip on approved/rejected | ✅ |
| Pagination (per-tab, default 12/page; resets on tab switch) | ✅ |
| ~~Type chip (new/edit/report)~~ | ⚠️ schema only supports "new charger" |
| ~~Mini-map per card~~ | ⚠️ removed for v1 |
| Approve/Reject buttons | ⚠️ rendered for pending only; not wired (would need an EF) |

## Reviews page

| Field | Status |
|---|---|
| Stream of latest 200 ratings + charger name | ✅ |
| Star rating 1-5 + comment | ✅ |
| Rater UID (truncated) | ✅ |
| Pagination (default 20/page) | ✅ client-side slice over the cap |
| ~~Helpful count~~ | ⚠️ no column on `ratings` |
| ~~Reported reviews queue~~ | ⚠️ `review_reports` service-role |
| ~~Hide / Approve actions~~ | ⚠️ would need an EF |

## Driver visits page

Charging confirmations drivers submit after visiting a station. The
`charging_confirmations` table has no client policies at all (REVOKEd from
anon/authenticated), so every field here goes through the
`admin-confirmations` EF — none of it is reachable with the anon key.

| Field | Status | Source |
|---|---|---|
| Visit date, outcome, failure reason, connector | 🔐 | `charging_confirmations` |
| Charger name + city | 🔐 | PostgREST embed on the `charger_id` FK |
| Driver UID (click → `#/users?user=`) | 🔐 | `user_id` |
| Reported (relative time) | 🔐 | `submitted_at` |
| Summary: total / charged / failed / last 7d / drivers | 🔐 | whole-table counts, not the current filter |
| Outcome + visibility filters | 🔐 | server-side query params |
| **Hide / Unhide** | 🔐 | `moderate_charging_confirmation` RPC (service-role) |
| Pagination | 🔐 | server-side `page` / `perPage` |

Hiding takes effect in the app immediately — `get_charging_confirmations`
filters on `hidden_at IS NULL`. The app shows only the last 5 visible reports
from the past 30 days per charger; this page shows every report ever
submitted.

## Users page

| Field | Status |
|---|---|
| User ID (mono, copy on click) | 🔐 admin-users EF |
| Device: platform, OS version, model, screen size | 🔐 newest `app_analytics_events` row per user |
| App version + language | 🔐 same |
| Vehicle (make + model + variant + +N chip) | 🔐 |
| Visits count | 🔐 `charging_confirmations` per user |
| Activity (sessions + last event) | 🔐 distinct `session_id` + latest `occurred_at` |
| Joined / Last active | 🔐 |
| Vehicles count | 🔐 |
| "Engaged only" filter | 🔐 union of analytics / vehicles / visits, ranked by last trace |
| Exact-UUID lookup (`#/users?user=`) | 🔐 `getUserById`; a prefix returns empty by design |
| Pagination | 🔐 server-side via the EF's `page` / `perPage` query params |
| ~~Email~~ | ⚠️ Charj uses anon auth, almost always empty |
| ~~Reviews count~~ | ⚠️ all 0 due to anon-auth orphans (see SCHEMA_NOTES) |
| ~~Submissions count~~ | ⚠️ same |
| ~~Role / admin flag~~ | ⚠️ no roles table |

Device model / OS / screen are null for events predating the device-context
update (OTA `v1.2.1-ota.23`) and absent entirely for users who opted out of
analytics. See KNOWN_ISSUES #5.

## Vehicles page

| Field | Status |
|---|---|
| Make, model, variant | ✅ |
| Year range | ✅ |
| Battery (usable preferred, falls back to gross) | ✅ |
| Max DC charging (or AC) | ✅ |
| Connector chips | ✅ |
| Source badge | ✅ |
| Header breakdown by source | ✅ |
| Pagination (default 24/page, grid-friendly) | ✅ client-side slice |
| ~~Owners count~~ | ⚠️ user_vehicles RLS-blocked from anon |
| ~~Color~~ | ⚠️ no column |

## Map page

✅ Real Google Maps, all chargers as status-colored pins, click → InfoWindow with name / city / power / hours / connectors / status. Driven by the same `useChargers()` hook as the Chargers page.

## Feedback page

⚠️ EmptyState only. The `feedback` table is service-role-only; needs a future `admin-feedback` Edge Function (mirror of admin-users) to surface here.

## Settings page

⚠️ Placeholder. Workspace, integrations, OCM API keys, admin roles — all defer to when we have real auth.

## Sidebar badges

| Badge | Status |
|---|---|
| Chargers | ✅ `count(*) from chargers` |
| Submissions (with accent glow when > 0) | ✅ `count(*) where status='pending'` |
| Reviews | ✅ `count(*) from ratings` |
| Feedback | ⚠️ no badge — service-role required |

## Topbar

| Element | Status | Source |
|---|---|---|
| User avatar (`AB` / "Ala") | ✅ hardcoded — single admin today |
| Theme toggle | ✅ `useTweaks` |
| Global search (⌘K) | ✅ `useGlobalSearch` — `search_chargers` RPC + in-memory NAV match |
| Search → page row click | ✅ navigates via `useRoute().navigate` (updates the hash) |
| Search → charger row click | ✅ deep-links to `#/chargers?id=<uuid>` → drawer opens on the chargers page |
| ~~Search across users / vehicles / reviews~~ | ⚠️ would need EF query params or a cross-page state lift |
| ~~Help / Notifications buttons~~ | ⚠️ removed — nothing to surface yet |
