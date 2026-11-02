# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Ala, the solo admin of Charj, mostly on his phone, a few times a day or week. Other admins may join later through the `public.admins` allowlist, but there is no team today. In one visit he wants to know two things: whether the app is healthy, and what needs him (feedback, charger submissions, review reports, failed charges).

## Product Purpose

Charj Admin is the back office of Charj, a free, ad-free EV charger finder for Tunisia (Android, iOS, Android Auto). It answers three questions from real usage data (do people come back, which features get used, where do people get stuck), and it is where the community queue gets worked: feedback, submitted chargers, review reports and driver visits. Success means the health check and the queue are understood in seconds, without SQL.

## Positioning

It knows Charj's own truths that a generic analytics tool can't: Tunisian governorates, Lune vs classic app designs, brand-only and customer-only chargers, the community confirmations behind charger reliability, the missing cars people searched for, and internal test phones left out of every number.

## Operating Context

- A static SPA on GitHub Pages (`https://alabenkhlifa.github.io/CharJ-admin/`). Sign-in is Supabase Auth plus the `public.admins` allowlist. Service-role data only comes through admin edge functions (`adminFetch`).
- Usage data is anonymous and pseudonymous. Days are Tunis days. Raw events are kept 90 days, and daily rollups with no identifiers are kept longer.
- Volumes are tiny today (about 5 production users a day) and will grow after the Lune OTA.
- Hash routing. Table state lives in the URL, so a view is a link.

## Capabilities and Constraints

- Six pages: Home (health and to-do), Usage, Chargers (table, map, editor), Community (feedback, submissions, reviews with reports, driver visits), Notifications, Settings.
- New admin power: resolving review reports. Missing cars are shown only; adding cars stays a database job.
- Never fabricate data. A percentage on a small group always comes with its count, and under 10 only the count shows.
- No decorative controls: a control that can't work yet is left out.
- Logical properties only (RTL-ready). Must work at 375 / 768 / 1440 with no horizontal scroll.
- Undecided: how Users fits inside Usage, and whether the funnel window is a session or a day.

## Brand Commitments

- Lively: colour and motion are wanted (Ala, 2 Nov 2026, after rejecting a fully neutral Swiss direction: "let's check more lively options with colors and animations"). This replaces the earlier "fully neutral" rule. Data colours (charger status, connector types) keep their meaning.
- It must not look like a generic template, must not put decoration over data, must not feel dense, and must not show numbers that can't be acted on.

## Evidence on Hand

- A real usage snapshot from two internal test phones plus live to-do data: `docs/mockups/admin-dashboard.html` (inlined).
- Specs: `../charj/docs/superpowers/specs/2026-11-01-admin-dashboard-design.md` and `../charj/docs/superpowers/specs/2026-11-01-analytics-events-design.md`.
- No real user cohorts yet. Production return rates have no data until the Lune OTA, and that must not be faked.

## Product Principles

1. Every number leads somewhere: to an action, a page or a decision. Otherwise it goes.
2. Counts before percentages, and honesty about small samples.
3. The queue comes first: whatever needs Ala is visible without a click.
4. Phone first: one-handed, glanceable, readable outdoors. Desktop gets more columns, not more stuff.
5. Calm by default. Emphasis is earned by a problem, never spent on chrome.
