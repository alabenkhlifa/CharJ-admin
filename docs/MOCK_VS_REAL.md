# Mock vs real

What every page shows and where each number comes from. Nothing on the dashboard is a mock: a number either comes from a source below or is left out. The approved mockup (`docs/mockups/admin-dashboard.html`) only fed the design; its snapshot is used by the browser tests, never by the app.

✅ live anon · 🔐 live via admin EF · ⚠️ left out (no data source)

Truth rules everywhere (DESIGN.md "Empty and not tracked states"): under 10, counts and no percentage; a percentage always carries its count; days nobody measured read "not tracked"; people are never summed across app designs; a source that fails is unknown, never 0.

## Summary (`#/summary`)

The home page: is the app healthy, and what needs you. `?env=` switches Production / Preview / Development for the usage numbers (the queue has no environment).

| Card | Status | Source |
|---|---|---|
| Today: Active ring (today vs goal = rounded 7-day average) | 🔐 | `admin-usage` summary: `today.active`, `avg7`; segmented under 10 |
| Today: Came back ring (last finished install week, back within 7 days) | 🔐 | `cohort`; "—" when no week has finished |
| Today: Queue clear ring | 🔐 | the queue total (below); full only when nothing waits, unknown while a source fails |
| Highlight line (vs the same weekday last week) | 🔐 | `same_day_last_week.active`, up to the same time of day |
| Needs you: open feedback requests, couldn't charge (7 days), pending submissions, open review reports, with the newest items | 🔐 | `admin-feedback` `summary.open_requests`, `admin-confirmations` `summary.window`, `admin-submissions` `counts.pending`, `admin-review-reports` `open`; each row opens its filtered Community tab |
| Active phones: 7-day average, 30-day sparkline | 🔐 | `daily`; untracked days hatched, kept out of the average |
| Came back: n of N in 7 days | 🔐 | `cohort` (counts only under 10 installs) |
| Versions in use (users per build and design) + languages | 🔐 | `versions`, `languages` ("users per …", never shares: an upgrader or a switcher counts twice) |
| Dropped events warning | 🔐 | `dropped_7d` > 0 |
| ~~DAU/WAU/MAU split, sessions~~ | ⚠️ | not in the report; Usage has daily active per platform |

## Usage (`#/usage`)

One card per category, grouped under the questions (Is anyone using it? Do people come back? Which features get used? Where do people get stuck? Cars and Android Auto, Who uses it?). Each card opens its drill-in (`?section=`). Filters in the URL: `?days=7|30|90` (refetches), `?platform=`, `?ui=` (Any design / Lune / Classic / No label), `?env=`; a section shows only the filters that change it.

| Section | Status | Source |
|---|---|---|
| Activity: active phones and events per day (90 days: Monday weeks) | 🔐 | `admin-usage` usage `daily` (`ui='all'` for Any design) |
| Coming back: day 1 / 7 / 30 return per install week, chips on phones, a table from 600px | 🔐 | `cohorts` (every install week); open windows say so, untracked ones say "not tracked" |
| Languages: users per language, language switches | 🔐 | `languages`, `actions` (`language_changed`) |
| Screens: views and people per screen | 🔐 | `screens` |
| Actions: every event by detail | 🔐 | `actions` |
| Funnels: Onboarding, Trip planner, Navigate from a charger (taps by warning → went), Contributions, Permissions | 🔐 | `funnels.*` |
| Cars: searches with no result, the queries; the car catalog | 🔐 / ✅ | `missing_cars`; `ev_models` (anon) for the catalog |
| Routes: answers, failures by reason, p50 / p95 time | 🔐 | `routes` |
| Android Auto | 🔐 | `android_auto`; Idle Grey "No car events yet" until the native build sends them |
| Users: every user with device, app version, language, vehicle, visits, sessions, last seen; `?user=` lookup, `?show=engaged` | 🔐 | `admin-users` (server-paged) |
| ~~App-version filter~~ | ⚠️ | usage rows carry no `app_version` (versions are on Summary) |
| ~~Reviews / submissions per user~~ | ⚠️ | anonymous-auth orphans (SCHEMA_NOTES), always 0 |
| ~~Email, role~~ | ⚠️ | anonymous auth, no roles table |

Device model / OS / screen are null for events before the device-context update (OTA `v1.2.1-ota.23`) and absent for users who opted out of analytics. See KNOWN_ISSUES.

## Community (`#/community`)

The queue page. Four tabs (`?tab=`), each badge the same count as Needs you and the nav badge. Lists reload by hand (Refresh) and after an action; a row flips in place.

| Tab | Status | Source |
|---|---|---|
| Feedback: open requests by default (design votes left out), Status and Show filters with counts, stats (open requests, resolved, received 7 days / all time), resolve / reopen | 🔐 | `admin-feedback` (`category=requests`, `summary.open_requests`) |
| Design votes: likes / doesn't like, a share only from 10 votes, platform split, latest comments | 🔐 | `admin-feedback` `category=design` (up to 500 votes) |
| Submissions: pending / approved / rejected / all, details, photos, nearby chargers (100 m), Approve (dialog, optional Arabic name / address / operator, opens the editor) and Reject (note) | 🔐 | `admin-submissions`; nearby from `search_chargers` (anon) |
| Reviews: review reports (open / resolved / all) with the review behind "Show review", resolve / reopen | 🔐 | `admin-review-reports` |
| Reviews: recent reviews (latest 200) | ✅ | `ratings` joined with `chargers(id, name)` |
| Driver visits: outcome, shown in the app, visit date window; stats, hide (with a reason) / unhide, open the driver in Usage → Users | 🔐 | `admin-confirmations` (`since_days`) |
| ~~Helpful count on reviews~~ | ⚠️ | no column on `ratings` |

Hiding a visit takes effect in the app at once (`get_charging_confirmations` filters on `hidden_at IS NULL`). The app shows the last 5 visible reports from the past 30 days per charger; this page has every report.

## Chargers (`#/chargers`)

One `search_chargers` read feeds three views and one detail drawer.

| View / element | Status | Source |
|---|---|---|
| List: name, power, place (city, governorate; "no city" when unlinked), status, connectors, access, hours, source, updated | ✅ | `search_chargers` RPC |
| Filters (status, access, connector, source, governorate, city, power, verified, hours, updated, search), sort, pages — all in the hash | ✅ | in memory over the same rows; governorates / cities from their tables |
| Export (CSV of every matching row, in order) | ✅ | `lib/csv.ts` |
| Map: the filtered rows as status pins, count, pin key | ✅ | Google Maps + the same rows |
| About the network: Needs a look (not verified, no city, no hours), Status, Connectors, Access, Power, Coverage (governorates with a charger), each with Show table and Download CSV | ✅ | the same rows + `governorates` |
| Drawer: tags, hours (today in Tunis), amenities, facts, Arabic address, mini map | ✅ | the same row |
| Drawer: Operational / Under repair | 🔐 | `admin-set-charger-status` |
| Drawer: Verify | 🔐 | `admin-verify-charger` |
| Drawer: Edit charger (structured editor, `?id=&edit=1`) | 🔐 | `admin-update-charger` |
| Drawer: Announce update (when the charger has a suggestion) | 🔐 | `admin-notifications?charger_id=` + the announce dialog |
| Add charger (`?add=1`), city picker, Add city | 🔐 | `admin-add-charger`, `admin-cities`; `suggest_city` / `governorate_for_point` (anon) |
| ~~Uptime, reliability per charger~~ | ⚠️ | no fleet-wide metric |
| ~~OCM sync status~~ | ⚠️ | no last-run table |

## Notifications (`#/notifications`)

Region alerts. Everything goes through the `admin-notifications` EF; the queue, batches, followers and devices tables are service-role only. Pushes are templated: there is no free-text field.

| Field | Status | Source |
|---|---|---|
| Period (7 / 30 / 90 days) | 🔐 | `days=` on the GET; narrows history + funnel only (pending is always the last 24 h, suggestions the last 7 days) |
| Mode note (dispatcher every 5 min, quiet hours 22:00–08:00 Tunis) + "Quiet hours now" | 🔐 | static rule + `totals.quiet_now` |
| **Pending**: charger, governorate, kind / update class, held vs released, queued time, Needs review | 🔐 | `pending[]` |
| Pending countdown + ETA (Tunis time) | 🔐 | `pending[].eta`, ticked every 15 s against the server clock (`server_time` skew) |
| **Cancel** (inline confirm), **Send now** (preview dialog) | 🔐 | POST `cancel`; POST `preview` then `release` |
| **Suggested updates**: class, before → after, recipients + with push; **Announce** (preview dialog, FR / AR rtl / EN), **Dismiss** | 🔐 | `suggestions[]`; POST `preview` then `announce`; POST `dismiss`; 10 announcements / 24 h |
| **History**: date, source, events, recipients, devices, accepted, receipts, errors, opens (open rate "≥ x%") | 🔐 | `history[]`, 10 a page |
| **Subscribers by governorate** (with push / inbox only), **Reach** | 🔐 | `subscribers[]`, `totals` |
| **Opt-in funnel** | 🔐 | `funnel` (distinct users per step, each step independent) |
| Charger name → Chargers drawer | ✅ | `#/chargers?id=` |

## Settings (`#/settings`)

| Field | Status | Source |
|---|---|---|
| Theme (System / Light / Dark), shared with every page's title toggle | ✅ | `localStorage["charj-admin:tweaks"]` (`src/lib/theme.ts`) |
| Signed in as, Sign out | ✅ | the Supabase Auth session |
| Version, commit | ✅ | `package.json`, `git describe --always --dirty` at build time |
| Notifications row (phones only) | ✅ | link to `#/notifications` |

## Shell

| Element | Status | Source |
|---|---|---|
| Community badge (tab bar and sidebar) | 🔐 | the queue total; no badge at 0 or while unknown |
| Sidebar search (⌘K, 768px and up) | ✅ | `search_chargers` RPC + in-memory NAV match; a charger opens `#/chargers?id=` |
| Signed-in email, sign out (with the reason when it fails) | ✅ | the session |
| ~~Search on phones~~ | ⚠️ | the sidebar is the only place for it; phones use the Chargers list search |
