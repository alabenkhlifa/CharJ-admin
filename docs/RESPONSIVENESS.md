# Responsiveness

> Hard rule: zero horizontal scroll on `<main>` at any viewport. Verified at 375 / 768 / 1440 via Chrome DevTools sweeps.

## Breakpoints

| Width | What changes |
|---|---|
| ≤ 1400 | KPI grid drops from 4 → 3 columns |
| ≤ 1100 | KPI grid → 2 cols. `.row-2` and `.row-3` collapse to 1 col (with `minmax(0, 1fr)` — see gotcha below) |
| ≤ 900 | **Sidebar becomes a slide-out drawer.** `.map-grid` and `.feedback-grid` stack |
| ≤ 640 | KPI grid → 1 col. Topbar search hidden. `.card-grid-260` drops minmax floor so cards fit at 375px |

CSS lives in `src/index.css` (search for `@media`).

## Sidebar drawer pattern

The sidebar is part of the main flex container on desktop (sticky, 240px, takes column space). On mobile (<= 900px) it switches to:

```css
position: fixed;
inset-block: 0;
inset-inline-start: 0;
transform: translateX(-100%);   /* off-screen by default */
z-index: 60;
transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
```

When `mobileNavOpen === true` the transform becomes `translateX(0)`. A backdrop sits at `z-index: 59`. Tapping the backdrop, pressing the `X` button, or clicking any nav item closes the drawer (auto-close on nav).

The hamburger trigger lives in the Topbar (only renders when `isMobile === true`). On desktop the Topbar's hamburger slot is invisible and the existing collapse button on the sidebar header handles the 240↔64 toggle.

State:
- `App.tsx` owns `mobileNavOpen` and passes `mobileOpen` + `onCloseMobile` to `<Sidebar>` and `onOpenMenu` to `<Topbar>`.
- `useIsMobile()` (`src/lib/use-is-mobile.ts`) is the single source of truth — `matchMedia('(max-width: 900px)')`.

## The `minmax(0, 1fr)` gotcha (real bug we shipped + fixed)

Default `1fr` is `minmax(auto, 1fr)`. Auto uses min-content as the floor. **Min-content of an SVG with intrinsic width = the SVG's width.** Our charts use `useSize` with a 600px fallback width — so a chart card inside a `1fr` column establishes a 600px floor, which then forces the column to 600px instead of collapsing to viewport width. Result: the page overflows 375px on mobile even though the row "should" be 1 column.

Fix: always use `minmax(0, 1fr)` for grid columns that contain charts, tables, or any element with intrinsic min-content width:

```css
.row-2, .row-3 { grid-template-columns: minmax(0, 1fr) !important; }
```

If you add new responsive grid rules, prefer `minmax(0, 1fr)` over plain `1fr`.

## Page-level overflow patterns

### Tables (Chargers, Users)

Wrap in `<div style={{ overflowX: "auto" }}>` and set `min-width` on the table so it scrolls *inside the card*, never blowing out the page.

```tsx
<Card padding={0}>
  <div style={{ overflowX: "auto" }}>
    <table style={{ width: "100%", minWidth: 720 }}>
      ...
    </table>
  </div>
</Card>
```

### Tab strips (Submissions)

`flex` + `overflow-x: auto` + `whiteSpace: nowrap` + `flexShrink: 0` on each tab. So 4 tabs scroll horizontally inside the strip on narrow viewports without overflowing the page.

### Card grids (Submissions, Vehicles)

`grid-template-columns: repeat(auto-fill, minmax(320px, 1fr))` overflows below ~320px content area. Apply the `.card-grid-260` class so the @640px breakpoint drops the floor:

```css
.card-grid-260 {
  grid-template-columns: repeat(auto-fill, minmax(min(260px, 100%), 1fr)) !important;
}
```

`min(260px, 100%)` is the trick — never demand more than the container can give.

## Topbar shrink rules

On mobile:
- Hamburger button shows
- User button collapses to avatar only (label + role badge hidden)
- Search input hidden via `.topbar-search { display: none !important; }` at <= 640px

(Help + Notifications buttons were removed entirely — no source of data for either yet, so they were dead UI on every viewport.)

## Verifying a page is mobile-clean

Open Chrome DevTools, resize to 375px, run in console:

```js
const main = document.querySelector('main');
console.log({
  docHasHScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  mainHasHScroll: main.scrollWidth > main.clientWidth,
});
```

Both should be `false`. If `mainHasHScroll: true`, walk the children:

```js
const vw = window.innerWidth;
[...document.querySelectorAll('main *')]
  .filter(el => el.getBoundingClientRect().right > vw + 1)
  .slice(0, 5)
  .forEach(el => console.log(el.tagName, el.className, el.getBoundingClientRect().width));
```

The output is the offending elements. Usual culprits: a table without an `overflow-x` wrapper, a tab strip without `whiteSpace: nowrap`, a chart inside a `1fr` instead of `minmax(0, 1fr)`.
