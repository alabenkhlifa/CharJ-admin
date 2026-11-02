# Data layer

All Supabase access lives in `src/data/` (the sidebar search hook in `src/lib/` aside). Pages call hooks; hooks call the Supabase client or an admin Edge Function. Pages don't import `supabase` directly.

## Hook pattern

Admin reads go through **`useAdminLoad(load)`** (`src/data/admin-load.ts`): pass a `useCallback` keyed by the view (path, filters) and get back

```ts
{
  data: T | null;     // null until this view's first answer
  loading: boolean;
  error: string | null;
  refresh: () => void;                    // re-read the same view; the data stays on screen meanwhile
  patch: (change: (prev: T) => T) => void; // apply a write the server already confirmed (a row flips in place)
}
```

A new `load` is a new view: its data starts empty, so a filter change never shows the previous view's rows or numbers. `getJson` / `postJson` / `errorCode` wrap `adminFetch` (POST never throws: a network failure comes back as status 0). The older hooks (`useUsage`, `useQueue`, `useAdminUsers`, `useChargers`, `useNotifications`, `useEvModels`) have the same `{ data, loading, error, refresh? }` shape with their own state.

Every hook short-circuits when `SUPABASE_CONFIGURED` is false: no request, `error: "… not configured"`, and the page shows an inline line instead of numbers. That state is known at load, so it is the hook's initial state, never a `setState` inside an effect.

Admin responses are parsed **strictly** by a pure `*-report.ts` module (`node --test` loads them): a missing key or a wrong type throws, and the page shows "Couldn't load" rather than a silent 0. Extra keys are ignored, so an additive server change never breaks a page. Wire names stay snake_case in the parsers and become camelCase only where a page wants it.

## What's wired

| Hook / action | Source | Auth | Used by |
|---|---|---|---|
| `useUsage(view, days, env)` | `admin-usage` (`view=summary` / `usage`), `parseUsageReport` | admin session | Summary, Usage |
| `useQueue()` | `admin-feedback`, `admin-confirmations`, `admin-submissions`, `admin-review-reports` in parallel (`perPage=3`), `mergeQueue` | admin session | App: Summary's Needs you, Community badges, nav badge |
| `useFeedback(status, category, page)`, `useDesignVotes()`, `setFeedbackResolved` | `admin-feedback` (`category=requests` by default; `category=design` for the tally, 100 a page, up to 5 pages) | admin session | Community → Feedback |
| `useSubmissions(status, page)`, `reviewSubmission` | `admin-submissions` GET / POST | admin session | Community → Submissions |
| `useReviewReports(status, page)`, `setReportResolved` | `admin-review-reports` GET / POST | admin session | Community → Reviews |
| `useReviews()` | `ratings` (latest 200) joined client-side with `chargers(id, name)` | anon | Community → Reviews (Recent reviews) |
| `useVisits(view)`, `moderateVisit` | `admin-confirmations` GET (`since_days`) / POST | admin session | Community → Driver visits |
| `useAdminUsers(page, perPage, filter, lookup)` | `admin-users` | admin session | Usage → Users |
| `useEvModels()` | `ev_models` ordered by make, model | anon | Usage → Cars (the catalog) |
| `useChargers()` | `search_chargers` RPC (up to 1000 rows) | anon | Chargers (list, map, network), Community's nearby check |
| `verifyCharger`, `setChargerStatus` | `admin-verify-charger`, `admin-set-charger-status` | admin session | Chargers drawer |
| `loadChargerForEdit`, `saveCharger` | `admin-update-charger` GET / POST | admin session | Charger editor |
| `submit` in the Add-charger modal | `admin-add-charger` | admin session | Add charger |
| `useLocations()` | `governorates` (code + names) and `cities`, loaded once per page load and shared (module cache in `src/data/locations.ts`) | anon | Chargers filters, city picker, network coverage |
| `usePinPlace(lat, lng)` | `governorate_for_point` + `suggest_city` RPCs, debounced 400 ms | anon | Add charger, editor |
| `createCity` (Add city) | `admin-cities`; appends to the shared city list | admin session | City picker |
| `useNotifications(days)`, `useChargerNotifications(id)` | `admin-notifications` GET overview (whole page / one charger), parsed by `notifications-report.ts`; `skewMs` = server − local clock | admin session | Notifications, Chargers drawer |
| `cancelNotification` / `releaseNotification` / `announceUpdate` / `dismissSuggestion` / `previewNotification` | `admin-notifications` POST; `{ ok } \| { ok: false, error }` with admin-facing copy | admin session | Notifications, announce dialog |
| `useGlobalSearch(query)` | Debounced `search_chargers` + in-memory NAV match | anon | Sidebar search |

### The queue

`useQueue()` lives in `App.tsx` and is passed down. A source that fails or answers in an unexpected shape is unknown (`null`), never 0, and then the total is unknown too: no nav badge, no Queue clear ring. It reads on mount, on `refresh()` (every Community action calls it) and when the window gets the focus back. It does not read again on a page change.

### Writes

A resolve / reopen / hide / unhide / reject patches the row in place with the server's row (or the change it confirmed) and adjusts the counts, so an undo stays one tap away; then the queue refreshes. The list's Refresh waits while such a write is on its way (`useSaving` in `src/pages/community/use-saving.ts`), so a read started before the write landed can't put the old row back.

## Mappers

Anon tables come back as snake_case via PostgREST. We map to camelCase + derive UI fields once per row in a `mapRawX` function, exported alongside the hook. Example: `mapRawCharger` computes `power = max(connectors.power_kw)`, summarises `working_hours` into a single string for the table column, etc.

This keeps page code clean (no `r.is_verified ? "Yes" : "No"` per cell).

## JSONB shapes you need to know

### `chargers.connectors`

```ts
Array<{ type: 'Type 2'|'CCS'|'CHAdeMO'|'Type 1'; power_kw: number; count: number }>
```

`type` strings are exactly those (with capital + space). The mapper translates to short keys (`'Type 2'` → `'t2'`) for palette lookup.

### `chargers.working_hours`

```ts
{
  weekly: {
    mon?: Array<{ from: string; to: string }>;
    tue?: Array<{ from: string; to: string }>;
    // ... thu, fri, sat
    sun?: Array<{ from: string; to: string }>;
  }
}
```

- Keys are **lowercase 3-letter** (`mon`, `tue`, …, `sun`).
- Each day is an **array of `{from, to}` ranges**, NOT a single object. Most chargers have one range; multi-shift days have multiple.
- Empty array `[]` → "Closed" that day.
- Missing day → "—" (unknown).
- 24/7 is encoded as `"00:00"–"24:00"` for every day. Never `always_open: true`.

`summarizeHours` (`src/data/chargers.ts`) and the drawer's week grid (`src/pages/chargers/drawer.tsx`) consume this shape. If the shape ever changes, both need to update.

### `ev_models.connectors`

```ts
string[]  // e.g. ['Type 2', 'CCS']
```

Plain TEXT[], not JSONB. No power_kw / count per connector here.

### `ev_models.dc_charge_curve`

```ts
Array<{ soc: number; power_kw: number }>  // SoC % → power
```

### `admin-notifications` overview

Wire names stay snake_case (`src/data/notifications-report.ts`). Things that bite:

- `pending[].needs_review` is SQL `note = 'needs_review'`, so it is `null` (not `false`) when there is no note. The parser normalises it.
- `pending[].eta` is already moved past quiet hours: an ETA of exactly 08:00:00 Tunis means "waiting for quiet hours to end". `waitsForQuietHours` keys on that.
- `suggestions[].before` / `after` hold only the changed fields of `charger_update_events`, as raw JSONB. Compare connectors per type, never by array position (`connectorsLabel`).
- `funnel` steps are counted independently, so a later step can be larger than an earlier one; the Funnel percentages can pass 100%.
- `history[].opens` excludes users with analytics off, so the open rate is shown as "≥ x%".

### `admin-usage` report

- Days are Tunis days. The days nobody measured (before 14 Sep 2026, and 16 Sep–16 Oct 2026 when events didn't reach the server) live in `src/lib/tracking.ts`: charts hatch them, tables say "not tracked", averages and return windows leave them out. Never draw them as 0.
- Read the `ui: 'all'` rows for "Any design" and a design's own rows for a design; never add designs together (a phone that moved to Lune counts in both). Platforms do add up.
- `summary.versions` and the language rows count a user once per build / language, so they can sum past the active total: label them "users per …", never as shares.
- `routes`, `missing_cars` and `funnels.contributions` are not split by platform or design; Usage hides those filters on their sections.

## Anon-readable tables

Per RLS audits:

- `chargers` — full SELECT
- `ev_models` — SELECT where `is_active = TRUE`
- `ratings` — SELECT all
- `community_submissions` — SELECT all (RLS uses `USING (true)`)
- `governorates` — SELECT on `code, name_fr, name_ar, name_en` only (not `geom`): name the columns
- `cities` — SELECT all; writes need the `admin-cities` Edge Function

## Service-role only (read through an Edge Function)

- `auth.users` — not exposed via PostgREST at all (`admin-users`)
- `user_vehicles` — RLS limits to the owning user (`admin-users`)
- `feedback` — `admin-feedback`
- `review_reports` — `admin-review-reports`
- `charging_confirmations` — no client policies at all (`admin-confirmations`)
- `community_submission_reviews` (who reviewed a submission, the note) — `admin-submissions`; the dashboard reads submissions through it too, though `community_submissions` itself is anon-readable
- `app_analytics_*` (events, cohorts, ingestion days) — `admin-usage`

## What we can't compute (no data source at all)

- Trip plans created — no trips table (the trip funnel counts saves and shares from events instead)
- Fleet uptime % — `get_charger_reliability` is per-charger, no fleet-wide metric
- Verification velocity per admin — `verified_by` has no per-row history
- "Top requested locations" from submissions — no popularity counter
- OCM sync status / last-run — pg_cron doesn't surface a status table
- An app-version filter on Usage — usage rows carry no `app_version` (versions live on Summary)

These are left out of the dashboard. See `docs/MOCK_VS_REAL.md`.

## Adding a new hook

1. A pure parser in `src/data/foo-report.ts` (strict: throw on a missing key or a wrong type), with a `node --test` file in `tests/`.
2. The hook in `src/data/foo.ts`: for an admin function, `useAdminLoad(useCallback((signal) => getJson(path, signal, message).then(parseFoo), [path]))`; writes through `postJson`.
3. If the data needs service-role: add an Edge Function in `../charj/supabase/functions/` (see `docs/EDGE_FUNCTIONS.md`); the hook calls it through `adminFetch` (session token + `apikey`, signs out on 401/403), never `fetch` with hand-built headers.
4. Short-circuit on `!SUPABASE_CONFIGURED` in the initial state, not in an effect.
5. Pages render a loading state that keeps the card's shape, an error line with Try again, and the data — never a number the source didn't give.

## Cross-cutting helpers

- **`src/ui/pager.tsx`** — the list footer; pages keep `?page=` / `?per=` in the hash and slice client-side (or pass them to a server-paged function).
- **`src/lib/amenities.ts`** + **`amenity-icons.tsx`** — the 12 amenity slugs (in sync with `charj/lib/amenities.ts` and the `set_charger_override` allowlist), their labels, and `<AmenityIcon>`. Used by the add-charger modal, the editor and the drawer.
- **`src/lib/use-global-search.ts`** + **`src/components/search-panel.tsx`** — the sidebar spotlight. The hook debounces `search_chargers` and matches NAV labels in memory; the panel renders grouped results with arrow-key + ⌘K + Esc handling. A charger pick deep-links to `#/chargers?id=`.
