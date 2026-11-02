# Architecture

## Why a separate repo

The mobile app (`../charj/`) is React Native + Expo. The admin is a static web SPA. Sharing nothing but the Supabase project + Google Maps key means both teams can iterate without RN/web tooling collisions and without bloating the mobile bundle with admin-only code.

## Stack choices

| Layer | Pick | Why |
|---|---|---|
| Bundler | **Vite** | Instant dev, simple `vite build` for static output |
| UI lib | **React 19 + TS strict** | Same skill as the mobile app |
| Styling | **CSS variables + one stylesheet per kit / page** | Tokens in `src/index.css`, verbatim from DESIGN.md (`tests/tokens.test.ts` checks them). No Tailwind, no shadcn: the Health Rings look is small and specific, and a theme is one attribute swap (`html[data-theme]`). Inline styles only for dynamic values. |
| Charts | **Hand-rolled SVG kit** (`src/ui/`) | Rings, sparkline Bars, stacked Columns, horizontal HBars, Ladder (funnels). Drawn at the container's real width (`useBoxWidth`), every bar a focusable hit area with a tooltip, every chart a "Show table". No chart-lib dependency. |
| Maps | **`@vis.gl/react-google-maps`** | Hooks-based wrapper over the Maps JavaScript API (the mobile app uses Maps SDK for Android — same key, different APIs). One live map at a time. |
| Data | **`@supabase/supabase-js`** + `adminFetch` for admin Edge Functions | RPC-call pattern matches the mobile app. EFs get the signed-in admin's session token over plain fetch. |
| Routing | **URL hash** (`src/lib/use-route.ts`) | No router lib. The page, its section or tab, and every filter live in the hash, so a refresh or a pasted link lands on the same view. Old links are mapped by `src/lib/legacy-redirect.ts`. |
| Font | **System face, Inter off Apple** | `-apple-system … "Inter Variable", Roboto`; Inter is self-hosted from `@fontsource-variable/inter`. |

## Module boundaries

```
src/ui/          # the Health Rings kit: presentational, no data imports
src/components/  # bigger shared pieces (charger editor, add-charger modal, announce dialog, city picker)
src/data/        # hooks that hit Supabase or admin EFs, plus pure parsers
src/pages/       # composed pages: call hooks, render kit components
src/lib/         # cross-cutting infra: client, auth, routing, theme, icons, formatting
```

- Pages don't import `src/lib/supabase.ts` for data — they go through a `data/` hook. Kit components don't import from `data/`; pages pass data as props.
- Pure modules (`*-report.ts`, `*-model.ts`, `health-format.ts`, `tracking.ts`, `legacy-redirect.ts`, `theme-prefs.ts`) import nothing that needs a browser or React, so `node --test` loads them directly (`npm test`).
- Every admin response is parsed strictly by its `*-report.ts`: a missing key or a wrong type is an error the page shows, never a silent 0. Extra keys are ignored, so an additive server change never breaks the page.

## Auth model

1. **Sign-in** (`src/lib/auth-gate.tsx`) — Supabase Auth email + password; the session persists in localStorage and refreshes itself. It decides what to render (the sign-in card or the app), nothing more.
2. **Admin Edge Functions** — the actual access control for admin-only data. `adminFetch` (`src/lib/admin-fetch.ts`) sends the session's access token; each function validates it, refuses anonymous users, and requires a row in `public.admins` (`_shared/admin-auth.ts` in the mobile-app repo). A 401/403 signs the dashboard out with a notice.

No secret lives in the bundle. See `docs/AUTH.md`.

## Shell and navigation

`src/lib/routes.ts` defines `RouteKey` and `NAV` (six pages: Summary, Usage, Community, Chargers, Notifications, Settings). `App.tsx` renders the shell:

- **Under 768px** the frosted tab bar (`src/ui/tab-bar.tsx`) holds five tabs; Notifications is a row in Settings.
- **From 768px** the sticky sidebar (`src/ui/sidebar.tsx`) lists all six, with ⌘K search (`useGlobalSearch` + `SearchPanel`), the signed-in email and sign out.
- Both show the Community badge: the queue total from `useQueue()` (`src/data/queue.ts`), which App owns and passes to Summary (Needs you) and Community (tab badges). It reads on mount, after each Community action and on window focus.
- Every page opens with `LargeTitle` (`src/ui/large-title.tsx`): the title, an optional page action and the theme toggle. When it scrolls away, a blurred bar with the title is fixed to the top of the main area.
- `main` caps content at 1120px, centred; `?view=map` on Chargers lifts the cap (`main[data-wide]`).

## Theming

`src/lib/theme.ts` is one external store (`useSyncExternalStore`): `useTweaks()` returns `[tweaks, setTweak, resolved]`, where `tweaks.theme` is `system | light | dark`. It sets `html[data-theme]` and the theme-color metas, follows `prefers-color-scheme` live while on System, and syncs other tabs through the `storage` event. The large-title toggle and Settings both write it. `index.html` applies the stored theme before first paint, so there is no flash. The old stored shape is migrated by `src/lib/theme-prefs.ts`.

All colours flow from CSS variables in `src/index.css`; a theme swap is one attribute change. Category colours have three tones each (base, text, fill) per theme — see DESIGN.md "Category colour map".

## Cross-cutting helpers

- **`src/lib/health-format.ts`** — counts or percentages ("60% (12 of 20)", counts only under 10), ring progress and segments, nice axis maxima, short day labels.
- **`src/lib/tracking.ts`** — the days nobody measured (before 14 Sep 2026; 16 Sep–16 Oct 2026). Charts hatch them, tables say "not tracked", averages leave them out.
- **`src/ui/pager.tsx`** — the list footer ("26–50 of 312", rows per page, Previous / Next); pages keep `?page=` / `?per=` in the hash.
- **`src/lib/amenities.ts`** + **`amenity-icons.tsx`** — the 12-slug allowlist (mirrors `charj/lib/amenities.ts` and the `set_charger_override` validator) and its icons.
- **`src/lib/use-global-search.ts`** + **`src/components/search-panel.tsx`** — the sidebar spotlight: debounced `search_chargers` for chargers, in-memory `NAV` matching for pages. A charger pick deep-links to `#/chargers?id=`.
- **`src/lib/build-info.ts`** — the version (`package.json`) and commit (`git describe --always --dirty`, `+dirty` for a local build of uncommitted changes), written in by `vite.config.ts`; shown in Settings.
