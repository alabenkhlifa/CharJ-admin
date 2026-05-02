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

Local `.env` should mirror `.env.example`. Without env vars the app still renders — Supabase queries return "not configured" errors and the auth gate is bypassed (fail-open).

## Stack

- **Vite + React 19 + TypeScript strict**
- **CSS variables + inline styles** — no Tailwind, no shadcn. Theme tokens in `src/index.css`. Logical properties (`insetInlineStart`, `paddingStart`) so RTL would flip cleanly.
- **`@supabase/supabase-js`** for anon-readable tables, **`fetch` + bearer secret** for admin Edge Functions
- **`@vis.gl/react-google-maps`** for Google Maps (Tunisia map, charger pins, mini-map in detail drawer)

## Must-do rules

- **Anon key only from the browser.** Never bundle the service-role key. Anything that needs service role goes through an admin Edge Function in the mobile-app repo (`../charj/supabase/functions/`).
- **All `VITE_*` env vars are public** — they get inlined into the JS bundle at build time. Treat them as visible to anyone who reads the bundle. Use bearer-secret + Supabase RLS as the actual gate, not secrecy of the var.
- **Match existing inline-style + CSS-var conventions.** Every status / connector color comes from `src/data/chargers.ts` palettes or CSS vars, never hardcoded.
- **Logical properties only** — `insetInlineStart`, `marginInlineEnd`. No `left` / `right` for layout positioning.
- **Mobile breakpoint is 900px** — under that, the sidebar collapses to a slide-out drawer. Test layouts at 375 / 768 / 1440 — `main.scrollWidth` must equal `main.clientWidth` on every page.
- **Don't fabricate data.** If a metric has no anon-readable source and no Edge Function, drop the card or show an honest empty state. Do not show mock numbers next to real ones.

## Folder map

```
src/
  App.tsx                    # shell: sidebar + topbar + active page
  main.tsx                   # AuthGate → App
  index.css                  # CSS variables, breakpoints, .skeleton, .num
  components/
    shell.tsx                # Sidebar (drawer on mobile) + Topbar
    card.tsx                 # Card, CardHeader, EmptyState
    charts.tsx               # SVG charts: Donut, AreaChart, StackedBar, etc.
    tunisia-map.tsx          # Google Map embed for Overview "Tunisia coverage"
  pages/
    overview.tsx             # KPIs + status/connector/access charts + map
    chargers.tsx             # Table + filter chips + detail drawer (verify/map/hours)
    submissions.tsx          # community_submissions list, status tabs
    feedback.tsx             # EmptyState — needs Edge Function (service-role)
    reviews.tsx              # ratings stream + charger join
    users.tsx                # admin-users Edge Function consumer
    vehicles.tsx             # ev_models catalogue cards
    map.tsx                  # full-page Google Maps with all chargers
    settings.tsx             # placeholder
  data/
    chargers.ts              # useChargers() — search_chargers RPC, refetch
    overview-stats.ts        # useOverviewStats() — KPI counts
    overview-charts.ts       # useOverviewCharts() — chart aggregations
    submissions.ts           # useSubmissions()
    reviews.ts               # useReviews() — ratings + chargers join
    vehicles.ts              # useEvModels()
    sidebar-counts.ts        # useSidebarCounts() — badge numbers
    admin-users.ts           # useAdminUsers() — bearer-auth fetch to EF
  lib/
    supabase.ts              # client factory + SUPABASE_CONFIGURED
    icons.tsx                # all SVG icons (lucide-style)
    routes.ts                # NAV definition
    theme.ts                 # useTweaks() — theme/density/accent/numStyle persistence
    use-is-mobile.ts         # matchMedia 900px hook
    use-theme.ts             # MutationObserver on html[data-theme]
    map-styles.ts            # darkMapStyle/lightMapStyle (mirrors mobile app)
    auth-gate.tsx            # client-side login gate (security theater)
.github/workflows/deploy.yml # CI: build + deploy to Pages on push to main
```

## Project-scoped docs

Read these before touching the related area. Each is short and gotcha-focused.

- **[Architecture](docs/ARCHITECTURE.md)** — stack choices, why no Tailwind, module boundaries
- **[Auth + access control](docs/AUTH.md)** — the gate (security theater) + bearer-secret pattern for admin Edge Functions, when to migrate to real Supabase Auth
- **[Edge Functions](docs/EDGE_FUNCTIONS.md)** — `admin-users` and `admin-verify-charger`: contract, deployment, CORS gotcha
- **[Data layer](docs/DATA_LAYER.md)** — hooks pattern, JSONB shapes, what's anon-readable vs needs an EF
- **[Deployment](docs/DEPLOYMENT.md)** — GH Pages + GH Actions, required secrets, Vite `base` path
- **[Responsiveness](docs/RESPONSIVENESS.md)** — sidebar drawer pattern, breakpoints, `minmax(0, 1fr)` gotcha
- **[Schema notes](docs/SCHEMA_NOTES.md)** — `working_hours` shape, anonymous-auth orphans, why per-user counts don't add up
- **[Mock vs real](docs/MOCK_VS_REAL.md)** — every page's data source: ✅ real / 🛡️ EF-required / 🔴 dropped
- **[Known issues](docs/KNOWN_ISSUES.md)** — outstanding limitations, what'd take real auth to fix

## Required env vars

| Var | Purpose | Bundle-public? |
|---|---|---|
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps JS SDK | yes — restrict by HTTP referrer in GCP |
| `VITE_SUPABASE_URL` | Supabase project URL | yes |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (RLS-gated) | yes by design |
| `VITE_ADMIN_USER` / `VITE_ADMIN_PASS` | Login gate | yes — see [AUTH.md](docs/AUTH.md) |
| `VITE_ADMIN_API_SECRET` | Bearer for admin Edge Functions | yes — same trust as gate password |

For CI, mirror all of these as repo secrets at https://github.com/alabenkhlifa/CharJ-admin/settings/secrets/actions.

For Supabase functions, set:

```bash
cd ../charj && npx supabase secrets set ADMIN_API_SECRET=<same-value-as-VITE_ADMIN_API_SECRET>
```

## Commands cheat sheet

```bash
# Type check + build
npx tsc -b --noEmit && npm run build

# Watch dev
npm run dev

# Deploy admin Edge Functions (from ../charj)
cd ../charj
npx supabase functions deploy admin-users --no-verify-jwt
npx supabase functions deploy admin-verify-charger --no-verify-jwt
# --no-verify-jwt is REQUIRED — see docs/EDGE_FUNCTIONS.md

# Verify CORS preflight on a deployed function
curl -i -X OPTIONS \
  -H "Origin: https://alabenkhlifa.github.io" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization" \
  https://<project>.supabase.co/functions/v1/admin-users
```

## Workflow

- Commit directly to `main` and `git push`. CI builds + deploys.
- Edge Function changes live in `../charj/supabase/functions/` — that's a different repo, push there separately. The mobile app uses CLAUDE.md's "always work on main" rule for the same repo too.
- Don't add VITE_* values to git. `.env` is gitignored, `.env.example` documents the names.
