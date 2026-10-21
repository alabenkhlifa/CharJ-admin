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
  "address": "Avenue de la République, Tunis",
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

### Response

```ts
// 201 Created
{ id: "<uuid>", name: "Hotel Le Corail" }

// 400 — validation failure (the response `error` describes which field)
// 401 — bad/missing token
// 403 — signed in, not an admin
// 500 — Supabase insert error (rare; usually FK or check-constraint trip)
```

### Validation enforced server-side

Even though the modal validates client-side, the EF re-validates everything — never trust the browser:

- `name`, `name_ar`, `name_fr`, `city` non-empty strings.
- `latitude` ∈ [-90, 90], `longitude` ∈ [-180, 180].
- `connectors[*].type` ∈ {Type 2, CCS, CHAdeMO}; `power_kw > 0`; `count` positive integer.
- `status` ∈ {operational, under_repair, planned, unknown}.
- `access_type` ∈ {public, customers_only, brand_exclusive}; `exclusive_to` required iff `brand_exclusive`.
- `amenities[]` slugs must be in the same allowlist as `set_charger_override` (`toilet`, `restaurant`, `cafe`, `shop`, `air_pump`, `wifi`, `atm`, `lounge`, `mosque`, `pharmacy`, `car_wash`, `kids_playground`).

When `is_verified` is true, `verified_at = now()` and `verified_by = 'a2000000-0000-0000-0000-000000000000'` (same admin-dashboard UID as `admin-verify-charger`).

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
```

Each deploy bundles `_shared/admin-auth.ts` — a change there means redeploying all seven.

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
