# Auth + access control

> TL;DR: There is no real auth. There's a login gate (security theater) and a bearer secret for admin Edge Functions. Both live in the public bundle. Migrate to Supabase Auth + an admins allowlist before exposing anything more sensitive than what's already here.

## The login gate

`src/lib/auth-gate.tsx` wraps the entire app. On first load it shows a centered card asking for username + password. On submit it compares against:

```ts
import.meta.env.VITE_ADMIN_USER
import.meta.env.VITE_ADMIN_PASS
```

Both are inlined at build time. Anyone who opens DevTools can read them.

Behavior:

- Both env vars empty → **gate disabled** (fail-open). Used for local dev.
- Either one set → gate enforced. Match writes a success flag to `sessionStorage`. Closing the tab clears it.
- Mismatch → red error chip + a small shake animation. Password field is cleared on every wrong attempt.

This keeps:

- Drive-by traffic and search engines off the dashboard
- Casual onlookers from poking around (most users won't open DevTools)

It does NOT keep:

- Determined attackers out
- Anyone who reads the JS bundle out (browser cache, Sourcemaps, CDN)
- Bots from credential-stuffing the bundled value

Acceptable as long as everything behind it is also gated by something else (anon-key + RLS, or Edge Function bearer).

## Bearer secret for admin Edge Functions

Some data isn't anon-readable — `auth.users`, the `feedback` table, `review_reports`, and admin write operations like verifying chargers. Anything that needs service-role goes through an Edge Function in `../charj/supabase/functions/`. The function is gated by a shared bearer secret:

```
Authorization: Bearer <VITE_ADMIN_API_SECRET>
```

The same value is set on the Supabase function as `ADMIN_API_SECRET` (one env var, two namespaces). The function compares incoming bearer to its env var; mismatch → 401.

The secret is in the bundle, same as the gate password. Trust model: identical to the gate.

**Why bearer-secret, not Supabase Auth?**

The dashboard is a static SPA on GitHub Pages. We don't have an admin user table, no email/password sign-up, no magic-link flow. Adding Supabase Auth means:

1. Add an `admins` allowlist table with RLS allowing only listed UIDs to read/write protected resources
2. Pick a sign-in method (email/password / magic link / OAuth)
3. Wire `supabase.auth.getSession()` into every protected hook + EF
4. Edge Functions check `auth.uid()` against the allowlist instead of comparing a bearer

Doable, ~half a day of work. Worth it before exposing PII (real emails, payment data, etc.). Until then, the bearer pattern is the smallest thing that works.

## Migration path: when bearer-secret stops being enough

Triggers to switch to real auth:

- Adding any UI that reads PII from `auth.users` (real emails, names, phone)
- Adding any "delete user" / "ban user" action
- Adding moderation actions on `review_reports` (the reporter UID is meaningful and should only be visible to a real admin)
- The dashboard URL becomes broadly known (we're @ obscurity-by-default right now)

Migration steps (rough):

1. Create `public.admins (id uuid primary key references auth.users)` table
2. Sign in admins with email/password via Supabase Auth → drops the existing `VITE_ADMIN_USER/PASS` gate
3. Edge Functions: replace `if (bearer != ADMIN_API_SECRET) return 401` with `const { data: { user } } = await sb.auth.getUser(req.headers.get('Authorization')); if (!user || !inAdminsTable(user.id)) return 401`
4. Drop `--no-verify-jwt` from EF deploys (we'll want the gateway to validate JWTs)
5. Drop `VITE_ADMIN_API_SECRET` from `.env` + GH secrets
6. Drop the SPA's bearer headers; pass the user's session JWT instead

The bearer-secret commit landed in `../charj` repo's main; reverting auth is a coordinated change across both repos.

## Local dev

Empty `VITE_ADMIN_USER` + `VITE_ADMIN_PASS` to skip the gate. Set `VITE_ADMIN_API_SECRET` to the live value to test admin EF calls (Users page, Verify charger button) against the live Supabase project.

`.env`:

```
VITE_ADMIN_USER=
VITE_ADMIN_PASS=
VITE_ADMIN_API_SECRET=<same as Supabase ADMIN_API_SECRET>
VITE_SUPABASE_URL=https://sblkoeronfuhqklvnhtn.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
VITE_GOOGLE_MAPS_API_KEY=<maps key>
```

## Rotating the bearer secret

If you suspect leakage:

```bash
NEW_SECRET=$(openssl rand -hex 32)

# 1. Set on Supabase
cd ../charj
npx supabase secrets set ADMIN_API_SECRET=$NEW_SECRET

# 2. Update GH repo secret VITE_ADMIN_API_SECRET to the same value
#    (https://github.com/alabenkhlifa/CharJ-admin/settings/secrets/actions)

# 3. Update local .env

# 4. Push any commit to charj-admin to rebuild + redeploy with the new value
```

EFs read the env at every request — no function redeploy needed for rotation. Old bundles serving the old secret return 401.
