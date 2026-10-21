# Schema notes

Surprises and shape gotchas we've actually hit. Cross-referenced from the migrations in `../charj/supabase/migrations/`.

## `chargers.working_hours` — array of ranges, not single open/close

Real shape:

```ts
{
  weekly: {
    mon?: Array<{ from: string; to: string }>;
    tue?: Array<{ from: string; to: string }>;
    // ...
    sun?: Array<{ from: string; to: string }>;
  }
}
```

Keys: lowercase 3-letter (`mon`, `tue`, …, `sun`). Values: **arrays** of ranges (NOT single objects with `open`/`close`). `[]` = closed. `00:00`–`24:00` everywhere = 24/7.

Bug we shipped: the early code expected `{ open, close, closed }` and rendered every day as `—`. Fix is in `src/data/chargers.ts` `summarizeHours` and `src/pages/chargers.tsx` `dayCellLabel`.

## `ratings.rater` and `community_submissions.submitted_by` are TEXT

Both store `auth.uid()::text`. Filter via `.in('rater', userIds)` works fine.

`submitted_by` is technically freeform — older rows might contain emails or display names. The `admin-users` Edge Function defensively counts both UID and email matches; if neither, the row contributes 0 to the count.

## Anonymous-auth orphans (per-user counts always 0)

Charj uses Supabase **anonymous auth**. Every user is a session-bound UID with `is_anonymous = true`. When a session expires (timer or manual sign-out), Supabase prunes the row from `auth.users`.

Side tables (`ratings`, `community_submissions`, `user_vehicles`) usually have no FK to `auth.users` (or `ON DELETE` is permissive), so child rows survive when the parent UID is pruned.

Result: `admin-users` joins `ratings.rater` against the *current* `auth.users` IDs, but those IDs don't intersect with the orphan rows. So **every current user shows ratings_count: 0 and submissions_count: 0**, even though the DB has 8 ratings and 4 submissions.

This is data, not a bug. The Users page hides those columns; the Reviews and Submissions pages still show the orphan rows because they're keyed off the parent table, not joined against auth.users.

To fix properly we'd need either:
- Non-anonymous accounts that survive across sessions, or
- A stable client-side install ID written into each row (separate from `auth.uid()`).

Both are mobile-app changes.

## `connectors` differs between `chargers` and `ev_models`

- `chargers.connectors` — JSONB array of `{ type, power_kw, count }`
- `ev_models.connectors` — TEXT[] of just type names

The mappers handle the difference; pages don't see it.

## `ev_models.is_default` (not `is_primary`)

The column on `user_vehicles` that flags the user's primary EV is `is_default`. The `admin-users` EF response renames it to `is_primary` to keep the wire format clean. Don't be surprised when querying the table directly — `is_default` is the truth.

## Structured locations: `governorates` → `cities` → `chargers.city_id`

Since `20261021000010_structured_locations.sql` (mobile-app repo):

- `governorates(code 'TN-xx', name_fr, name_ar, name_en, geom)` — anon can read the code and names, never `geom`, so always name the columns in a `select`.
- `cities(id, slug, governorate_code, name_fr, name_ar, name_en, location)` — anon-readable; writes go through the `admin-cities` Edge Function.
- `chargers.city_id` (nullable) + `chargers.address_ar`. The reader RPCs return `city_id, city_fr/ar/en, governorate_code, governorate_fr/ar/en, address_ar` as trailing columns.
- `chargers.city` (legacy TEXT) is kept non-empty for old app versions: the `chargers_sync_city_label` trigger rewrites it from `city_id` ("Hammamet, Nabeul", or just "Tunis" when city and governorate share a name). Never edit it by hand when a city is set.
- `governorate_for_point(lat, lng)` and `suggest_city(lat, lng)` are anon-callable RPCs; the dashboard uses them for the pin mismatch warning and to pre-fill the city.

## `chargers.verified_at` — admin-only signal

Set by `admin-verify-charger` Edge Function alongside `is_verified` and `verified_by`. The `search_chargers` reader RPC does NOT return `verified_at` — it's intentionally admin-only. The admin Users / Chargers pages should call the EF or use the timestamp from a direct service-role query.

## What we don't have at all

No event log, no sessions table, no trips/route_plans, no per-charger uptime history, no admin per-action audit trail, no per-user-vehicle telemetry. If a UI feature requires any of these, it's a feature waiting for a schema change.
