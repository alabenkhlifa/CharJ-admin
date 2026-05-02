# Admin Edge Functions

Live in **`../charj/supabase/functions/`** (mobile-app repo). Deployed against the same Supabase project as the mobile app.

| Function | Purpose | Auth |
|---|---|---|
| `admin-users` | List `auth.users` + per-user vehicles / counts | Bearer `ADMIN_API_SECRET` |
| `admin-verify-charger` | Set `is_verified=true` + stamp `verified_at`/`verified_by` | Bearer `ADMIN_API_SECRET` |

Both follow the same pattern, both are deployed with `--no-verify-jwt`, both handle CORS preflight before auth.

## `admin-users`

**File**: `../charj/supabase/functions/admin-users/index.ts`
**URL**: `https://<project>.supabase.co/functions/v1/admin-users`

### Wire format

```http
GET /functions/v1/admin-users?page=1&perPage=100
Authorization: Bearer <ADMIN_API_SECRET>
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
Authorization: Bearer <ADMIN_API_SECRET>
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
// 401 — bad/missing bearer
// 404 — charger not found
```

### `verified_by` constant

`a2000000-0000-0000-0000-000000000000` is the conventional UID for "manually verified via admin dashboard" in the `a2000000-…` admin space (the mobile-app repo's `charger-adder` agent owns this convention). The UI labels this as "Manual / Admin dashboard".

If we ever add real Supabase Auth, replace this constant with `auth.uid()` so individual admins are credited.

### Why a function, not a direct UPDATE via the admin SPA

`chargers.is_verified` is RLS-protected — anon clients can't write. We could add an RLS policy for "admin allowlist", but that requires real auth. Until then, the EF is the simpler path: it owns the service-role write inside a server boundary.

## Deployment

```bash
cd ../charj
npx supabase functions deploy admin-users --no-verify-jwt
npx supabase functions deploy admin-verify-charger --no-verify-jwt
```

`--no-verify-jwt` is **required**. Without it the Supabase API gateway rejects requests whose `Authorization` header isn't a valid Supabase JWT — and our bearer secret is just a hex string, not a JWT. With the flag, the gateway passes the `Authorization` header through unmodified and the function does its own bearer comparison.

Set the secret once per project:

```bash
npx supabase secrets set ADMIN_API_SECRET=<value>
```

(The function reads `Deno.env.get('ADMIN_API_SECRET')` at every request, so no function redeploy is needed when rotating the value — just set the secret again.)

## CORS gotcha (real bug we shipped + fixed)

Browsers fire an `OPTIONS` preflight before any cross-origin request that has custom headers (we send `Authorization`). The preflight does NOT carry our bearer header — so an auth check that runs first will return 401, and the browser will block the actual request, surfacing as `"Failed to fetch"` in the console.

**Always answer OPTIONS first**, BEFORE the auth check, with 204 + CORS headers:

```ts
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  // ...auth check, then real handler
});
```

Every JSON response also needs `Access-Control-Allow-Origin: *` — including the 401 / 400 / 500 paths. Use a small `json(body, init)` helper to avoid forgetting one.

## Smoke tests

```bash
SECRET=<your-ADMIN_API_SECRET>
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

# 4. Wrong secret
curl -i -H "Authorization: Bearer wrong" $URL/admin-users
# Expect: 401

# 5. Verify charger (PICK A NON-VERIFIED CHARGER FIRST!)
curl -i -X POST $URL/admin-verify-charger \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d '{"charger_id":"<uuid>"}'
# Expect: 200 with the updated row
```

After a manual smoke test that flips real production state, undo it:

```sql
-- supabase db query --linked
UPDATE chargers SET is_verified = false, verified_at = NULL, verified_by = NULL
WHERE id = '<test-charger-id>';
```

## Adding a new admin Edge Function

1. Copy `admin-users/index.ts` as a starting template — it has the CORS preflight + auth check + json helper already wired.
2. Implement the handler.
3. Deploy with `--no-verify-jwt`.
4. If the SPA needs to call it, expose a hook in `src/data/` that uses `fetch` with the bearer header.
5. Document the wire format in this file.
