# Data layer

All Supabase access lives in `src/data/`. Pages call hooks; hooks call the Supabase client or an admin Edge Function. Pages don't import `supabase` directly.

## Hook pattern

Every hook returns the same shape:

```ts
{
  data: T;            // empty array / object on initial render
  loading: boolean;   // true on initial fetch
  error: string | null;
  // Optional:
  refetch?: () => Promise<void>;
}
```

If `SUPABASE_CONFIGURED` is false, the hook short-circuits to `{ data: [], loading: false, error: "Supabase not configured" }`. Pages render an inline "not configured" banner — no crash.

## What's wired

| Hook | Source | Auth |
|---|---|---|
| `useChargers()` | `search_chargers` RPC | anon |
| `useOverviewStats()` | 8 batched COUNT queries on chargers / ratings / community_submissions | anon |
| `useOverviewCharts()` | Single Promise.all over chargers / submissions / ratings (12 weeks for rating trend) | anon |
| `useSidebarCounts()` | 3 COUNT queries (chargers / pending submissions / ratings) | anon |
| `useSubmissions()` | `community_submissions` ordered by created_at desc | anon |
| `useReviews()` | `ratings` (latest 50) joined client-side with `chargers(id, name)` | anon |
| `useEvModels()` | `ev_models` ordered by make, model | anon |
| `useAdminUsers()` | `${SUPABASE_URL}/functions/v1/admin-users` | bearer secret |

## Mappers

Most tables come back as snake_case via PostgREST. We map to camelCase + derive UI fields once per row in a `mapRawX` function, exported alongside the hook. Example: `mapRawCharger` computes `power = max(connectors.power_kw)`, summarises `working_hours` into a single string for the table column, etc.

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

`summarizeHours` and `dayCellLabel` in `pages/chargers.tsx` consume this shape. If the shape ever changes, both need to update.

### `ev_models.connectors`

```ts
string[]  // e.g. ['Type 2', 'CCS']
```

Plain TEXT[], not JSONB. No power_kw / count per connector here.

### `ev_models.dc_charge_curve`

```ts
Array<{ soc: number; power_kw: number }>  // SoC % → power
```

## Anon-readable tables

Per RLS audits:

- `chargers` — full SELECT
- `ev_models` — SELECT where `is_active = TRUE`
- `ratings` — SELECT all
- `community_submissions` — SELECT all (RLS uses `USING (true)`)

## Service-role only (need an Edge Function)

- `auth.users` — not exposed via PostgREST at all
- `user_vehicles` — RLS limits to the owning user
- `feedback` — service-role-only SELECT
- `review_reports` — service-role-only SELECT/UPDATE

## What we can't compute (no data source at all)

- DAU/WAU/MAU, sessions, last-active per user — no event log table
- Trip plans created — no trips table
- Fleet uptime % — `get_charger_reliability` is per-charger, no fleet-wide metric
- Verification velocity per admin — `verified_by` has no per-row history
- "Top requested locations" from submissions — no popularity counter
- OCM sync status / last-run — pg_cron doesn't surface a status table
- Activity feed (who did what, when) — no event log

These were dropped from the dashboard. See `docs/MOCK_VS_REAL.md`.

## Adding a new hook

1. New file `src/data/foo.ts` with `useFoo()` returning `{ data, loading, error }`.
2. Use the cancellation-flag pattern (`let cancelled = false; return () => { cancelled = true; };`) to avoid setState-after-unmount.
3. If the data needs to be refreshed after a mutation, expose `refetch: () => Promise<void>` (see `useChargers` for the pattern using `useCallback`).
4. Pages: import the hook, render `loading` skeletons, `error` banner, and the data.

If the new data needs service-role:

1. Add an Edge Function in `../charj/supabase/functions/` (see `docs/EDGE_FUNCTIONS.md`).
2. The hook uses raw `fetch` against the function URL with the `VITE_ADMIN_API_SECRET` bearer.
3. Defensive: short-circuit when the env vars are missing, surface as `error: "Admin API not configured"`.
