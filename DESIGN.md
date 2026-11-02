---
name: Charj Admin
description: The Charj back office as a Health-style summary. Three rings close as the day goes well, and every coloured category leads to its page.
colors:
  active: "#ff2d55"
  came-back: "#34c759"
  queue: "#00c7ff"
  needs-you: "#ff9500"
  alarm: "#ff3b30"
  screens: "#0a84ff"
  actions: "#5e5ce6"
  cars: "#a2845e"
  routes: "#30b0c7"
  onboarding: "#ffcc00"
  trip: "#00c7be"
  navigate: "#32ade6"
  contributions: "#af52de"
  languages: "#e70df2"
  permissions: "#b84900"
  users: "#d6008b"
  android-auto: "#6f1fd6"
  design: "#8b5cf6"
  idle: "#8e8e93"
  active-text-light: "#d70f3f"
  came-back-text-light: "#1f7f37"
  queue-text-light: "#0071a4"
  needs-you-text-light: "#c93400"
  alarm-text-light: "#d70015"
  screens-text-light: "#0040dd"
  actions-text-light: "#3634a3"
  routes-text-light: "#0e7083"
  onboarding-text-light: "#8a6a00"
  trip-text-light: "#007b75"
  navigate-text-light: "#0071a4"
  cars-text-light: "#7a6142"
  contributions-text-light: "#8944ab"
  languages-text-light: "#bd0bc6"
  permissions-text-light: "#b84900"
  users-text-light: "#d10088"
  android-auto-text-light: "#6f1fd6"
  design-text-light: "#7c3aed"
  onboarding-fill-light: "#a37f00"
  trip-fill-light: "#00807a"
  navigate-fill-light: "#0071a4"
  cars-fill-light: "#7a6142"
  active-text-dark: "#ff375f"
  came-back-text-dark: "#30d158"
  queue-text-dark: "#64d2ff"
  needs-you-text-dark: "#ff9f0a"
  alarm-text-dark: "#ff453a"
  screens-text-dark: "#409cff"
  actions-text-dark: "#7d7aff"
  routes-text-dark: "#5ac8e0"
  contributions-text-dark: "#da8fff"
  languages-text-dark: "#e70df2"
  permissions-text-dark: "#e35a00"
  users-text-dark: "#ff00a6"
  android-auto-text-dark: "#b75fe3"
  design-text-dark: "#ccbbff"
  grouped-ground-light: "#f2f2f7"
  card-light: "#ffffff"
  card-pressed-light: "#f7f7fa"
  ink-light: "#000000"
  ink-secondary-light: "rgba(60, 60, 67, .73)"
  separator-light: "rgba(60, 60, 67, .16)"
  fill-light: "rgba(120, 120, 128, .12)"
  bar-material-light: "rgba(249, 249, 249, .86)"
  grouped-ground-dark: "#000000"
  card-dark: "#1c1c1e"
  card-pressed-dark: "#2c2c2e"
  ink-dark: "#ffffff"
  ink-secondary-dark: "rgba(235, 235, 245, .62)"
  separator-dark: "rgba(84, 84, 88, .65)"
  fill-dark: "rgba(120, 120, 128, .24)"
  bar-material-dark: "rgba(22, 22, 24, .86)"
  segment-thumb-dark: "#636366"
typography:
  large-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Segoe UI\", Roboto, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: ".01em"
  hero-number:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Segoe UI\", Roboto, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-.01em"
    fontFeature: "\"tnum\" 1"
  stat-number:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Segoe UI\", Roboto, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    letterSpacing: "-.01em"
    fontFeature: "\"tnum\" 1"
  section-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Segoe UI\", Roboto, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Segoe UI\", Roboto, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.3
  card-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Segoe UI\", Roboto, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
  subhead:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Segoe UI\", Roboto, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
  footnote:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Segoe UI\", Roboto, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
  caption:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Segoe UI\", Roboto, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
  chart-tick:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Segoe UI\", Roboto, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    fontFeature: "\"tnum\" 1"
  tab-label:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Segoe UI\", Roboto, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 500
rounded:
  bar: "3px"
  square: "6px"
  thumb: "7px"
  segment: "9px"
  chip: "10px"
  tooltip: "12px"
  bubble: "15px"
  card: "16px"
spacing:
  hairline: "2px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "28px"
components:
  card:
    backgroundColor: "{colors.card-light}"
    textColor: "{colors.ink-light}"
    rounded: "{rounded.card}"
    padding: "14px 16px 16px"
  card-dark:
    backgroundColor: "{colors.card-dark}"
    textColor: "{colors.ink-dark}"
    rounded: "{rounded.card}"
    padding: "14px 16px 16px"
  card-link-hover:
    backgroundColor: "{colors.card-pressed-light}"
  category-square:
    rounded: "{rounded.square}"
    size: "22px"
  count-bubble:
    textColor: "#ffffff"
    typography: "{typography.card-title}"
    rounded: "{rounded.bubble}"
    height: "30px"
    padding: "0 9px"
  count-bubble-zero:
    backgroundColor: "{colors.fill-light}"
    textColor: "{colors.ink-secondary-light}"
    rounded: "{rounded.bubble}"
    height: "30px"
  list-row:
    typography: "{typography.body}"
    padding: "11px 0"
  segmented-control:
    backgroundColor: "{colors.fill-light}"
    rounded: "{rounded.segment}"
    padding: "2px"
  segmented-thumb:
    backgroundColor: "{colors.card-light}"
    rounded: "{rounded.thumb}"
  segmented-thumb-dark:
    backgroundColor: "{colors.segment-thumb-dark}"
    rounded: "{rounded.thumb}"
  stat-chip:
    backgroundColor: "{colors.fill-light}"
    rounded: "{rounded.chip}"
    padding: "8px 10px"
  label-pill:
    backgroundColor: "{colors.fill-light}"
    textColor: "{colors.ink-secondary-light}"
    typography: "{typography.caption}"
    rounded: "{rounded.square}"
    padding: "2px 8px"
  tab-bar:
    backgroundColor: "{colors.bar-material-light}"
    typography: "{typography.tab-label}"
    padding: "6px 4px"
  sidebar-link:
    typography: "{typography.body}"
    rounded: "{rounded.chip}"
    padding: "9px 10px"
  sidebar-link-active:
    textColor: "{colors.active-text-light}"
    rounded: "{rounded.chip}"
    padding: "9px 10px"
---

# Design System: Charj Admin

## Overview

**Creative North Star: "Health Rings"**

Charj Admin reads like Apple Health's Summary tab turned on an app's own health. A grouped grey ground carries white cards (near-black cards on pure black in dark mode) with gently rounded corners. Each card opens with a small colour square and a bold title, then gives one number in large bold type. At the top, three Activity-style rings close as the day goes well: active phones against their goal, phones that came back, and a clear queue. Colour is lively and plentiful, but it is never decoration: every colour is a category, and the same category keeps the same colour on every page.

Density is calm. One idea per card, generous padding, hairline separators instead of boxes inside boxes. The phone is the primary device: a large title, a frosted tab bar, one column. From 768px a sidebar replaces the tab bar and cards pair up in two columns; desktop gets more columns, not more stuff. Motion is part of the world: rings fill, cards rise in a short stagger, numbers tick up, and all of it stops under reduced motion.

The system rejects the dark KPI-card row of generic admin templates, neutral Swiss grids, and any number that cannot be acted on. Data honesty is visual: under 10 a count shows, never a percentage, and missing data is written as "not tracked", never drawn as zero.

**Key Characteristics:**
- Grouped ground with flat 16px cards, no shadows on cards.
- One colour per category, with darker text and fill tones for light mode.
- System sans, large bold titles, bold tabular numbers.
- Three rings as the signature, each arc a tap target to its card.
- Hairline (0.5px) separators, logical properties throughout.
- Ease-out motion on one curve, all disabled under reduced motion.

## Colors

A full-saturation category palette (Apple system colours) on a quiet grey ground: the ground is calm so the categories can be loud.

### Primary
- **Ring Red** (active): the Active ring, the Active phones bars, the selected tab and sidebar item, iOS series in charts. The app's own pulse. As text on light cards it drops to Ring Red Text (active-text-light); on dark to active-text-dark.
- **Ring Green** (came-back): the Came back ring, card square, cohort section.
- **Ring Cyan** (queue): the Queue clear ring. Its light text tone (queue-text-light) is a deep blue because the base cyan fails on white.

### Secondary
- **Needs Orange** (needs-you): the Needs you card square and the open-feedback bubble.
- **Alarm Red** (alarm): Couldn't charge, the tab and sidebar count badge. Reserved for something broken.

### Tertiary (Usage categories)
Each Usage section owns one colour: **Screens Blue** (screens, also charger submissions and the "Show table" link), **Actions Indigo** (actions, also versions and review reports), **Onboarding Yellow** (onboarding), **Trip Teal** (trip), **Navigate Sky** (navigate), **Contributions Purple** (contributions), **Cars Brown** (cars), **Routes Teal-Blue** (routes), **Language Magenta** (languages), **Permission Rust** (permissions), **People Raspberry** (users), **Auto Violet** (Android Auto, once it has data).

On Community, the four queues keep their Needs-you colours (feedback Needs Orange, charger submissions Screens Blue, review reports Actions Indigo, couldn't charge Alarm Red). **Design Violet** (design, `#8b5cf6`, the colour the Lune design votes got when they arrived) is the Design votes card: informational, never a queue. The recent reviews borrow **Contributions Purple** (on Usage the same colour counts reviews posted) and driver visits **Navigate Sky** (the report a driver sends after going to a charger); neither is otherwise on Community. Design Violet's text tones were picked for contrast (≥4.5:1 text and bubble digits in both themes) and to stay ΔE ≥ 15 from Needs Orange, the only other category on its tab. The dataviz palette check passes for that pair in light; in dark only Needs Orange's own base sits above the lightness band. Against Actions Indigo (ΔE 7.4) and Screens Blue (deutan ΔE 1.8) it fails as a chart palette: legal here because Design Violet draws no chart and only meets them as tab badges, so the card title and its thumb glyph carry the meaning.

On Chargers, the catalogue is **Screens Blue** (the colour charger submissions already wear on Summary and Community): the list, the map card and every network card, and the single-series bars (access, power, governorates). Charger status (operational `#10B981`, under repair `#F59E0B`, planned `#6366F1`, unknown `#71717A`) and connector type (Type 2 `#3B82F6`, CCS `#8B5CF6`, CHAdeMO `#EC4899`) keep the colours they have in the app (`src/data/chargers.ts`) as **domain marks only**: map pins, 8px dots and squares beside a row's words, and the bars of the Status and Connectors charts. They are never text and never a category square; the words beside them are Ink. "Needs a look" (catalogue gaps that wait for the admin: unverified, no city, no hours) borrows **Needs Orange**, the colour of what waits for you. An empty catalogue turns the network square Idle Grey.

The four added for Usage (languages, permissions, users, android-auto) sit in the hue gaps the Apple system colours leave (magenta, raspberry, violet, rust). Picked by OKLab distance from every tone a Usage page shows (bases, light fills, light and dark text), each at least ΔE 10 from them, and validated as a set with the dataviz palette check in both modes (lightness band, chroma, CVD ≥ 8 pairwise, normal vision ≥ 15, ≥ 3:1 on the card; Auto Violet is under 3:1 on the dark card, which is legal because Android Auto draws no chart). The system was already crowded (Active and Alarm sit ΔE 4.5 apart), so a colour is never the only cue: every card carries its title.

### Neutral
- **Grouped Ground** (grouped-ground-light / grouped-ground-dark): page background, #f2f2f7 light, pure black dark.
- **Card** (card-light / card-dark): every container. Card Pressed (card-pressed-*) is the hover of a linked card.
- **Ink / Secondary Ink** (ink-*, ink-secondary-*): primary text; secondary text, units, meta, axis ticks. Secondary Ink is .73 alpha in light (iOS uses .6), the lightest that reaches 4.5:1 on Grouped Ground.
- **Separator** (separator-*): 0.5px row dividers, chart gridlines.
- **Fill** (fill-*): segmented track, zero bubbles, chips, pills, empty bars and progress tracks.
- **Idle Grey** (idle): inactive tab icons, chevrons, sub-step bars, Android series, and a category before its data exists (Android Auto until its first event, a Lune-only chart before the Lune update). Never a category that has data.
- **Bar Material** (bar-material-*): the frosted tab bar.

### Category colour map

| Category | Base (ring, bars, dark fills) | Light text (and light bubble) | Light fill (square) | Dark text (and dark bubble) |
|---|---|---|---|---|
| Active | active | active-text-light | base | active-text-dark |
| Came back | came-back | came-back-text-light | came-back-text-light | came-back-text-dark |
| Queue | queue | queue-text-light | queue-text-light | queue-text-dark |
| Needs you | needs-you | needs-you-text-light | needs-you-text-light | needs-you-text-dark |
| Alarm | alarm | alarm-text-light | alarm-text-light | alarm-text-dark |
| Screens | screens | screens-text-light | base | screens-text-dark |
| Actions | actions | actions-text-light | base | actions-text-dark |
| Onboarding | onboarding | onboarding-text-light | onboarding-fill-light | base |
| Trip | trip | trip-text-light | trip-fill-light | base |
| Navigate | navigate | navigate-text-light | navigate-fill-light | base |
| Routes | routes | routes-text-light | routes-text-light | routes-text-dark |
| Cars | cars | cars-text-light | cars-fill-light | base |
| Contributions | contributions | contributions-text-light | base | contributions-text-dark |
| Languages | languages | languages-text-light | base | languages-text-dark (= base) |
| Permissions | permissions | permissions-text-light (= base) | base | permissions-text-dark |
| Users | users | users-text-light | base | users-text-dark |
| Android Auto | android-auto | android-auto-text-light (= base) | base | android-auto-text-dark |
| Design votes | design | design-text-light | base | design-text-dark |
| Idle | idle | ink-secondary-light | base | ink-secondary-dark |

Every coloured text tone meets 4.5:1 on both Card and Grouped Ground in its theme, and so does Secondary Ink (also on Fill over Card, where zero bubbles and chips sit). Idle text is Secondary Ink, like any other secondary text. Count bubbles are filled with the category's **text** tone in both themes, not the fill tone, so their digits in glyph ink reach 4.5:1 too. `tests/tokens.test.ts` checks all of this with the WCAG formula.

Glyph ink on a filled square or bubble flips with the theme: white on light, black on dark (`--glyph`). Rings, chart bars and progress bars always use the base tone; the darker tones exist for small filled shapes and coloured text, where the base fails contrast on white.

### Named Rules
**The One Colour Per Category Rule.** A category's colour is fixed everywhere it appears (ring, square, bubble, bars, legend label). Never reuse a category colour for a different meaning on the same page, and never colour something that is not a category.

**The Light Tone Rule.** On light surfaces, coloured text and filled squares or bubbles carrying glyphs use the darker accessible tone from the map. Base tones are for strokes and bars only.

**The Alarm Is Earned Rule.** Alarm Red appears only when something is broken or waiting with a count above zero. A zero is drawn in Fill and Secondary Ink, never in a category colour.

## Typography

**Display Font:** system sans (-apple-system / SF Pro, Segoe UI, Roboto)
**Body Font:** same stack
**Label/Mono Font:** same stack with tabular numerals

**Character:** One family in the iOS text ramp; hierarchy comes from size and weight (700 for titles and numbers, 600 for card titles and legend labels, 400–500 for the rest). Numbers are always tabular so ticking values do not jitter.

### Hierarchy
- **Large title** (700, 34px): page title ("Summary", "Usage"), date under it in Subhead Secondary Ink.
- **Hero number** (700, 34px, line-height 1, -.01em): the one value of a card, unit beside it in 17px 500 Secondary Ink.
- **Stat number** (700, 26px; 28px in paired stats): ring legend values and two-up stat pairs.
- **Section title** (700, 22px): Usage questions ("Do people come back?").
- **Body** (400, 17px, 1.3): list row titles, sidebar links.
- **Card title / Subhead** (600 / 400, 15px): card header title; meta, descriptions, version rows, "Show table".
- **Footnote** (400, 13px, 1.4): row details, notes, chart labels, table headers, tooltips. Notes cap at 70ch.
- **Caption** (600, 12px): pills, chip labels, badges, x-axis.
- **Chart tick** (400, 11px, tabular): y-axis ticks.
- **Tab label** (500, 10px): phone tab bar only.

### Named Rules
**The Bold Number Rule.** The number is the loudest thing in a card, bold and tabular; its unit sits beside it smaller and in Secondary Ink.

**The Plain Sentence Rule.** Labels and notes are plain sentences in sentence case. No uppercase labels, no letter-spaced kickers above titles.

**Open item: Android font.** The S24U falls back to Roboto. The build picks a hosted SF-like fallback (Inter is the candidate) loaded only off Apple platforms; Apple devices keep the system face.

## Layout

- **Phone (under 768px):** one column, page padding 8px 16px with 96px plus the safe area at the bottom for the tab bar. Cards stack with 16px gaps.
- **Tablet and desktop (768px and up):** a 260px sidebar column plus content; content padding 10px 28px 48px, max width 1120px, centred. Cards sit in a two-column grid (16px gap); a card may span both. Needs you sits beside the rings on Home.
- **Rhythm:** 16px between cards, 26px above a section title and 10px below it, 10–12px between a card header and its content, 4px between a value and its sub line.
- **Large title block:** 18px top, 14px bottom, the theme toggle (36px circle in Fill) at the end edge.
- **Responsive swaps, not shrinking:** the cohort table becomes per-phone chip rows (three chips across) under 768px and a table above it. Inside Usage the swap follows the room the page has, not the viewport: the table shows from 600px of content (at 768 the sidebar leaves ~450px), and once a week has 10 or more installs ("60% (12 of 20)") the chips go one per row on a narrow page.
- Logical properties only: `inset-inline`, `margin-inline`, `padding-inline-start`, `border-block-start`.

Breakpoints: 768px is the only layout switch; the product must hold at 375 / 768 / 1440 with no horizontal scroll.

## Elevation & Depth

Flat by default. Cards sit on the grouped ground by tone alone (white on #f2f2f7, #1c1c1e on black) with no shadow. Depth appears only on things that float over content.

### Shadow Vocabulary
- **Segment thumb** (`box-shadow: 0 3px 8px rgba(0,0,0,.12), 0 3px 1px rgba(0,0,0,.04)`): the selected segment lifting off its track.
- **Tooltip** (`box-shadow: 0 8px 30px rgba(0,0,0,.18)`): chart tooltip on a card.
- **Bar material** (`backdrop-filter: saturate(180%) blur(20px)` over Bar Material, 0.5px top separator): the phone tab bar.
- **Dialog** (`box-shadow: 0 24px 60px rgba(0,0,0,.3)` over a `rgba(0,0,0,.4)` scrim; tokens `--shadow-dialog`, `--scrim`): a confirm step floating over the page (Community's Approve).

### Named Rules
**The Tone Not Shadow Rule.** Cards never carry a shadow or border. Separation comes from the ground/card tone step and 0.5px separators inside cards.

## Shapes

Continuous soft corners scaled to size: cards 16px, chips and sidebar links 10px, segmented track 9px and thumb 7px, colour squares and pills 6px, bar tops 3–4px. Bubbles and badges are full pills (radius = half height). Rings and progress tracks use round caps. Lines are hairlines (0.5px). No outlined cards, no nested bordered boxes.

## Components

### Cards
- **Corner Style:** 16px.
- **Background:** Card; a card that links somewhere takes Card Pressed on hover and the whole card is the link.
- **Shadow Strategy:** none (see Elevation).
- **Internal Padding:** 14px top, 16px sides and bottom.
- **Header:** colour square (22px, 6px radius, 14px glyph at stroke 2.4 in glyph ink), card title 15px/600 filling the row, meta at the end in 15px Secondary Ink with an optional 14px chevron when the card links.
- **Entry:** rises 14px and fades in over 0.5s, staggered 60ms by order.

### Category square
Filled with the category colour (light: the fill tone from the map). The Today card's square is a 135deg gradient from Active to Queue because it holds all three rings; by the same rule the Usage Funnels card's square is a 135deg gradient of Onboarding, Trip, Navigate and Contributions, the four funnels it holds. A square names a category; it is never an ornament.

### List rows (Needs you)
- Two-column grid: title (Body) with a detail line (Footnote, Secondary Ink) on the start side, count bubble at the end. 11px block padding, 0.5px separators between rows.
- A zero row reads "Nothing waiting" and gets a zero bubble.
- **Open item:** each row links to its filtered Community view in the real build. The mock rows are not links on purpose (the target pages did not exist); do not ship a row that looks tappable and goes nowhere.

### Count bubble
30px tall pill, min width 30px, 9px inline padding, 15px/700 tabular in glyph ink, filled with the category's text tone in both themes (white digits on the dark light-mode tone, black digits on the light dark-mode tone, always 4.5:1 or more). At zero: Fill background, Secondary Ink text.

### Segmented control
Fill track, 9px radius, 2px padding, max width 420px, equal columns. Labels 13px/500, selected 600. A Card-coloured thumb (#636366 in dark) slides under the selected segment over 0.32s on the house curve, sized from the selected button. Buttons use `aria-pressed`. It only switches data (Test phones / Production, All / iOS / Android).

### Page tabs (Community)
Pills on the ground, not a segmented track: two by two on a phone, one row once all four fit with their badges (about 600px of page). 15px/500 Ink; the current tab lifts in Card with the segment-thumb shadow at 600, and is `aria-current="page"`; hover is Card Pressed. Each tab is a link (`?tab=`). Its badge is a 22px pill, 12px/600 tabular in glyph ink on the queue's text tone; a real zero is plain Secondary Ink with no fill; an unknown count shows no badge. Labels and zero badges sit on Card or Ground, never on Fill, where Secondary Ink drops under 4.5:1.

### Chargers views
- **View tabs** (List · Map · Network, `?view=`): the Community page-tab pills, three across at every width.
- **The list** is one table at every width. From 860px of page it is a table whose headers sort (`aria-sort`); narrower, each row lays out as a list row (name and power, the place, then status, connectors, access, hours, source and when it changed in Footnote) and a Sort select replaces the headers. Only one page of rows is in the DOM (the kit Pager, `?page=` / `?per=`).
- **Filters** are Fill chips (label in Secondary Ink, value in Ink, Screens Text while it narrows the rows) inside the card. On a narrow page the search takes its own row and the chips fold behind a "Filters" button with the count in use; open, they sit two to a row with the label above the value, so a value is never cut (a long one wraps, and the longest selects, Power and Updated, get a row each). A chip's menu floats in Card with the tooltip shadow: on a wide page it opens toward whichever side has room, on a narrow one right under the tapped chip, across the panel.
- **Download CSV**: a Screens Text action at the end of a chart's "Show table" line downloads that chart's rows; the one beside the section title downloads every number in the section.
- **The map** takes the page's full width (the shell's 1120px cap lifts for `?view=map`; the page padding stays) and bleeds to its card's edges. The count and the pin key float at the top in Card with the tooltip shadow (Google's logo and zoom buttons hold the bottom corners). There is only ever one live map: the detail drawer leaves its mini map out over the map view.
- **The detail drawer** is a side sheet (Card, the dialog shadow over the scrim), Escape or the scrim closes it. Today's opening hours wear the sidebar's current-page treatment (Screens at 14% behind Screens Text), and so does the current status button.

### Buttons and fields
- **Button:** Fill, 10px radius, 34px tall, 6px 14px, 15px/600 Ink. **Primary** (one per item: Approve) is filled with Screens Text in glyph ink, like a bubble, so its label keeps 4.5:1 in both themes.
- **Text action:** 15px/600 Screens Text, no fill ("Try again", "Show review", "Refresh" at the end of a list card's filter bar: lists reload by hand or after an action, never on a timer).
- **Select:** a filter whose labels carry counts ("Resolved (123)") or run long ("Couldn't charge") is a select (Fill, 10px radius, 15px/500), not a segmented control that would clip it on a phone.
- **Field:** Fill, 10px radius, 8px 10px, 17px Ink, label above in 13px Secondary Ink. Arabic fields write right to left.
- **Error line:** 15px Alarm Text (something failed); a done or refused action ("Someone already reviewed this") is a 15px Ink line on Fill above the list.

### Dialog
A native `<dialog>` (the browser keeps focus inside and closes on Escape): Card, 16px radius, at most 560px wide and the viewport less 16px on each side, scrolling inside itself. Section title as its heading; sections split by 0.5px separators; Cancel then the primary action at the end.

### Chips and pills
- **Stat chip:** Fill, 10px radius, 8px 10px; 12px/500 label above a 600 tabular value. Used for per-phone cohort values on phones.
- **Label pill:** Fill, 6px radius, 12px/600 Secondary Ink. Tags such as app design (lune / classic / no label) and an "open" window.

### Rings (signature)
- 148px SVG rotated -90deg; three concentric circles, radii 64 / 46 / 28, stroke 15, round caps.
- Order outside in: Active, Came back, Queue clear. Track is the same base colour at `--track` opacity (.16 light, .24 dark).
- Progress via `stroke-dashoffset`, filling over 1.2s on the house curve; a zero keeps a dot (progress floor .0001) so the ring stays legible. They refill when the data source switches.
- Arcs and tracks are tap targets (`pointer-events: stroke`) that scroll to their card; the legend beside the rings (label 15px/600 in the category text tone, value 26px/700, unit 15px/500 Secondary Ink) does the same as buttons.
- Queue clear is full when nothing waits, empty otherwise. Came back shows "—" and "after the Lune OTA" in Production until real data exists.
- **Build ceiling (not yet shipped):** Fitness-style finish (arc gradient, end-cap shading, overlap past 100%), and a segmented ring when the goal or sample is under 10.

### Bars
- **Sparkline bars (Home):** 30 flex columns, 3px gap, 64px tall, 3px radius, Active colour, growing from the bottom over 0.7s. A day with a real zero is a 3px Fill stub, not a bar. A day nobody measured is a full-height hatch in Fill (45deg, 2px on 5px), so it never reads as a zero. Axis: first day and "Today" in 12px Secondary Ink.
- **Progress bars (funnels):** 6px Fill track, 3px radius; fill in the funnel's colour, sub-steps in Idle Grey and indented 14px; widen over 0.9s, staggered 80ms after 0.1s.

### Charts (Usage)
- SVG drawn at the container's real width (`clientWidth`, minimum 280px) with a viewBox in real pixels, so text and bars never scale. Redraw on resize when width changes by more than 40px.
- Columns: 170px tall, 30px start gutter for ticks, stacked series with a 2px gap and only the top segment rounded (up to 4px). Gridlines in Separator at 0, half and max (0/1/2 when max is 2 or less). X labels every 7th day. An unmeasured column is a full-height Fill hatch; its tooltip says "Not tracked" and the table gives one "not tracked" row per run. 90 days go by Monday week: phones as the average of the measured days, events summed only for fully measured weeks.
- Horizontal bars: 32px rows, 16px bars, labels in a 112px (narrow) or 128px start gutter, total in 13px/600 after the bar.
- Every column or row has a full-height transparent hit rect that is focusable and shows the tooltip (Card background, 12px radius, 13px, swatch per series) on hover and focus.
- A key of 10px squares (3px radius) sits above multi-series charts; a "Show table" disclosure in Screens Blue text gives the same data as a table.

### Tables
15px, collapsed borders, 0.5px separators, headers 13px/500 Secondary Ink start-aligned, numeric columns end-aligned and tabular.

### Navigation
- **Tab bar (under 768px):** fixed to the bottom, five equal columns, frosted Bar Material, 0.5px top separator, safe-area padding. 24px icon over a 10px/500 label in Idle Grey; the current page in Active. A count badge (18px Alarm pill, 12px/600 white) sits at the icon's end corner.
- **Sidebar (768px and up):** sticky, full height, Card background, 0.5px end separator, 22px/700 brand at top. Links 17px with a 22px icon, 9px 10px padding, 10px radius; hover Fill; current page gets Active at 14% behind Active Text at 600. The badge moves inline to the end.
- **Build ceiling (not yet shipped):** the large title folds into a blurred inline bar on scroll.

### Empty and "not tracked" states
- No data for a window that was never measured reads "not tracked" in 13px Secondary Ink. It is never drawn as 0.
- The unmeasured spans live in one place (`src/lib/tracking.ts`): everything before 14 Sep 2026 (analytics shipped that day) and 16 Sep to 16 Oct 2026 inclusive (the app's events didn't reach the server). In charts those days are hatched (bars and columns), their tooltip and table say "not tracked", they stay out of every average, and a note under the chart names the span and why. A return window that overlaps one reads "not tracked".
- People are counted once: "Any design" reads the server's all-designs rows, a design reads only its own rows, and counts of people are never summed across designs (only across platforms, where a phone is one install).
- A real zero is a zero: Fill bubble, "Nothing waiting", or a Fill stub bar.
- Data that will exist later says when: "Production return rates fill in after the Lune OTA", "No car events yet. They arrive with the next native build." That category's square goes Idle Grey.
- Under 10, show counts only ("1 of 1") and say why in a sub line; a percentage always carries its count.

### Motion grammar
One curve: `cubic-bezier(.2, .8, .2, 1)` (fast start, soft landing). Rings 1.2s; card rise 0.5s with a 60ms stagger; sparkline bars 0.7s; funnel bars 0.9s with an 80ms stagger; segmented thumb 0.32s; numbers tick over 700ms with a cubic ease-out from their previous value. Ring taps scroll smoothly to the card. Under `prefers-reduced-motion: reduce`, every animation and transition is off, numbers jump to their value, and scrolling is instant.

## Do's and Don'ts

### Do:
- **Do** give every category one colour from the map and keep it on every page, ring to bubble to bars.
- **Do** use the darker light-mode tone for coloured text and for squares and bubbles carrying glyphs; flip glyph ink to black in dark mode.
- **Do** put one bold tabular number per card, unit beside it in Secondary Ink.
- **Do** draw charts at the container's real pixel width and give every bar or row a focusable hit area with a tooltip.
- **Do** write "not tracked" for unmeasured windows and show counts only under 10.
- **Do** swap layouts at 768px (chips to table, tab bar to sidebar, one column to two) instead of shrinking.
- **Do** use logical properties for every inline position, including chart grow origins and tooltip placement.
- **Do** run all motion on the house curve and switch it all off under reduced motion.

### Don't:
- **Don't** put shadows or borders on cards; depth is tone.
- **Don't** colour a zero, or use Alarm Red for anything that is not broken or waiting.
- **Don't** draw a missing value as 0 or show a percentage of fewer than 10.
- **Don't** ship a row, card or tab that looks tappable but goes nowhere; leave out controls that cannot work yet.
- **Don't** add uppercase or letter-spaced kickers above titles; the colour square and title are the header.
- **Don't** scale a chart SVG to fit (no fixed viewBox stretched to 100%), so ticks and labels keep their real size.
- **Don't** use a dark KPI-card row or a neutral monochrome grid; this world is grouped, coloured and calm.
