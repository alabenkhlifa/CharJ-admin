// Dev-only fixture page: every src/ui kit component on the mock's test-phone
// data, for tests/kit.browser.mjs. Mounted by main.tsx; never built.
import { useState, type ReactNode } from "react";
import { useTweaks } from "../../src/lib/theme";
import { highlight, ringProgress, ringSegments, shortDay, windowState } from "../../src/lib/health-format";
import { HealthCard } from "../../src/ui/health-card";
import { Bubble } from "../../src/ui/bubble";
import { Segmented } from "../../src/ui/segmented";
import { Rings } from "../../src/ui/rings";
import { Bars } from "../../src/ui/bars";
import { Columns } from "../../src/ui/columns";
import { HBars } from "../../src/ui/hbars";
import { Ladder } from "../../src/ui/ladder";
import { LargeTitle } from "../../src/ui/large-title";
import { CohortChips } from "../../src/ui/cohort-chips";
import { Empty } from "../../src/ui/empty";
import { HeroValue } from "../../src/ui/hero-value";
import { Pill } from "../../src/ui/pill";
import { scrollToId } from "../../src/ui/motion";

const I = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: d }} />
);
const P = {
  rings: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21h4"/>',
  pulse: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  back: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  bars: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  screen: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  trip: '<path d="M3 17l6-6 4 4 8-8"/>',
  car: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 18v2M17 18v2"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
};

const days = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2026, 9, 4 + i)).toISOString().slice(0, 10));
const phones = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 1, 1, 2, 2];
const s24 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 99, 0, 4, 0, 0, 0, 0, 11, 291, 81, 256, 174];
const ios = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 234];
const within = (n: number) => (n === 1 ? "Within 1 day" : `Within ${n} days`);

type Tone = "needs-you" | "alarm" | "screens" | "actions";
const Row = ({ title, d, n, tone }: { title: string; d: string; n: number; tone: Tone }) => (
  <li className="kit-row">
    <span>
      <span className="kit-row-t">{title}</span>
      <span className="kit-row-d">{n ? d : "Nothing waiting"}</span>
    </span>
    <Bubble n={n} tone={tone} />
  </li>
);

const Grid = ({ children }: { children: ReactNode }) => <div className="kit-grid">{children}</div>;

export const KitPage = () => {
  const [tweaks, setTweak, theme] = useTweaks();
  const [env, setEnv] = useState<"test" | "prod">("test");
  const [plat, setPlat] = useState<"all" | "ios" | "android">("all");
  const test = env === "test";
  return (
    <main className="kit-main">
      <style>{`
        .kit-main { padding: 8px var(--page-pad-inline) 48px; max-width: 1120px; margin-inline: auto; }
        .kit-grid { display: grid; gap: 16px; grid-template-columns: minmax(0, 1fr); }
        @media (min-width: 768px) { .kit-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        .kit-sec { font: var(--type-section); margin: 26px 4px 10px; }
        .kit-mode { width: 36px; height: 36px; border-radius: 18px; background: var(--fill); display: grid; place-items: center; color: var(--ink-2); border: 0; }
        .kit-mode svg { width: 22px; height: 22px; stroke-width: 2; }
        .kit-hl { color: var(--ink-2); font: var(--type-subhead); margin: 0 4px 12px; }
        .kit-list { list-style: none; margin: 8px 0 0; padding: 0; }
        .kit-row { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; padding: 11px 0; border-block-start: 0.5px solid var(--sep); }
        .kit-row-t { font: var(--type-body); }
        .kit-row-d { display: block; color: var(--ink-2); font: var(--type-footnote); margin-block-start: 2px; }
        .kit-ver { display: flex; justify-content: space-between; padding: 8px 0; font: var(--type-subhead); }
        .kit-ver + .kit-ver { border-block-start: 0.5px solid var(--sep); }
        .kit-ver em { font-style: normal; color: var(--ink-2); }
      `}</style>
      <LargeTitle
        title="Summary"
        subtitle="Monday 2 November"
        trailing={
          <button className="kit-mode" type="button" aria-label="Switch light or dark" onClick={() => setTweak("theme", theme === "dark" ? "light" : "dark")}>
            <I d={P.moon} />
          </button>
        }
      />
      <p className="kit-hl">
        {highlight(2, 1, "phones", "Monday")} · pref: {tweaks.theme}
      </p>
      <div style={{ marginBlockEnd: 16 }}>
        <Segmented label="Data" value={env} onChange={setEnv} options={[{ v: "test", l: "Test phones" }, { v: "prod", l: "Production" }]} />
      </div>
      <Grid>
        <HealthCard title="Today" color="rings" icon={<I d={P.rings} />} meta={test ? "test phones" : "production"} index={0}>
          <Rings
            rings={[
              { id: "active", label: "Active", value: test ? 2 : 1, unit: test ? "of 2 phones" : "goal 4 (7-day avg)", progress: test ? ringProgress(2, 2) : ringProgress(1, 4), segments: test ? ringSegments(2) : ringSegments(4), tone: "active", onPick: () => scrollToId("card-active") },
              { id: "back", label: "Came back", value: test ? 1 : "—", unit: test ? "of 1 in 7 days" : "after the Lune OTA", progress: test ? 1 : 0, segments: test ? ringSegments(1) : undefined, tone: "came-back", onPick: () => scrollToId("card-back") },
              { id: "queue", label: "Queue clear", value: 4, unit: "waiting", progress: 0, tone: "queue", onPick: () => scrollToId("card-needs") },
            ]}
          />
        </HealthCard>
        <HealthCard title="Needs you" color="needs-you" icon={<I d={P.bell} />} meta="4 waiting" id="card-needs" index={2}>
          <ul className="kit-list">
            <Row title="Open feedback" d={'"Test du merci - revue Lune" · 1d ago'} n={3} tone="needs-you" />
            <Row title="Couldn't charge" d="Carrefour Marsa · 1d ago" n={1} tone="alarm" />
            <Row title="Charger submissions" d="" n={0} tone="screens" />
            <Row title="Review reports" d="" n={0} tone="actions" />
          </ul>
        </HealthCard>
        <HealthCard title="Active phones" color="active" icon={<I d={P.pulse} />} meta="30 days" href="#usage" id="card-active" index={1}>
          <HeroValue value={1} decimals={1} unit="avg / day" />
          <Bars data={days.map((d, i) => ({ key: d, value: phones[i] }))} tone="active" axis={{ start: shortDay(days[0]), end: "Today" }} label="Active phones per day, last 30 days" />
        </HealthCard>
        <HealthCard title="Came back" color="came-back" icon={<I d={P.back} />} meta="7 days" href="#usage" id="card-back" index={3}>
          <HeroValue value={1} unit="of 1" />
          <Empty size="body">Counts only, since under 10 installs is too few for a percentage.</Empty>
        </HealthCard>
        <HealthCard title="Versions in use" color="actions" icon={<I d={P.phone} />} meta="2 versions" index={4}>
          <ul className="kit-list">
            {[["Android 1.3.0", "lune"], ["Android 1.3.0", "no label"], ["iOS 1.3.0", "lune"]].map(([n, ui]) => (
              <li key={n + ui} className="kit-ver">
                <span>
                  {n}
                  <Pill>{ui}</Pill>
                </span>
                <em>1 phone</em>
              </li>
            ))}
          </ul>
        </HealthCard>
      </Grid>

      <h2 className="kit-sec" id="usage">Is anyone using it?</h2>
      <div style={{ marginBlockEnd: 16 }}>
        <Segmented label="Platform" value={plat} onChange={setPlat} options={[{ v: "all", l: "All" }, { v: "ios", l: "iOS" }, { v: "android", l: "Android" }]} />
      </div>
      <Grid>
        <HealthCard title="Active phones" color="active" icon={<I d={P.pulse} />} meta="per day">
          <Columns labels={days} series={[{ name: "Active phones", tone: "active", values: phones }]} label="Active phones per day" yMax={2} height={150} />
        </HealthCard>
        <HealthCard title="Events" color="active" icon={<I d={P.bars} />} meta="by phone">
          <Columns
            labels={days}
            series={[
              { name: "iPhone (iOS)", tone: "active", values: plat === "android" ? [] : ios },
              { name: "S24U (Android)", tone: "idle", values: plat === "ios" ? [] : s24 },
            ]}
            label="Events per day by phone"
            height={150}
          />
        </HealthCard>
      </Grid>
      <h2 className="kit-sec">Do people come back?</h2>
      <HealthCard title="By install week" color="came-back" icon={<I d={P.back} />}>
        <CohortChips
          detailHeader="Phone"
          rows={[
            { id: "w1", title: "Week of 18 May", detail: "iPhone · tracked from 1 Nov", cells: [1, 7, 30].map((n) => ({ label: within(n), state: windowState("2026-05-19", "2026-11-01", n, true), n: 0, of: 1 })) },
            { id: "w2", title: "Week of 19 Oct", detail: "S24U", cells: ([[1, true, 0], [7, true, 1], [30, false, 1]] as const).map(([n, f, b]) => ({ label: within(n), state: windowState("2026-10-22", "2026-10-22", n, f), n: b, of: 1 })) },
            { id: "w3", title: "Week of 26 Oct", detail: "Production iOS", cells: ([[1, true, 6], [7, true, 12], [30, false, 14]] as const).map(([n, f, b]) => ({ label: within(n), state: windowState("2026-10-26", null, n, f), n: b, of: 20 })) },
          ]}
        />
        <Empty>Installed = the week the anonymous account was created. Under 10 installs it shows counts, not percentages.</Empty>
      </HealthCard>
      <h2 className="kit-sec">Which features get used?</h2>
      <Grid>
        <HealthCard title="Screens" color="screens" icon={<I d={P.screen} />} meta="views">
          <HBars
            label="Screen views"
            labelHeader="Screen"
            series={[{ name: "iOS", tone: "screens" }, { name: "Android", tone: "idle" }]}
            rows={([["Map", 45, 35], ["Charger detail", 33, 23], ["List", 12, 9], ["Trip planner", 9, 12], ["Settings", 12, 4], ["Saved trips", 5, 8], ["Station updates and more", 3, 0]] as const).map(([name, a, b]) => ({ name, values: [a, b] }))}
          />
        </HealthCard>
        <HealthCard title="Trip planner" color="trip" icon={<I d={P.trip} />}>
          <Ladder unit="phones" tone="trip" steps={[{ name: "Planner opened", value: 21, users: 2 }, { name: "Route asked", value: 57, users: 2 }, { name: "Route found", value: 57, users: 2 }, { name: "Trip saved", value: 6, users: 2 }, { name: "Trip shared", value: 3, users: 1 }, { name: "Navigation opened", value: 2, users: 1 }]} />
        </HealthCard>
        <HealthCard title="Onboarding" color="onboarding" icon={<I d={P.check} />}>
          <Ladder unit="phones" tone="onboarding" steps={[{ name: "Onboarding shown", value: 9, users: 2 }, { name: "Finished", value: 4, users: 2 }, { name: "with a car", value: 1, sub: true }, { name: "car skipped", value: 3, sub: true, note: "2 went" }]} />
        </HealthCard>
        <HealthCard title="Android Auto" color="idle" icon={<I d={P.car} />}>
          <Empty size="body">No car events yet. They arrive with the next native build.</Empty>
        </HealthCard>
      </Grid>
      <div style={{ height: 600 }} />
    </main>
  );
};
