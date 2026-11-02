# Responsiveness

> Hard rule: zero horizontal scroll at any viewport. `tests/pages.browser.mjs` checks every route and view at 375 / 768 / 1440, light and dark, plus right to left at 375 (`main.scrollWidth <= main.clientWidth` and the same for the document). DESIGN.md "Layout" is the source of the rules below.

## One viewport switch: 768px

| Width | Shell |
|---|---|
| under 768px | Phone: one column, page padding 16px, the frosted tab bar fixed to the bottom (five tabs; Notifications is a row in Settings), 88px plus the safe area kept free under the content. |
| 768px and up | The 260px sticky sidebar (`--sidebar-inline`) beside the content, page padding 28px, no tab bar. The sidebar lists all six pages, the ⌘K search and sign out. |

The shell lives in `src/ui/shell.css` (`.shell`, `.shell-main`, `.ui-tabs`, `.ui-side`); the padding token `--page-pad-inline` is in `src/index.css`. The kit has one more viewport rule: the cohort chips become a table from 768px (`.ui-coh` / `.ui-coh-table` in `ui.css`); Usage overrides it by room (below).

**The one exception, inside a control:** under 400px, Chargers' Add charger beside the large title's theme toggle shows only its plus in a 36px circle (`.ui-btn.chg-add` in `chargers.css`), keeping "Add charger" as its accessible name and tooltip, so the large title never breaks. (The charger editor sheet also tightens its header padding under 480px.)

## Content width

`.shell-main` pads its inline sides with `max(var(--page-pad-inline), (100% - 1120px) / 2)`: content is at most 1120px wide and centred, and every page inherits it. Chargers' map view (`#/chargers?view=map`) lifts the cap (`main[data-wide]`, `--content-max: 100%`) and keeps the page padding; the map bleeds to its card's edges.

## Inside a page: container queries

Every page wrapper is a size container (`.sum`, `.use`, `.com`, `.chg`, `.notif`, `.set`: `container: <name> / inline-size`), and its layouts follow the room the page has, not the viewport: at 768 the sidebar leaves the page about 450px, at 1024 about 710px.

| Page | Rule |
|---|---|
| Summary | Two card columns from 720px of page (the Today legend then fits beside the rings). |
| Usage | Two card columns from 720px; the cohort table from 600px (chips below, whatever the viewport); the Users table from 720px (list rows below). |
| Community | The four tabs in one row and four stats across from 600px; Feedback beside Design votes and Review reports beside Recent reviews from 900px. |
| Chargers | The list is one `<table>`: a sortable table from 860px of page, list rows below (with a Sort select and the filter chips folded behind "Filters"); connectors stay on one line from 1040px; network cards two across from 720px. |
| Notifications | Two card columns and the History table (instead of its list) from 900px. |
| Settings | Two cards across from 700px. |

## The folded large title

When a page's large title scrolls away, a blurred bar with the title (`.ui-lt-bar`, `src/ui/large-title.tsx`) is fixed to the top of the window. It is portalled to `<body>`, so no page container can box it in, and spans the whole main area at every width: the full width on a phone, everything after the sidebar from 768px (`body:has(.shell-side) .ui-lt-bar { inset-inline-start: var(--sidebar-inline) }`), however wide the page padding grows and on the full-width map view too. `pages.browser.mjs` checks both ends against `main` on every view that can scroll.

## The `minmax(0, 1fr)` gotcha (real bug we shipped + fixed)

Default `1fr` is `minmax(auto, 1fr)`. Auto uses min-content as the floor, and the min-content of a chart SVG drawn at a fixed width is that width, so a chart card inside a `1fr` column can force the column wider than the screen. Every grid in the app uses `minmax(0, 1fr)` (`repeat(2, minmax(0, 1fr))` for two columns), and grid / flex children that hold charts or tables set `min-inline-size: 0`. Keep it that way for anything new.

## Overflow patterns

- **Tables** scroll inside their card, never the page: `DataTable` wraps its table in `.ui-table-wrap` (`overflow-x: auto`).
- **Charts** are drawn at the container's real width (`useBoxWidth`, at least 280px) with a viewBox in real pixels; they never scale, so text keeps its size.
- **Long words** (charger names, emails, Arabic addresses) wrap with `overflow-wrap: anywhere` or truncate with an ellipsis on one-line rows (`.ui-row-d`, the search results).
- **Segmented controls** that would clip a long label on a phone become a select (DESIGN.md "Buttons and fields").

## RTL

Logical properties only (`inset-inline-start`, `margin-inline-end`, `padding-inline`, `border-block-start`), chart marks mirrored as a group with text placed separately, drawers and the tooltip placed with `inset-inline-*`. `pages.browser.mjs` runs every view at 375 with `dir="rtl"`.

## Verifying a page by hand

Open Chrome DevTools, resize to 375px, run in the console:

```js
const main = document.querySelector('main');
console.log({
  docHasHScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  mainHasHScroll: main.scrollWidth > main.clientWidth,
});
```

Both should be `false`. If not, walk the children:

```js
const vw = window.innerWidth;
[...document.querySelectorAll('main *')]
  .filter(el => el.getBoundingClientRect().right > vw + 1)
  .slice(0, 5)
  .forEach(el => console.log(el.tagName, el.className, el.getBoundingClientRect().width));
```

Usual culprits: a table without its wrapper, a chart in a `1fr` instead of `minmax(0, 1fr)`, a flex child without `min-inline-size: 0`, a long unbroken string without `overflow-wrap`.
