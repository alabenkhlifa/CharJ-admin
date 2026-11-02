---
version: 1
slug: "docs-mockups-admin-dashboard-html"
primary_target: "docs/mockups/admin-dashboard.html"
related_targets: []
---

Scope: Charj Admin, Home and Usage (the mock now, the SPA pages later). Visitor mode: Operate. Ala, alone, mostly on his phone, checking that the app is alive and clearing what waits. Content: real snapshot data (test phones) plus the live queue. Constraints: lively colour and motion (PRODUCT.md); under 10, counts not percentages; no decorative controls; 375/768/1440; logical properties. Rejected along the way: Swiss neutral grid, lexicon, guide map, split-flap, boarding pass, Lune night, weather sky, Stripe-style.

## Direction contract

THESIS: App health as an Activity-style summary. Three rings close as the day goes well: active against its 7-day norm, came back, queue clear. No dark KPI-card row.

OWN-WORLD: Health's grouped ground (#f2f2f7 light, black dark) with white or #1c1c1e cards at 16px radius. Category colour squares: active #ff2d55, came back #34c759, queue #00c7ff, needs-you #ff9500, alarm #ff3b30. System sans, large bold titles, numbers bold.

STORY: The rings say whether today is good. Cards below say what waits, and a tap goes to its page. Usage reads as Health categories, each with its own colour.

FIRST VIEWPORT: The "Summary" title with the date under it. A rings card with the three values beside it. An active-phones card with 30 red bars. A Needs-you card with coloured count bubbles. Signature interaction: the rings fill on load and refill when the data switches. Tapping a ring scrolls to its card. Motion is a 1.2s ease-out fill, cards rising in a 60ms stagger, numbers ticking.

FORM: Health Rings, safer lineup #2, seed 02f44df7.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
