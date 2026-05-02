# Deployment

Live: https://alabenkhlifa.github.io/CharJ-admin/

Static SPA served from GitHub Pages. CI builds on every push to `main` and deploys via the official `actions/deploy-pages@v4` action.

## Pipeline

`.github/workflows/deploy.yml`:

1. `actions/checkout@v4`
2. `actions/setup-node@v4` (Node 20, npm cache)
3. `npm ci`
4. `npm run build` — env vars injected from repo secrets
5. `cp dist/index.html dist/404.html` — SPA fallback so unknown paths still hydrate React
6. `actions/configure-pages@v5` + `actions/upload-pages-artifact@v3`
7. `actions/deploy-pages@v4`

Concurrency group `pages` cancels in-flight deploys on the same branch.

## Required GitHub repo secrets

Go to https://github.com/alabenkhlifa/CharJ-admin/settings/secrets/actions and create each:

| Secret | Same as | Visible in bundle? |
|---|---|---|
| `VITE_GOOGLE_MAPS_API_KEY` | mobile app's `GOOGLE_MAPS_API_KEY` | yes (HTTP-referrer-restricted) |
| `VITE_SUPABASE_URL` | mobile app's `EXPO_PUBLIC_SUPABASE_URL` | yes |
| `VITE_SUPABASE_ANON_KEY` | mobile app's `EXPO_PUBLIC_SUPABASE_ANON_KEY` | yes (RLS-gated) |
| `VITE_ADMIN_USER` | the admin login username | yes |
| `VITE_ADMIN_PASS` | the admin login password | yes |
| `VITE_ADMIN_API_SECRET` | the Supabase function `ADMIN_API_SECRET` | yes |

If any are missing, the deploy still succeeds but the corresponding feature degrades:
- No Maps key → fallback hint card on map pages
- No Supabase URL → "Supabase not configured" banner
- No Admin user/pass → gate disabled (fail-open)
- No `VITE_ADMIN_API_SECRET` → Users page + Verify button surface "Admin API not configured"

## Vite base path

`vite.config.ts` sets `base: "/CharJ-admin/"` only in production:

```ts
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/CharJ-admin/' : '/',
}))
```

Because GitHub Pages serves project pages at `username.github.io/<repo>/`, the bundled assets need that subpath prefix. Local dev keeps `/` so paths work at `http://localhost:5173/`.

## SPA fallback

`dist/index.html` is duplicated to `dist/404.html` in the workflow. GitHub Pages serves `404.html` for any unknown path. Since both files boot the same React app, deep-links continue to work even if we ever add a real router.

## Google Maps key referrer restrictions

In GCP, restrict the Maps key by HTTP referrer to:

- `http://localhost:5173/*` and `http://localhost:5174/*` (dev)
- `https://alabenkhlifa.github.io/CharJ-admin/*` (prod)

If the production map shows "Sorry! Something went wrong", check the JS console — usually `RefererNotAllowedMapError` (fix referrer) or `ApiNotActivatedMapError` (enable Maps JavaScript API alongside the existing Maps SDK for Android).

## Supabase Edge Functions

Live in **`../charj/supabase/functions/`** — that's a different repo (mobile app). Push to its `main` and run from inside that repo:

```bash
cd ../charj
npx supabase functions deploy admin-users --no-verify-jwt
npx supabase functions deploy admin-verify-charger --no-verify-jwt
```

`--no-verify-jwt` is required — see `docs/EDGE_FUNCTIONS.md`.

`ADMIN_API_SECRET` env var must match the `VITE_ADMIN_API_SECRET` set in admin-repo GH secrets:

```bash
cd ../charj
npx supabase secrets set ADMIN_API_SECRET=<value>
```

## Watching a deploy

```bash
gh run list --repo alabenkhlifa/CharJ-admin --limit 3
gh run view <run-id> --repo alabenkhlifa/CharJ-admin --log
```

Typical green build: ~35-45s.

## Rolling back

GitHub Pages serves whatever the most recent successful deploy artifact contains. To roll back, push a `git revert` of the offending commit, or re-run a previous successful run from the Actions UI.
