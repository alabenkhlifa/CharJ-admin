# Architecture

## Why a separate repo

The mobile app (`../charj/`) is React Native + Expo. The admin is a static web SPA. Sharing nothing but the Supabase project + Google Maps key means both teams can iterate without RN/web tooling collisions and without bloating the mobile bundle with admin-only code.

## Stack choices

| Layer | Pick | Why |
|---|---|---|
| Bundler | **Vite** | Instant dev, simple `vite build` for static output |
| UI lib | **React 19 + TS strict** | Same skill as the mobile app |
| Styling | **CSS variables + inline styles** | One-to-one port from the original design-tool mockup. No Tailwind, no shadcn. Easier to keep the dashboard visually faithful and lets us drop a custom design without owning a build pipeline. Theme is one var swap. |
| Charts | **Hand-rolled SVG** (`src/components/charts.tsx`) | Donut, Area, StackedBar, Histogram, HBarList, Funnel — no chart-lib dependency. Tiny bundle, total control. |
| Maps | **`@vis.gl/react-google-maps`** | Modern hooks-based wrapper. We need Maps JavaScript API (the mobile app uses Maps SDK for Android — same key, different APIs). |
| Data | **`@supabase/supabase-js`** + raw `fetch` for admin Edge Functions | RPC-call pattern matches the mobile app. EFs use bearer-secret over plain fetch. |
| Routing | **In-memory state** | `useState<RouteKey>` in `App.tsx`. No URL changes, no router lib, no SSR. Simplest thing that works for an internal tool. If we ever need shareable deep-links, swap in `react-router`. |

## Module boundaries

Three folders, three responsibilities:

```
src/components/   # presentational, no Supabase imports
src/data/         # hooks that hit Supabase or admin EFs, return {data, loading, error}
src/pages/        # composed pages that call hooks + render components
```

Pages don't import from `src/lib/supabase.ts` directly — they go through a `data/` hook. Components don't import from `data/` — pages pass data as props. This keeps the data layer easy to refactor when we eventually move tables behind Edge Functions.

`src/lib/` is for cross-cutting infra (icons, theme, supabase client factory, route enum, mobile detection). Not page-specific.

## Auth model

Two layers, both intentionally lightweight:

1. **Login gate** (`src/lib/auth-gate.tsx`) — checks `VITE_ADMIN_USER` / `VITE_ADMIN_PASS` from the bundle against what the user typed. Stores success in sessionStorage. Pure UX deterrent for drive-by traffic.
2. **Edge Function bearer** (`VITE_ADMIN_API_SECRET`) — the actual access control for admin-only data (auth.users, set_charger_override, etc). Secret is sent as `Authorization: Bearer …` to functions in the mobile-app repo's `supabase/functions/`.

Both secrets live in the public bundle. They prevent casual access; they don't prevent a determined attacker. See `docs/AUTH.md`.

## Route enum

`src/lib/routes.ts` defines `RouteKey` and `NAV`. NAV is the source of truth for sidebar items + their icons + which ones get a glowing accent badge. **Counts are not stored on NAV** — they come from `useSidebarCounts()` and are merged in by the Sidebar at render time.

## Theming

`src/lib/theme.ts` exposes `useTweaks()`, returning `{ theme, accent, density, numStyle }` plus a setter. Persisted to localStorage. Mutating the values updates `data-theme`, `data-num`, and `--accent` on `<html>`.

All colors flow from CSS vars in `src/index.css` so a theme swap is one attribute change.

## Mobile

`src/lib/use-is-mobile.ts` is a matchMedia hook at `(max-width: 900px)`. When true:
- `Sidebar` becomes a fixed-position slide-out drawer with a backdrop
- `Topbar` shows a hamburger button, hides search / user-name
- Page-level `gridTemplateColumns` collapse via `.row-2`/`.row-3` CSS classes

See `docs/RESPONSIVENESS.md` for the breakpoint cheatsheet and the `minmax(0, 1fr)` chart-overflow story.

## Cross-cutting UI helpers

- **`src/components/pagination.tsx`** — single `<Pagination>` + `usePaginated<T>(items, resetKey, initialPerPage)`. Used by every list page (chargers, vehicles, reviews, submissions client-side; users wires it to the EF's server-side paging).
- **`src/lib/amenity-icons.tsx`** — 12-slug allowlist (mirrors `charj/lib/amenities.ts` and the `set_charger_override` validator) plus an `<AmenityIcon>` drawn lucide-style. Both the add-charger modal chips and the detail-drawer chips render through it.
- **`src/lib/use-global-search.ts`** + **`src/components/search-panel.tsx`** — power the topbar spotlight. ⌘K focuses, debounced `search_chargers` calls drive the Chargers group, in-memory matching against `NAV` drives the Pages group. Charger picks deep-link via `pendingChargerId` lifted into `App.tsx`; the chargers page consumes + clears it on mount.
