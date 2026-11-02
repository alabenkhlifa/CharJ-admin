# Known issues

Outstanding limitations and what it'd take to fix each. Not bugs — known constraints.

## 1. Legacy admin secret still accepted (transition)

Admins now sign in with Supabase Auth + the `admins` allowlist, but the Edge Functions still accept the old `ADMIN_API_SECRET` bearer (which older bundles carry in public) until `ADMIN_LEGACY_SECRET_ENABLED=false` is set.

**Fix path**: once the new dashboard is deployed and verified, set `ADMIN_LEGACY_SECRET_ENABLED=false` and unset `ADMIN_API_SECRET`. See the rollout order in `docs/AUTH.md`.

## 2. Anonymous-auth orphan rows

Per-user counts (Reviews, Submissions) are always 0 because the UIDs in `ratings.rater` / `community_submissions.submitted_by` belong to long-pruned anonymous sessions.

**Fix path**: either (a) require non-anonymous accounts in the mobile app, or (b) record a stable installation ID alongside `auth.uid()` on every write. Mobile-app change. Usage → Users leaves the misleading columns out until then.

## 3. Device info on users is partial and opt-in

Usage → Users shows platform, app version, language, OS version, device model and screen size, taken from the newest `app_analytics_events` row per user via the `admin-users` EF.

What's still limited:

- Only users who left usage analytics enabled appear at all — opting out means no device row, ever.
- Model / OS / screen are `NULL` for every event sent before the device-context change (migration `20260916000001`, shipped as OTA `v1.2.1-ota.23`). The column fills in gradually as users open the updated app; it is not backfillable.
- iOS model reads `Constants.platform.ios.model`, which is deprecated in expo-constants. It's the only OTA-safe source — `expo-device` is not installed and adding it forces a native rebuild. Switch to `Device.modelName` at the next native build.
- Deliberately **not** collected: device name (it usually carries the owner's real name) and any hardware identifier that would re-identify a user across reinstalls.

## 4. Usage gaps that are real, not bugs

- Days before 14 Sep 2026 (analytics shipped) and 16 Sep–16 Oct 2026 (events didn't reach the server) were never measured. They read "not tracked" everywhere and stay out of averages; they can't be backfilled.
- Android Auto shows "No car events yet" (Idle Grey) until the native build that records them.
- Production return rates for Lune fill in only after the Lune OTA has been out long enough for a full week.
- No app-version filter on Usage: usage rows carry no `app_version` (versions are on Summary).

## 5. Verify button can't be undone from the UI

The `admin-verify-charger` EF only sets `is_verified = true`. To unverify, run a SQL query:

```sql
UPDATE chargers
SET is_verified = false, verified_at = NULL, verified_by = NULL
WHERE id = '<uuid>';
```

**Fix path**: extend `admin-verify-charger` to take `{charger_id, verified}` and set whichever value. ~15 min.

## 6. Verify Edge Function uses a constant `verified_by`

Every manual verify writes `a2000000-0000-0000-0000-000000000000` as `verified_by`. There's no "who verified it" history.

**Fix path**: `authorizeAdmin` already returns the signed-in admin's `userId`; write it (or the admin's email) instead of the constant.

## 7. `admin-analytics` is still deployed but unused

Usage reads `admin-usage` since the Health rebuild; nothing in the current dashboard calls `admin-analytics` (`get_app_analytics`). It stays deployed and unchanged so an older bundle still open in a browser keeps working.

**Fix path**: once the rebuilt dashboard has been live for a while, delete the function and, if nothing else reads it, the RPC.

## 8. No global search on phones

The ⌘K search lives in the sidebar, which shows from 768px. Phones reach chargers through the Chargers list search instead.

## 9. Bundle size warning at build time

`dist/assets/index-*.js` exceeds 500 KB. The build still succeeds but Vite warns.

**Fix path**: code-split via dynamic `import()` per page. Lowest-hanging: lazy-load `@vis.gl/react-google-maps`, used only by the Chargers map view and the charger drawer. ~15 min.

## 10. Tests run locally, not in CI

`npm test` (node's built-in runner, `tests/*.test.ts`, on the pure modules), `npm run lint` and the Playwright suites (`tests/*.browser.mjs`, every function mocked, run against a local Vite server; see CLAUDE.md "Commands") cover the dashboard, but `.github/workflows/deploy.yml` only builds. A broken suite doesn't block a deploy.

**Fix path**: add `npm test` and `npm run lint` to the workflow (cheap); the browser suites need a Playwright install step and the dev server, ~½ day.

---

If you fix any of these, update this file or remove the entry.
