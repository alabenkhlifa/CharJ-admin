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

## No `gouvernorat` column on chargers

Only `city` (TEXT, freeform). The original Overview "Coverage by gouvernorat" chart was dropped because mapping `city` → gouvernorat would either:
1. Need a hardcoded city→gouvernorat lookup table maintained by hand
2. Need a real address parser

For v1 we just drop the chart. If we ever need it, add `gouvernorat TEXT` to the chargers table and backfill from the existing data.

## `chargers.verified_at` — admin-only signal

Set by `admin-verify-charger` Edge Function alongside `is_verified` and `verified_by`. The `search_chargers` reader RPC does NOT return `verified_at` — it's intentionally admin-only. The admin Users / Chargers pages should call the EF or use the timestamp from a direct service-role query.

## What we don't have at all

No event log, no sessions table, no trips/route_plans, no per-charger uptime history, no admin per-action audit trail, no city→gouvernorat mapping, no per-user-vehicle telemetry. If a UI feature requires any of these, it's a feature waiting for a schema change.
