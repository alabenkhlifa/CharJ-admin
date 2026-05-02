# Known issues

Outstanding limitations and what'd take to fix each. Not bugs — known constraints.

## 1. Login gate and admin EF bearer are public

Anyone who reads the JS bundle sees both. Mitigated by HTTPS + obscurity-by-default URL, but not real auth.

**Fix path**: replace with Supabase Auth (email/password or magic link) + an `admins` allowlist table. Drop both env vars. See `docs/AUTH.md` for the migration plan. ~½ day.

## 2. Anonymous-auth orphan rows

Per-user counts on the Users page (Reviews, Submissions) are always 0 because the UIDs in `ratings.rater` / `community_submissions.submitted_by` belong to long-pruned anonymous sessions.

**Fix path**: either (a) require non-anonymous accounts in the mobile app, or (b) record a stable installation ID alongside `auth.uid()` on every write. Mobile-app change. The dashboard hides the misleading columns until then.

## 3. No `gouvernorat` column on `chargers`

Only `city` (freeform TEXT). Several Overview charts and filters that would key off gouvernorat were dropped.

**Fix path**: add `gouvernorat TEXT` (with a CHECK against the 24 known values), backfill from existing `city` text via a one-shot script, then expose in `search_chargers` RPC. ~2 hours.

## 4. `feedback` and `review_reports` not surfaced

Both are service-role only. The Feedback page shows an EmptyState; review reports are not surfaced anywhere.

**Fix path**: build `admin-feedback` and `admin-review-reports` Edge Functions mirroring `admin-users` (bearer auth, CORS preflight before auth, json helper). Wire `useFeedback` and `useReviewReports` hooks. ~1-2 hours per function.

## 5. No mobile-app device info on users

Anonymous auth has no client-supplied device fingerprint. The most we have is `feedback.platform` / `feedback.app_version` / `feedback.device_id` (hashed) per submission — only for users who left feedback.

**Fix path**: a "Last seen on" lookup that joins users → most recent feedback or submission and surfaces `last_platform`, `last_app_version`, `last_seen_at`. Service-role only — extend `admin-users` EF. ~30 min.

## 6. Verify button can't be undone from the UI

The `admin-verify-charger` EF only sets `is_verified = true`. To unverify, run a SQL query:

```sql
UPDATE chargers
SET is_verified = false, verified_at = NULL, verified_by = NULL
WHERE id = '<uuid>';
```

**Fix path**: extend `admin-verify-charger` to take `{charger_id, verified}` and set whichever value. ~15 min.

## 7. Edit override button is a no-op

The "Edit override" button in the charger drawer renders but doesn't do anything. Real override editing needs the mobile-app's `set_charger_override` RPC — which is service-role.

**Fix path**: build an `admin-edit-charger-override` EF wrapping `set_charger_override`. The UI would need a small per-field editor (status, working hours, access type) — non-trivial UI work, ~2-4 hours.

## 8. Submissions Approve/Reject buttons don't work

UI exists but does nothing. Updating `community_submissions.status` is service-role.

**Fix path**: build an `admin-update-submission-status` EF. ~1 hour including UI optimistic update.

## 9. Bundle size warning at build time

`dist/assets/index-*.js` exceeds 500 KB. Build still succeeds but Vite warns.

**Fix path**: code-split via dynamic `import()` per page. Lowest-hanging: lazy-load `@vis.gl/react-google-maps` since it's only used on the Map page and the charger drawer. ~15 min.

## 10. No real router / no deep-links

Internal state-based routing means refreshing a page on `/CharJ-admin/users` lands you on Overview, not Users. Bookmarking a specific user is impossible.

**Fix path**: install `react-router` + add `<HashRouter>` (avoids SPA-fallback complexity on GH Pages). Each `RouteKey` becomes a path. ~1 hour.

## 11. No tests

There are no unit tests, integration tests, or E2E tests. We rely on TypeScript + manual Chrome DevTools sweeps.

**Fix path**: vitest for unit tests on data mappers. Playwright for E2E. ~½ day to set up + ½ day to write meaningful coverage.

## 12. Verify Edge Function uses a constant `verified_by`

Every manual verify writes `a2000000-0000-0000-0000-000000000000` as `verified_by`. There's no "who verified it" history.

**Fix path**: with real Supabase Auth, replace the constant with `auth.uid()` of the signed-in admin. Until then, all manual verifications look identical. (Also blocks the "Verification velocity per admin" Overview chart.)

---

If you fix any of these, update this file or remove the entry.
