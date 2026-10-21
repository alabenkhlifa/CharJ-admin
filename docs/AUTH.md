# Auth + access control

> TL;DR: Admins sign in with Supabase Auth (email + password). Every admin Edge Function validates the session token and checks the `public.admins` allowlist. Nothing secret lives in the bundle. A legacy shared secret is still accepted by the functions during the transition; turn it off once the new dashboard is live.

## The model

| Piece | Where | What it does |
|---|---|---|
| Sign-in card | `src/lib/auth-gate.tsx` | `supabase.auth.signInWithPassword`. Shows the dashboard once signed in. UX only — not the security boundary. |
| Session | `src/lib/supabase.ts` | `persistSession: true`, `autoRefreshToken: true`, `localStorage` under `charj-admin-auth`, `detectSessionInUrl: false` (the hash belongs to the router). Survives reloads and new tabs. |
| `adminFetch` | `src/lib/admin-fetch.ts` | Calls `${VITE_SUPABASE_URL}/functions/v1/<path>` with `Authorization: Bearer <session access token>` + `apikey: <anon key>`. 401 → sign out ("session expired"). 403 → sign out ("This account is not an admin."). |
| Admin gate | `../charj/supabase/functions/_shared/admin-auth.ts` | `authorizeAdmin(req)`: validates the JWT with a service-role client (`auth.getUser(token)`), refuses anonymous users, requires a row in `public.admins`. |
| Allowlist | `public.admins (user_id uuid primary key references auth.users on delete cascade, created_at timestamptz default now())` | Service-role only (RLS on, no policies). Only the Edge Functions read it. |

### Why a valid JWT is not enough

Every mobile-app install signs in **anonymously** — those are real Supabase users with valid JWTs and the `authenticated` role. So the gate checks three things, in order:

1. `auth.getUser(token)` succeeds → else **401**
2. `user.is_anonymous` is false → else **403**
3. `admins` has a row for `user.id` → else **403**

401 means "no or bad credentials" (expired, forged, missing). 403 means "a real signed-in user who is not an admin".

### Sign-in flow

1. Admin submits email + password → `signInWithPassword`.
2. While the card still shows "Signing in…", the gate calls `adminFetch("admin-users?perPage=1&user=access-check")` — the full admin check with no database work (a non-UUID lookup returns an empty list). 403 signs the account straight back out with "This account is not an admin.", so a non-admin never sees the dashboard.
3. `onAuthStateChange` drives everything after that: token refresh, sign-out from the sidebar, forced sign-out from `adminFetch`.

Sign-out lives in the sidebar footer (next to the signed-in email; a lone icon when the sidebar is collapsed).

Once signed in, the dashboard's direct `supabase-js` reads (`chargers`, `ratings`, `community_submissions`, `search_chargers`…) run as `authenticated` instead of `anon`. Every one of those grants both roles, so nothing changes.

## Adding an admin

1. Supabase dashboard → **Authentication → Users → Add user → Create new user**. Email + password, tick **Auto Confirm User**.
2. Copy the new user's UID, then in the SQL editor (or `npx supabase db query --linked` from `../charj`):

   ```sql
   INSERT INTO public.admins (user_id) VALUES ('<user uuid>');
   ```

3. Sign in on the dashboard.

Remove an admin: `DELETE FROM public.admins WHERE user_id = '<uuid>';` — their next admin call returns 403 and the dashboard signs them out. Deleting the auth user also removes the row (`on delete cascade`).

**Keep sign-ups enabled** in Authentication → Providers. The mobile app depends on anonymous sign-in; turning sign-ups off breaks every new install. Being able to create a Supabase user gives nobody admin access — only a row in `admins` does, and only the service role can write it.

## Legacy secret (transition only)

Dashboards built before this change send `Authorization: Bearer <ADMIN_API_SECRET>`. The functions still accept that while:

- `ADMIN_API_SECRET` is set on the functions, **and**
- `ADMIN_LEGACY_SECRET_ENABLED` is anything but `false` (unset = on).

A legacy call has no user (`userId: null`). The comparison is constant-time and the functions never log the token or any part of the secret.

### Rollout order

1. Create `public.admins` (migration in `../charj`) and add yourself (see above).
2. Deploy all seven admin functions from `../charj` (`--no-verify-jwt`, see [EDGE_FUNCTIONS.md](EDGE_FUNCTIONS.md)). The old dashboard keeps working via the legacy secret.
3. Push this repo → CI deploys the new dashboard. Sign in and check Users, Analytics, Driver visits, Verify, Status and Add/Edit charger.
4. Turn the legacy path off:

   ```bash
   cd ../charj
   npx supabase secrets set ADMIN_LEGACY_SECRET_ENABLED=false
   # optional, once you're sure nothing else uses it:
   npx supabase secrets unset ADMIN_API_SECRET
   ```

   The functions read env on every request — no redeploy needed. Old cached bundles now get 401.

5. Delete the `VITE_ADMIN_USER`, `VITE_ADMIN_PASS` and `VITE_ADMIN_API_SECRET` repo secrets at https://github.com/alabenkhlifa/CharJ-admin/settings/secrets/actions. CI no longer reads them.

Rollback while the legacy path is on: redeploy an older dashboard commit. After step 4, set `ADMIN_LEGACY_SECRET_ENABLED=true` again first.

## Why `--no-verify-jwt` stays

The gateway's JWT check would reject the legacy secret (not a JWT) during the transition, and it only proves the token is signed — an anonymous mobile user passes it. `authorizeAdmin` validates the token against Supabase Auth itself, so the gateway check adds nothing.

## Local dev

There is no bypass — local dev signs in like production. `.env` needs:

```
VITE_SUPABASE_URL=https://sblkoeronfuhqklvnhtn.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
VITE_GOOGLE_MAPS_API_KEY=<maps key>
```

Without the two Supabase vars the sign-in card says Supabase isn't configured.

Browser tests that need to get past the card plant a far-from-expiry session in `localStorage["charj-admin-auth"]` and route every `**/auth/v1/**`, `**/rest/v1/**` and `**/functions/v1/**` call (see `tests/charger-editor.browser.mjs`).
