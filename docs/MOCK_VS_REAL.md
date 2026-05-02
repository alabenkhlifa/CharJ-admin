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
| Connector type stack (8 months) | ✅ | client-side aggregation of JSONB connectors over `created_at` |
| Power distribution histogram | ✅ | `max(power_kw)` per charger, bucketed |
| Access type split | ✅ | `GROUP BY access_type` |
| Submissions funnel + approval rate | ✅ | `GROUP BY status` from community_submissions |
| Rating trend (12 weeks) | ✅ | weekly `avg(rating)` from `ratings` |
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
| Pagination (table footer) | ✅ | client-side slice via `usePaginated`; default 25/page |
| **Verify** button → mark verified | 🔐 | `admin-verify-charger` EF |
| **Add charger** modal | 🔐 | `admin-add-charger` EF — same fields as the `charger-adder` agent's migration template |
| Deep-link from topbar search | ✅ | `pendingChargerId` lifted in `App.tsx`; page opens drawer on mount |
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

## Users page

| Field | Status |
|---|---|
| User ID (mono, copy on click) | 🔐 admin-users EF |
| Vehicle (make + model + variant + +N chip) | 🔐 |
| Joined / Last active | 🔐 |
| Vehicles count | 🔐 |
| Pagination | 🔐 server-side via the EF's `page` / `perPage` query params |
| ~~Email~~ | ⚠️ Charj uses anon auth, almost always empty |
| ~~Reviews count~~ | ⚠️ all 0 due to anon-auth orphans (see SCHEMA_NOTES) |
| ~~Submissions count~~ | ⚠️ same |
| ~~Role / admin flag~~ | ⚠️ no roles table |

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
| Search → page row click | ✅ navigates via `setActive` |
| Search → charger row click | ✅ deep-links via `pendingChargerId` (App.tsx) → drawer opens on the chargers page |
| ~~Search across users / vehicles / reviews~~ | ⚠️ would need EF query params or a cross-page state lift |
| ~~Help / Notifications buttons~~ | ⚠️ removed — nothing to surface yet |
