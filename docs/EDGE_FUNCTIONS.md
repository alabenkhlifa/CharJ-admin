# Admin Edge Functions

Live in **`../charj/supabase/functions/`** (mobile-app repo). Deployed against the same Supabase project as the mobile app.

| Function | Purpose |
|---|---|
| `admin-users` | List `auth.users` + per-user vehicles / counts |
| `admin-verify-charger` | Set `is_verified=true` + stamp `verified_at`/`verified_by` |
| `admin-add-charger` | Insert a new `chargers` row from the dashboard's Add-charger modal |
| `admin-analytics` | Aggregate app usage report (`get_app_analytics` RPC) for the Analytics page |
| `admin-confirmations` | List + hide/unhide driver visit reports (`charging_confirmations`) |
| `admin-set-charger-status` | Pin a charger's status via `set_charger_override` |
| `admin-update-charger` | Read + atomically edit one charger for the structured editor |
| `admin-cities` | Insert a `cities` row from the city picker's inline "Add city" form |
| `admin-notifications` | Region alerts: overview for the Notifications page + cancel / release / announce / dismiss / preview |

All of them follow the same pattern, all deploy with `--no-verify-jwt`, all answer CORS preflight before the auth check.

## Auth (all functions)

Every function calls `authorizeAdmin` from `../charj/supabase/functions/_shared/admin-auth.ts` right after the preflight (and, where it already existed, the 405 method check):

```http
Authorization: Bearer <signed-in admin's access token>
apikey: <anon key>
```

- **401** — missing / invalid / expired token.
- **403** — valid token, but an anonymous user (every mobile-app install is one) or a user with no row in `public.admins`.
- Transition: the legacy `ADMIN_API_SECRET` bearer is still accepted while `ADMIN_LEGACY_SECRET_ENABLED` isn't `false`. See [AUTH.md](AUTH.md).

The dashboard never builds these headers by hand — it calls `adminFetch(path, init)` (`src/lib/admin-fetch.ts`), which also signs out on 401/403. Error bodies keep each function's existing shape (`{ error: "Unauthorized" | "Forbidden" }` or the lower-case `unauthorized` / `forbidden`).

## `admin-users`

**File**: `../charj/supabase/functions/admin-users/index.ts`
**URL**: `https://<project>.supabase.co/functions/v1/admin-users`

### Wire format

```http
GET /functions/v1/admin-users?page=1&perPage=100
Authorization: Bearer <admin access token>
```

### Response

```ts
{
  users: Array<{
    id: string;
    email: string;          // empty string for anonymous users
    created_at: string;
    last_sign_in_at: string;
    vehicles_count: number;
    vehicles: Array<{
      make: string;
      model: string;
      variant: string | null;
      year_from: number | null;
      is_primary: boolean;  // mapped from user_vehicles.is_default
    }>;
    ratings_count: number;        // see SCHEMA_NOTES — usually 0 due to anon-auth orphans
    submissions_count: number;    // ditto
  }>;
  page: number;
  perPage: number;
  total: number;
}
```

### Implementation notes

- Uses `supabase.auth.admin.listUsers({ page, perPage })` — the auto-injected `SUPABASE_SERVICE_ROLE_KEY` env on the function gives admin access.
- One batched query per side table (`user_vehicles`, `ratings`, `community_submissions`) filtered by `userIds`, then grouped client-side. `1 + 3` queries per page, regardless of user count.
- `ratings.rater` and `community_submissions.submitted_by` are TEXT columns storing UID-as-string. Filter via `.in('rater', userIds)`. See [SCHEMA_NOTES](SCHEMA_NOTES.md) for the orphan-row situation.

## `admin-verify-charger`

**File**: `../charj/supabase/functions/admin-verify-charger/index.ts`
**URL**: `https://<project>.supabase.co/functions/v1/admin-verify-charger`

### Wire format

```http
POST /functions/v1/admin-verify-charger
Authorization: Bearer <admin access token>
Content-Type: application/json

{ "charger_id": "<uuid>" }
```

### Response

```ts
// 200 OK
{
  id: string;
  is_verified: true;
  verified_at: string;
  verified_by: "a2000000-0000-0000-0000-000000000000";   // "manual / admin dashboard"
  name: string;
}

// 400 — missing/malformed charger_id
// 401 — bad/missing token
// 403 — signed in, not an admin
// 404 — charger not found
```

### `verified_by` constant

`a2000000-0000-0000-0000-000000000000` is the conventional UID for "manually verified via admin dashboard" in the `a2000000-…` admin space (the mobile-app repo's `charger-adder` agent owns this convention). The UI labels this as "Manual / Admin dashboard".

Now that admins sign in, `authorizeAdmin` returns the admin's `userId` — swap this constant for it if individual admins should be credited (`null` for legacy-secret calls).

### Why a function, not a direct UPDATE via the admin SPA

`chargers.is_verified` is RLS-protected — anon clients can't write. We could add an RLS policy for "admin allowlist", but that requires real auth. Until then, the EF is the simpler path: it owns the service-role write inside a server boundary.

## `admin-add-charger`

**File**: `../charj/supabase/functions/admin-add-charger/index.ts`
**URL**: `https://<project>.supabase.co/functions/v1/admin-add-charger`

Server-side equivalent of the migrations the mobile-app `charger-adder` agent writes. Takes a fully-validated payload and inserts one row into `chargers` with `source = 'community'`. The PostGIS POINT is built as `SRID=4326;POINT(lng lat)` (longitude first per WKT) so PostgREST can pass it straight to `ST_GeogFromText`.

### Wire format

```http
POST /functions/v1/admin-add-charger
Authorization: Bearer <admin access token>
Content-Type: application/json

{
  "name": "Hotel Le Corail",
  "name_ar": "فندق لو كوراي",
  "name_fr": "Hotel Le Corail",
  "latitude": 36.84,
  "longitude": 10.27,
  "address": "Avenue de la République",
  "address_ar": "شارع الجمهورية",
  "city_id": "<cities.id>",
  "city": "Tunis",
  "connectors": [{ "type": "Type 2", "power_kw": 22, "count": 2 }],
  "operator": "Le Corail",
  "status": "operational",
  "access_type": "customers_only",
  "exclusive_to": null,
  "amenities": ["wifi", "restaurant"],
  "is_verified": true
}
```

**Location.** `city_id` is the real link. A database trigger (`chargers_sync_city_label`) rewrites the legacy `city` text from it ("Hammamet, Nabeul"), so old app versions keep showing a place. The dashboard still sends `city` (that same label) so a deploy order mismatch with an older build of this function can't reject the request. Legacy `city` text without `city_id` is accepted for one transition release; the trigger then links the nearest city within 15 km when there is one. `address` / `address_ar` are the street only — city and governorate are shown separately.

### Response

```ts
// 201 Created
{ id: "<uuid>", name: "Hotel Le Corail" }

// 400 — validation failure (the response `error` describes which field),
//       including a `city_id` that is not in `cities`
// 401 — bad/missing token
// 403 — signed in, not an admin
// 500 — Supabase insert error (rare; usually FK or check-constraint trip)
```

### Validation enforced server-side

Even though the modal validates client-side, the EF re-validates everything — never trust the browser:

- `name`, `name_ar`, `name_fr` non-empty strings.
- `city_id` a UUID that exists in `cities`; without it, a non-empty legacy `city`.
- `address`, `address_ar`, `city` text up to 2000 characters (trimmed; empty when omitted).
- `latitude` ∈ [-90, 90], `longitude` ∈ [-180, 180].
- `connectors[*].type` ∈ {Type 2, CCS, CHAdeMO}; `power_kw > 0`; `count` positive integer.
- `status` ∈ {operational, under_repair, planned, unknown}.
- `access_type` ∈ {public, customers_only, brand_exclusive}; `exclusive_to` required iff `brand_exclusive`.
- `amenities[]` slugs must be in the same allowlist as `set_charger_override` (`toilet`, `restaurant`, `cafe`, `shop`, `air_pump`, `wifi`, `atm`, `lounge`, `mosque`, `pharmacy`, `car_wash`, `kids_playground`).

When `is_verified` is true, `verified_at = now()` and `verified_by = 'a2000000-0000-0000-0000-000000000000'` (same admin-dashboard UID as `admin-verify-charger`).

## `admin-update-charger`

**Files**: `../charj/supabase/functions/admin-update-charger/{index,validation}.ts`

`GET ?charger_id=<uuid>` returns `admin_get_charger` (every column, incl. `city_id`, `address_ar`, `highway_direction`). `POST { charger_id, expected_updated_at, changes }` validates only the changed fields and calls `admin_update_charger` in one transaction (409 when the row changed since it was opened).

Location fields: `city_id` (UUID or `null`; the RPC checks it exists), `address_ar` (text), `highway_direction` (`north` | `east` | `south` | `west` | `null`). Legacy `city` text is still accepted, but the editor no longer sends it — setting `city_id` relabels `city` through the trigger.

## `admin-cities`

**File**: `../charj/supabase/functions/admin-cities/{index,validation}.ts`
**URL**: `https://<project>.supabase.co/functions/v1/admin-cities`

`cities` is public reference data (anon/authenticated `SELECT`, which is how the dashboard lists them) but only `service_role` may write it. The city picker's inline "Add city" form posts here.

```http
POST /functions/v1/admin-cities
Authorization: Bearer <admin access token>
Content-Type: application/json

{
  "slug": "yasmine-hammamet",
  "governorate_code": "TN-21",
  "name_fr": "Yasmine Hammamet",
  "name_ar": "ياسمين الحمامات",
  "name_en": "Yasmine Hammamet",
  "lat": 36.37,
  "lng": 10.54
}
```

```ts
// 201 Created
{ id, slug, governorate_code, name_fr, name_ar, name_en }

// 400 — slug not ^[a-z0-9-]+$, unknown/malformed governorate_code, blank name, bad lat/lng
// 401 / 403 — auth
// 409 — slug already taken
```

- The dashboard derives `slug` from the French name and `governorate_code` from `governorate_for_point(pin)`; both stay editable.
- `lat` / `lng` become `cities.location` (`SRID=4326;POINT(lng lat)`). `suggest_city` measures from it (nearest city within 15 km in the pin's governorate), so use the town centre when the charger pin is far from it.
- Renaming a city or moving it to another governorate is not exposed; the `cities_relabel_chargers` trigger would relabel its chargers if done in SQL.

## `admin-notifications`

**Files**: `../charj/supabase/functions/admin-notifications/{index,handler}.ts`
**URL**: `https://<project>.supabase.co/functions/v1/admin-notifications`
**Dashboard**: `src/data/notifications.ts` (hooks + action helpers), parsed by `src/data/notifications-report.ts`

Wraps the service-role `admin_*` notification RPCs (`20261021000015_notifications_dispatcher_admin.sql`, overview extended by `…16_notification_analytics.sql`). Pushes are templates only: no request carries free text.

### GET: overview

```http
GET /functions/v1/admin-notifications?days=30[&charger_id=<uuid>]
```

`days` is 1–365 (the page offers 7 / 30 / 90) and only narrows `history` and `funnel`. With `charger_id` (the charger drawer), `pending`, `suggestions` and `history` are filtered to that charger and `charger_id` is echoed; `subscribers` / `totals` stay global.

```ts
{
  pending: Array<{            // queue rows held / released in the last 24 h
    event_id, kind: "charger_added" | "charger_updated", update_class: UpdateClass | null,
    reason: "new_charger" | "update", state: "held" | "released",
    note: string | null, needs_review: boolean | null,   // null when note is null
    charger_id, charger_name, governorate_code, governorate_name_fr / _ar / _en,
    queued_at, release_at, requested_by: uuid | null,
    eta,                      // when it goes out, already moved past quiet hours (exactly 08:00 Tunis if it was in them)
  }>;
  suggestions: Array<{        // classified charger_update_events of the last 7 days, not announced / dismissed
    update_event_id, charger_id, charger_name, update_class, occurred_at,
    changed_fields: string[], before: {status?, access_type?, connectors?, working_hours?}, after: {…},
    governorate_code, governorate_name_*, recipient_estimate, push_estimate,
  }>;
  history: Array<{            // notification_batches claimed in the window
    batch_id, source: "auto" | "admin", status: "claimed" | "sending" | "sent" | "failed",
    claimed_at, sent_at, recipient_count, device_count, ticket_ok, ticket_error,
    receipt_ok, receipt_error, opens /* distinct users, analytics opt-outs excluded */, event_count,
  }>;
  subscribers: Array<{ governorate_code, name_fr, name_ar, name_en, followers, followers_with_push }>;
  totals: { region_followers, region_follows, active_devices, users_with_push, pending, suggestions,
            batches, announcements_24h, quiet_now: boolean };
  funnel: { region_prompt_shown, region_prompt_accepted, permission_granted, regions_updated }; // distinct users per step, each step independent
  server_time: string;
  charger_id?: string;
}
```

`UpdateClass` = `planned_to_operational | out_of_service | back_in_service | power_upgrade | new_connector`. The dashboard parser is strict (unknown enum values or wrong types reject the whole response with the field path in the error), except inside `before` / `after`, which are free-form JSONB snapshots used for display only. `opens` and `funnel` are optional in the parser and render as "—" when absent.

### POST: actions

```http
POST /functions/v1/admin-notifications
Content-Type: application/json

{ "action": "cancel" | "release", "event_id": "<uuid>" }
{ "action": "announce" | "dismiss", "update_event_id": "<uuid>" }
{ "action": "preview", "event_id" | "update_event_id": "<uuid>" }   // exactly one of the two
```

- `cancel`: held or released → cancelled. `release` ("Send now"): held only; goes out at the next dispatcher run, and marks a `needs_review` event as reviewed. `announce`: queues the templated update for region + charger followers. `dismiss`: hides a suggestion.
- `release` / `announce` also poke `dispatch-notifications` (fire and forget). Success: `{ ok: true, result, dispatch_requested }`.
- `preview` sends nothing: `{ kind, update_class, charger_id, url, previews: { fr, ar, en: { title, body } }, recipient_estimate, push_estimate, estimate_scope: "region" | "region_only_lower_bound" | "region_and_charger" }`. The dashboard always previews before Announce and Send now.
- POST needs a real admin session: the legacy shared secret gets `403 session_required` (no user id to stamp).

### Errors

`{ error: <code> }`. The dashboard maps them in `notificationErrorMessage`:

| Status | Code | Meaning |
|---|---|---|
| 400 | `invalid_parameters`, `invalid_request`, `invalid_json`, `invalid_action`, `notification_invalid`, `announce_not_classified` | bad input / not an announceable change |
| 404 | `notification_not_found`, `announce_not_found` | gone, refresh |
| 409 | `notification_state`, `announce_duplicate`, `announce_stale` | already sent / cancelled / released, already announced, charger changed since or update older than 7 days |
| 429 | `announce_rate_limited` | 1 announcement per charger per 24 h, 10 per day ("Already announced recently / daily limit reached") |
| 503 | `notifications_unavailable` | RPC failed |

### Deep-link from search

The topbar search calls `search_chargers` and surfaces results. Clicking a charger row sets `pendingChargerId` in `App.tsx`, which the Chargers page consumes to auto-open the detail drawer. No DB call required for the deep-link itself — it reuses the already-loaded `useChargers()` data.

## Deployment

```bash
cd ../charj
npx supabase functions deploy admin-users --no-verify-jwt
npx supabase functions deploy admin-verify-charger --no-verify-jwt
npx supabase functions deploy admin-add-charger --no-verify-jwt
npx supabase functions deploy admin-analytics --no-verify-jwt
npx supabase functions deploy admin-confirmations --no-verify-jwt
npx supabase functions deploy admin-set-charger-status --no-verify-jwt
npx supabase functions deploy admin-update-charger --no-verify-jwt
npx supabase functions deploy admin-cities --no-verify-jwt
npx supabase functions deploy admin-notifications --no-verify-jwt
```

Each deploy bundles `_shared/admin-auth.ts` — a change there means redeploying all nine.

**City picker rollout order:** deploy `admin-cities`, `admin-add-charger` and `admin-update-charger` first, then the dashboard. The dashboard also sends the legacy `city` label on add, so an older `admin-add-charger` still accepts it, but only the new one stores `city_id` / `address_ar`.

`--no-verify-jwt` stays **required**. During the transition the legacy secret (a hex string, not a JWT) has to reach the function; and even afterwards the gateway check only proves a token is signed — an anonymous mobile user passes it. `authorizeAdmin` validates the token against Supabase Auth and the `admins` table itself.

Function env (read on every request, so no redeploy when it changes):

| Var | Purpose |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected. Used to validate the token and read `admins`. |
| `ADMIN_LEGACY_SECRET_ENABLED` | `false` turns the legacy secret off. Unset = on (transition default). |
| `ADMIN_API_SECRET` | Legacy shared secret. Unset it once the legacy path is off. |

## CORS gotcha (real bug we shipped + fixed)

Browsers fire an `OPTIONS` preflight before any cross-origin request that has custom headers (we send `Authorization` + `apikey`). The preflight does NOT carry our bearer header — so an auth check that runs first will return 401, and the browser will block the actual request, surfacing as `"Failed to fetch"` in the console.

**Always answer OPTIONS first**, BEFORE the auth check, with 204 + CORS headers:

```ts
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  // supabase-js and adminFetch may send any of these.
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  const auth = await authorizeAdmin(req, { createClient });
  if (!auth.ok) {
    return json({ error: auth.status === 403 ? 'Forbidden' : 'Unauthorized' }, { status: auth.status });
  }
  // ...real handler
});
```

Every JSON response also needs `Access-Control-Allow-Origin: *` — including the 401 / 400 / 500 paths. Use a small `json(body, init)` helper to avoid forgetting one.

## Smoke tests

```bash
# An admin access token: sign in on the dashboard, then in the console
#   JSON.parse(localStorage["charj-admin-auth"]).access_token
# (expires after an hour). The legacy ADMIN_API_SECRET also works while
# ADMIN_LEGACY_SECRET_ENABLED is on.
SECRET=<admin access token>
URL=https://<project>.supabase.co/functions/v1

# 1. CORS preflight (no auth header)
curl -i -X OPTIONS \
  -H "Origin: https://alabenkhlifa.github.io" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization" \
  $URL/admin-users
# Expect: 204 with access-control-allow-origin: *

# 2. Happy path
curl -i -H "Authorization: Bearer $SECRET" \
  "$URL/admin-users?perPage=1"
# Expect: 200 with users[1] + total

# 3. No auth
curl -i $URL/admin-users
# Expect: 401

# 4. Wrong token
curl -i -H "Authorization: Bearer wrong" $URL/admin-users
# Expect: 401

# 4b. Anonymous / non-admin session (e.g. a mobile-app user's access token)
curl -i -H "Authorization: Bearer <non-admin access token>" $URL/admin-users
# Expect: 403

# 5. Verify charger (PICK A NON-VERIFIED CHARGER FIRST!)
curl -i -X POST $URL/admin-verify-charger \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d '{"charger_id":"<uuid>"}'
# Expect: 200 with the updated row

# 6. Add charger (creates a real row — clean it up after!)
curl -i -X POST $URL/admin-add-charger \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Smoke test","name_ar":"اختبار","name_fr":"Smoke test",
    "latitude":36.8,"longitude":10.2,"city":"Tunis",
    "connectors":[{"type":"Type 2","power_kw":22,"count":1}],
    "status":"operational","access_type":"public",
    "exclusive_to":null,"amenities":[],"is_verified":false
  }'
# Expect: 201 with { id, name }
```

After a manual smoke test that flips real production state, undo it:

```sql
-- supabase db query --linked
UPDATE chargers SET is_verified = false, verified_at = NULL, verified_by = NULL
WHERE id = '<test-charger-id>';

-- For the add-charger smoke test:
DELETE FROM chargers WHERE id = '<smoke-test-id>' AND source = 'community';
```

## Adding a new admin Edge Function

1. Copy `admin-users/index.ts` as a starting template — CORS preflight + json helper + `authorizeAdmin` already wired.
2. Answer `OPTIONS` first, then `await authorizeAdmin(req, { createClient })`, before reading the body or touching the database. Return `auth.status` (401 / 403) with CORS headers.
3. `Access-Control-Allow-Headers` must include `authorization, x-client-info, apikey, content-type`.
4. Never log the `Authorization` header, the token, or any part of a secret.
5. Add the function to `FUNCTIONS` in `../charj/__tests__/supabase/admin-auth.test.js` (a request that passes auth and stops before the database) so it gets the shared auth contract tests.
6. Deploy with `--no-verify-jwt`.
7. If the SPA needs to call it, expose a hook in `src/data/` that calls `adminFetch("<function>?…", init)` — never `fetch` with hand-built auth headers.
8. Document the wire format in this file.
