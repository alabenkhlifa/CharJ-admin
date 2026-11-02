# Charj Admin

Web admin dashboard for the Charj EV charger app. Static SPA on **GitHub Pages**, talks to the same Supabase backend as the mobile app.

Live: https://alabenkhlifa.github.io/CharJ-admin/
Repo: https://github.com/alabenkhlifa/CharJ-admin
Mobile app sibling: `../charj/` (different repo, but they share the Supabase project + Google Maps key).

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173 (or 5174 if 5173 busy)
npm run build        # production build into dist/
npx tsc -b --noEmit  # type check
```

Local `.env` should mirror `.env.example`. There is no auth bypass: local dev signs in with a Supabase Auth admin account (see [AUTH.md](docs/AUTH.md)). Without the Supabase vars the sign-in card reports "not configured".

## Stack

- **Vite + React 19 + TypeScript strict**
- **CSS variables + small CSS files** — no Tailwind, no shadcn. Tokens in `src/index.css`, the Health Rings UI kit in `src/ui/` (`ui.css`, `shell.css`), one stylesheet per page. Inline styles only for dynamic values (a bar's width, a category's colour). Logical properties (`inset-inline-start`, `padding-inline-end`) so RTL flips cleanly.
- **`@supabase/supabase-js`** for anon-readable tables + Supabase Auth sign-in, **`adminFetch`** (session token) for admin Edge Functions
- **`@vis.gl/react-google-maps`** for Google Maps (the Chargers map view, the mini map in the detail drawer)
- **`@fontsource-variable/inter`**: the self-hosted SF-like face for non-Apple devices (Apple devices keep the system face)

## Must-do rules

- **Anon key only from the browser.** Never bundle the service-role key. Anything that needs service role goes through an admin Edge Function in the mobile-app repo (`../charj/supabase/functions/`).
- **All `VITE_*` env vars are public** — they get inlined into the JS bundle at build time. Treat them as visible to anyone who reads the bundle. The admin session (checked server-side against `public.admins`) + Supabase RLS are the actual gate, never secrecy of a var.
- **Admin Edge Function calls go through `adminFetch`** (`src/lib/admin-fetch.ts`). Never hand-build an `Authorization` header or bundle a shared secret.
- **DESIGN.md is binding.** The look (Health Rings: grouped ground, flat 16px cards, one colour per category, bold tabular numbers) and its rules live in [DESIGN.md](DESIGN.md), with the tokens in `.impeccable/design.json`; the product's purpose in [PRODUCT.md](PRODUCT.md). Build pages from the kit in `src/ui/` (HealthCard, LargeTitle, Rings, Columns, HBars, Ladder, ListRow, Bubble, Segmented, Pager, TableView, `.ui-btn`, `.ui-link`, `.ui-dialog`, `.ui-error`, `.ui-notice`); don't copy kit styles into a page stylesheet.
- **Colours come from tokens only.** Category colours are `--c-<category>` (base, for rings and bars), `--c-<category>-text` (text and bubbles) and `--c-<category>-fill` (squares) in `src/index.css`; `tests/tokens.test.ts` checks every text tone at 4.5:1. Charger status and connector colours come from `src/data/chargers.ts` palettes, as domain marks only. Never hardcode a colour.
- **Logical properties only** — `inset-inline-start`, `margin-inline-end`. No `left` / `right` for layout positioning.
- **768px is the only layout switch** — under it, the phone tab bar (five tabs; Notifications is a row in Settings); from it, the 260px sidebar. Inside a page, layouts follow the room the page has (container queries). Content is at most 1120px wide, centred (the Chargers map view lifts the cap). Test layouts at 375 / 768 / 1440 — `main.scrollWidth` must equal `main.clientWidth` on every page (`tests/pages.browser.mjs` checks every route).
- **Don't fabricate data.** If a metric has no anon-readable source and no Edge Function, drop the card or show an honest empty state. Under 10, show counts and no percentage; a percentage always carries its count. Days nobody measured (`src/lib/tracking.ts`) read "not tracked", never 0. People are counted once: never sum people across app designs.
- **Routing is the URL hash** (`src/lib/use-route.ts`). Add a page by extending `RouteKey` + `NAV`; never reintroduce `useState` for the active page — a refresh has to land back on the same screen. Old links keep working through `src/lib/legacy-redirect.ts` (`#/analytics` → Usage, `#/users?user=` → Usage → Users, `#/feedback` → Community, `#/map` → Chargers map…).
- **View state lives in the hash too.** Sections, tabs, filters, sort and page are query params (`#/usage?section=activity&days=30&platform=ios`, `#/community?tab=visits&outcome=could_not_charge&since=7`, `#/chargers?status=operational,planned&sort=power:desc&q=tunis`), so a narrowed view is a link you can paste and a refresh lands on the same rows. Never shadow a URL param with `useState`. Merge into the existing params (`patchParams` in `App.tsx`) — a bare `replace("chargers")` wipes the view out from under the user.
- **No decorative controls.** A button that only moves its own highlight teaches the reader to distrust every other number on the page. A filter appears only where it changes what the section shows (`SECTION_FILTERS` in `src/pages/usage-labels.ts`). If a control can't work yet, leave it out rather than stubbing it.
- **The queue is one read.** What waits in Community (open feedback requests, couldn't charge in 7 days, pending submissions, open review reports) comes from `useQueue()` in `App.tsx`, shared by Summary's Needs you, the Community tab badges and the nav badge. It reads on mount, after every Community action (`queue.refresh()`) and when the page comes back (visible again or the window focused, one read per return); never on a timer, never per page change. A source that fails is unknown (no badge, no total), never 0.
- **Lists reload by hand.** Lists re-read after an action and on a Refresh text action (Feedback, Driver visits, Notifications); nothing polls. A row flip (resolve, hide…) patches the row in place with what the server confirmed, and Refresh waits while one is on its way.

## Pages and routes

| Route | Page | Views in the URL |
|---|---|---|
| `#/summary` | Summary (home): Today rings, Needs you, Active phones, Came back, Versions, Languages | `?env=production\|preview\|development` |
| `#/usage` | Usage: one card per category, each opening its drill-in | `?section=activity\|coming-back\|languages\|screens\|actions\|funnels\|cars\|routes\|android-auto\|users`, `?days=7\|30\|90`, `?platform=`, `?ui=`, `?env=`; Users: `?user=`, `?show=engaged`, `?page=`, `?per=` |
| `#/community` | Community: Feedback (+ Design votes), Submissions, Reviews (reports + recent reviews), Driver visits | `?tab=`, then per tab `?status=`, `?category=`, `?reports=`, `?outcome=`, `?visibility=`, `?since=`, `?page=`, `?rpage=` |
| `#/chargers` | Chargers: List, Map, About the network; detail drawer, editor, Add charger | `?view=map\|stats`, filters `status access conn src gov cities city ver power hours upd q`, `sort`, `page`, `per`; one-shot `?id=` (drawer), `?id=&edit=1` (editor), `?add=1` (modal) |
| `#/notifications` | Notifications: pending, suggested updates, history, subscribers, reach, opt-in funnel | — (the period is local) |
| `#/settings` | Settings: theme, account, build; the Notifications row on phones | — |

## Folder map

```
src/
  App.tsx                    # shell: sidebar / tab bar + the active page; owns useQueue and patchParams
  main.tsx                   # AuthGate → App
  index.css                  # tokens: category tones, ground/card/ink, type ramp, shapes, motion
  ui/                        # the Health Rings kit (DESIGN.md "Components"); ui.css + shell.css
    sidebar.tsx, tab-bar.tsx # navigation (768px switch), Community badge, ⌘K search, sign out
    large-title.tsx          # page title + theme toggle; folds into a fixed bar across the main area
    health-card.tsx, category-square.tsx, hero-value.tsx, list-row.tsx, bubble.tsx, pill.tsx
    rings.tsx, bars.tsx, columns.tsx, hbars.tsx, ladder.tsx, cohort-chips.tsx
    chart-key.tsx, chart-tooltip.tsx, use-chart-tip.ts, table-view.tsx, data-table.tsx
    segmented.tsx, pager.tsx, empty.tsx, tick-number.tsx, theme-toggle.tsx, motion.ts, use-box-width.ts
  pages/
    summary.tsx              # home: rings, Needs you, health cards (admin-usage view=summary + the queue)
    usage.tsx                # overview + drill-ins; usage-overview / -sections / -users / -catalog / -scope / -labels / -bits
    community.tsx            # four tabs; community/ (feedback, submissions + approve dialog, reviews, visits)
    chargers.tsx             # list / map / network views; chargers/ (list, filters, map-view, network, drawer)
    notifications.tsx        # region alerts (admin-notifications)
    settings.tsx             # theme, account, build info
  components/
    add-charger-modal.tsx    # Add charger (admin-add-charger) with the city picker
    edit-charger-drawer.tsx  # structured charger editor (admin-update-charger)
    city-picker.tsx          # searchable city picker grouped by governorate + inline "Add city"
    announce-dialog.tsx      # preview (FR/AR/EN) + confirm for announce / send now
    multi-select-chip.tsx    # checkbox popover chip for the Chargers filters
    search-panel.tsx         # the sidebar search results
  data/                      # hooks + pure parsers (`*-report.ts`, `*-model.ts` are pure: node --test loads them)
    usage.ts, usage-report.ts        # admin-usage (summary / usage views), strict parse, filters, derivations
    queue.ts, queue-report.ts        # the Community queue (four admin reads)
    feedback.ts, feedback-report.ts  # admin-feedback (requests, design votes)
    submissions.ts, submissions-report.ts       # admin-submissions (list, approve / reject)
    review-reports.ts, review-reports-report.ts # admin-review-reports
    visits.ts, visits-report.ts      # admin-confirmations (list, hide / unhide)
    reviews.ts                       # ratings (anon) for Recent reviews
    admin-users.ts, vehicles.ts      # Usage → Users (admin-users), the car catalog (ev_models)
    chargers.ts, charger-catalog.ts  # search_chargers + the list's filters / sort
    charger-actions.ts, charger-editor*.ts      # verify, status, editor
    locations*.ts                    # governorates, cities, suggest_city, admin-cities
    notifications*.ts                # admin-notifications
    admin-load.ts                    # useAdminLoad / getJson / postJson for admin reads and writes
  lib/
    supabase.ts, admin-fetch.ts, admin-session.ts, auth-gate.tsx   # client, admin calls, session, sign-in card
    routes.ts, use-route.ts, legacy-redirect.ts                      # NAV, hash router, old links
    theme.ts, theme-prefs.ts, use-theme.ts                           # the one theme store (System / Light / Dark)
    health-format.ts, tracking.ts                                    # counts-or-percent, rings, untracked spans
    icons.tsx, raw-icon.tsx, amenities.ts, amenity-icons.tsx         # icons, the amenity allowlist and its icons
    use-global-search.ts, table-sort.ts, csv.ts, map-styles.ts, build-info.ts
tests/
  *.test.ts                  # node --test on the pure modules (npm test)
  *.browser.mjs              # Playwright suites against a dev server with every function mocked
  kit/                       # dev-only page with every kit component (kit.browser.mjs)
.github/workflows/deploy.yml # CI: build + deploy to Pages on push to main
```

## Project-scoped docs

Read these before touching the related area. Each is short and gotcha-focused.

- **[DESIGN.md](DESIGN.md)** — the binding design system: colours, type, layout, components, motion, truth rules
- **[PRODUCT.md](PRODUCT.md)** — who it's for and what it must answer
- **[Architecture](docs/ARCHITECTURE.md)** — stack choices, module boundaries, routing, theme, the kit
- **[Auth + access control](docs/AUTH.md)** — Supabase Auth sign-in, the `admins` allowlist, how to add an admin, turning off the legacy secret
- **[Edge Functions](docs/EDGE_FUNCTIONS.md)** — every `admin-*` function: contract, deployment, CORS gotcha
- **[Data layer](docs/DATA_LAYER.md)** — hooks pattern, strict parsers, JSONB shapes, what's anon-readable vs needs an EF
- **[Deployment](docs/DEPLOYMENT.md)** — GH Pages + GH Actions, required secrets, Vite `base` path
- **[Responsiveness](docs/RESPONSIVENESS.md)** — the 768px switch, container queries inside pages, the 1120px cap and the full-width map, the folded title bar, the `minmax(0, 1fr)` gotcha, how to find what overflows
- **[Schema notes](docs/SCHEMA_NOTES.md)** — `working_hours` shape, anonymous-auth orphans, why per-user counts don't add up
- **[Mock vs real](docs/MOCK_VS_REAL.md)** — every page's data source: ✅ real / 🔐 EF-required / ⚠️ dropped
- **[Known issues](docs/KNOWN_ISSUES.md)** — outstanding limitations

## Required env vars

| Var | Purpose | Bundle-public? |
|---|---|---|
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps JS SDK | yes — restrict by HTTP referrer in GCP |
| `VITE_SUPABASE_URL` | Supabase project URL | yes |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (RLS-gated) | yes by design |

For CI, mirror all of these as repo secrets at https://github.com/alabenkhlifa/CharJ-admin/settings/secrets/actions.

Admin access is not an env var: admins are Supabase Auth users listed in `public.admins` — see [AUTH.md](docs/AUTH.md). During the transition the Edge Functions also accept the legacy `ADMIN_API_SECRET` until `ADMIN_LEGACY_SECRET_ENABLED=false` is set on them.

## Commands cheat sheet

```bash
# Type check + build, lint (must stay at 0 problems), unit tests
npx tsc -b --noEmit && npm run build
npm run lint
npm test                      # node --test tests/*.test.ts

# Browser suites: a dev server with fake Supabase values, then any suite.
# Every request is mocked; nothing reaches a real backend.
VITE_SUPABASE_URL=https://fake.supabase.test VITE_SUPABASE_ANON_KEY=fake npx vite --port 5181 --strictPort &
PAGES_URL=http://localhost:5181 PLAYWRIGHT_MODULE=<…>/playwright/index.mjs node tests/pages.browser.mjs
# Each suite reads its own <NAME>_URL: KIT_URL, SHELL_URL, SUMMARY_URL, USAGE_URL, COMMUNITY_URL,
# CHARGERS_URL, CHARGER_EDITOR_URL, NOTIFICATIONS_URL, SETTINGS_URL, PAGES_URL.
# The chargers suite needs the .env Maps key in the dev server.

# Deploy admin Edge Functions (from ../charj)
cd ../charj
npx supabase functions deploy admin-usage --no-verify-jwt
npx supabase functions deploy admin-feedback --no-verify-jwt
npx supabase functions deploy admin-submissions --no-verify-jwt
npx supabase functions deploy admin-review-reports --no-verify-jwt
npx supabase functions deploy admin-confirmations --no-verify-jwt
npx supabase functions deploy admin-users --no-verify-jwt
npx supabase functions deploy admin-notifications --no-verify-jwt
npx supabase functions deploy admin-verify-charger --no-verify-jwt
npx supabase functions deploy admin-set-charger-status --no-verify-jwt
npx supabase functions deploy admin-add-charger --no-verify-jwt
npx supabase functions deploy admin-update-charger --no-verify-jwt
npx supabase functions deploy admin-cities --no-verify-jwt
# --no-verify-jwt is REQUIRED — see docs/EDGE_FUNCTIONS.md

# Verify CORS preflight on a deployed function
curl -i -X OPTIONS \
  -H "Origin: https://alabenkhlifa.github.io" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization" \
  https://<project>.supabase.co/functions/v1/admin-users
```

Settings shows the build: the `package.json` version and the commit (`git describe`, `+dirty` for a build of uncommitted changes).

## Workflow

- Commit directly to `main` and `git push`. CI builds + deploys.
- Edge Function changes live in `../charj/supabase/functions/` — that's a different repo, push there separately. The mobile app uses CLAUDE.md's "always work on main" rule for the same repo too.
- Don't add VITE_* values to git. `.env` is gitignored, `.env.example` documents the names.
