import type { ReactNode } from "react";
import {
  activitySeries,
  actionRows,
  cohortRows,
  languageTable,
  permissionTable,
  screensTable,
  stepTotals,
  tapRows,
  type UsageStep,
} from "../data/usage-report";
import { countOrPercent, countOrPercentParts, plural, shortDay } from "../lib/health-format";
import type { Category } from "../ui/category";
import { CohortChips } from "../ui/cohort-chips";
import { Columns, type ColumnSeries } from "../ui/columns";
import { DataTable } from "../ui/data-table";
import { Empty } from "../ui/empty";
import { HBars } from "../ui/hbars";
import { HealthCard } from "../ui/health-card";
import { HeroValue } from "../ui/hero-value";
import { Ladder, type LadderStep } from "../ui/ladder";
import { TableView } from "../ui/table-view";
import { Note, Stats, UsageIcon, Waiting } from "./usage-bits";
import {
  actionName,
  detailName,
  failureName,
  languageName,
  PERMISSION_SOURCE,
  permissionName,
  platformName,
  RESULT_NAME,
  screenName,
  warningName,
  type UsageSection,
} from "./usage-labels";
import {
  LUNE_SOON,
  luneOnlyNote,
  lunePending,
  luneUnsplitNote,
  unsplitNote,
  who,
  windowText,
  type UsageScope,
} from "./usage-scope";

// The Usage drill-ins (?section=): every chart with its tooltip and table.

const nf = new Intl.NumberFormat("en-US");

export type SectionProps = {
  scope: UsageScope | null;
  /** "Loading…" or "Couldn't load." while there is no report. */
  waiting: string;
  href: (section?: UsageSection) => string;
};

/** iOS in the category's colour, Android (and anything else) in Idle Grey (DESIGN.md "Idle Grey"). */
const byPlatform = (platforms: string[], values: (p: string) => number[], tone: Category): ColumnSeries[] =>
  platforms.map((p) => ({ name: platformName(p), tone: p === "ios" ? tone : "idle", values: values(p) }));

const weekOf = (w: string) => `Week of ${shortDay(w)}`;

// ---- Activity ----

export const ActivityDetail = ({ scope: s, waiting }: SectionProps) => {
  const a = s && !lunePending(s) ? activitySeries(s.report, { from: s.ui === "lune" ? s.firstLune : null }) : null;
  const week = a?.grain === "week";
  const any = !!a && a.totalActive.some(Boolean);
  const body = (chart: (series: NonNullable<typeof a>) => ReactNode) => {
    if (!s) return <Waiting size="chart">{waiting}</Waiting>;
    if (!a) return <Empty size="body">{LUNE_SOON}</Empty>;
    if (!any) return <Empty size="body">No {who(s)} opened the app in {windowText(s.days)}.</Empty>;
    return (
      <>
        {chart(a)}
        {s.ui === "lune" && s.firstLune && <Note>Starts on {shortDay(s.firstLune)}, the first day with the Lune design.</Note>}
      </>
    );
  };
  const color: Category = s && !a ? "idle" : "active";
  const axis = week ? { formatLabel: weekOf, formatTick: shortDay, labelHeader: "Week" } : {};
  return (
    <>
      <HealthCard title="Active phones" color={color} icon={<UsageIcon name="pulse" />} meta={week ? "a day, by week" : "per day"} index={0}>
        {body((x) => (
          <>
            <HeroValue value={x.avgActive} decimals={1} unit="phones a day" />
            <Columns
              labels={x.labels}
              series={byPlatform(x.platforms, (p) => x.active[p], "active")}
              label={week ? "Phones that opened the app, average per day of each week" : "Phones that opened the app per day"}
              {...axis}
            />
            <Note>
              A phone counts once a day, however often it opens the app.{week && " Each column is the average day of that week."}
            </Note>
          </>
        ))}
      </HealthCard>
      <HealthCard title="Events" color={color} icon={<UsageIcon name="bars" />} meta={week ? "per week" : "per day"} index={1}>
        {body((x) => (
          <>
            <HeroValue value={x.totalEvents.reduce((t, n) => t + n, 0)} unit="events" />
            <Columns
              labels={x.labels}
              series={byPlatform(x.platforms, (p) => x.events[p], "active")}
              label={week ? "Events per week" : "Events per day"}
              {...axis}
            />
            <Note>Everything the app sent, app opens included.</Note>
          </>
        ))}
      </HealthCard>
    </>
  );
};

// ---- Coming back ----

const WINDOW_LABEL = { 1: "Within 1 day", 7: "Within 7 days", 30: "Within 30 days" } as const;

export const ComingBackDetail = ({ scope: s, waiting }: SectionProps) => {
  let body: ReactNode = <Waiting size="list">{waiting}</Waiting>;
  let color: Category = "came-back";
  if (s && lunePending(s)) {
    color = "idle";
    body = <Empty size="body">{LUNE_SOON}</Empty>;
  } else if (s) {
    const weeks = cohortRows(s.report);
    if (!weeks.length) {
      color = "idle";
      body = <Empty size="body">No installs from {who(s)} since tracking began.</Empty>;
    } else {
      const split = s.platform === "all";
      // From 10 installs a cell reads "60% (12 of 20)": too long for three chips across a phone.
      const long = weeks.some((w) => w.installed >= 10);
      body = (
        <>
          <div className={long ? "use-coh-rows" : undefined}>
            <CohortChips
              titleHeader="Install week"
              detailHeader="Installs"
              rows={weeks.map((w) => ({
                id: w.install_week,
                title: `Week of ${shortDay(w.install_week)}`,
                detail: split
                  ? Object.entries(w.platforms)
                      .filter(([, n]) => n)
                      .map(([p, n]) => `${nf.format(n)} ${platformName(p)}`)
                      .join(" · ")
                  : plural(w.installed, "installs"),
                cells: w.windows.map((c) => ({ label: WINDOW_LABEL[c.days], state: c.state, n: c.n, of: c.of })),
              }))}
            />
          </div>
          <Note>
            Installed = the week the anonymous account was created, counting only phones that opened the app. "Within N days" = opened
            again on any day 1 to N after installing; "open" means that window is still running for some installs. Under 10 installs
            it shows counts, not percentages. Every install week since tracking began on 14 Sep 2026, whatever the window.
          </Note>
        </>
      );
    }
  }
  return (
    <HealthCard title="By install week" color={color} icon={<UsageIcon name="back" />} index={0} wide>
      {body}
    </HealthCard>
  );
};

// ---- Languages ----

export const LanguagesDetail = ({ scope: s, waiting }: SectionProps) => {
  const pending = !!s && lunePending(s);
  const rows = s && !pending ? languageTable(s.report) : [];
  const platforms = s ? [...new Set(rows.flatMap((r) => Object.keys(r.platforms)))].sort((a, b) => (a === "ios" ? -1 : b === "ios" ? 1 : a.localeCompare(b))) : [];
  const switches = s ? (actionRows(s.report).find((a) => a.event_name === "language_changed")?.details ?? []) : [];
  const soon = s ? luneOnlyNote(s) : null;

  let users: ReactNode = <Waiting size="chart">{waiting}</Waiting>;
  if (pending) users = <Empty size="body">{LUNE_SOON}</Empty>;
  else if (s && !rows.some((r) => r.users)) users = <Empty size="body">No {who(s)} used the app in {windowText(s.days)}.</Empty>;
  else if (s)
    users = (
      <>
        <HBars
          rows={rows.map((r) => ({ name: languageName(r.language), values: platforms.map((p) => r.platforms[p] ?? 0) }))}
          series={platforms.map((p) => ({ name: platformName(p), tone: p === "ios" ? "actions" : "idle" }))}
          label="Users per language"
          labelHeader="Language"
        />
        <Note>
          The app's language on each phone that used it. These can add up to more than the phones that used the app: someone who
          switched language counts in each.
        </Note>
      </>
    );

  let changes: ReactNode = <Waiting size="chart">{waiting}</Waiting>;
  if (s && !switches.length) changes = <Empty size="body">{soon ?? `No language switches in ${windowText(s.days)}.`}</Empty>;
  else if (s)
    changes = (
      <HBars
        rows={switches.map((d) => ({ name: `To ${languageName(d.detail)}`, values: [d.events] }))}
        series={[{ name: "Switches", tone: "actions" }]}
        label="Language switches, by the language picked"
        labelHeader="Switched"
      />
    );

  return (
    <>
      <HealthCard title="Users per language" color={pending ? "idle" : "actions"} icon={<UsageIcon name="globe" />} meta="users" index={0}>
        {users}
      </HealthCard>
      <HealthCard title="Language switches" color={s && !switches.length && soon ? "idle" : "actions"} icon={<UsageIcon name="globe" />} meta="times" index={1}>
        {changes}
      </HealthCard>
    </>
  );
};

// ---- Screens ----

export const ScreensDetail = ({ scope: s, waiting }: SectionProps) => {
  const rows = s ? screensTable(s.report) : [];
  const note = s ? luneOnlyNote(s) : null;
  const platforms = [...new Set(rows.flatMap((r) => Object.keys(r.platforms)))].sort((a, b) => (a === "ios" ? -1 : b === "ios" ? 1 : a.localeCompare(b)));
  const series = platforms.map((p) => ({ name: platformName(p), tone: (p === "ios" ? "screens" : "idle") as Category }));
  const empty = s && !rows.length ? <Empty size="body">{note ?? `No screen views from ${who(s)} in ${windowText(s.days)}.`}</Empty> : null;
  const color: Category = s && !rows.length && note ? "idle" : "screens";
  const wait = <Waiting size="chart">{waiting}</Waiting>;
  return (
    <>
      <HealthCard title="Views per screen" color={color} icon={<UsageIcon name="screens" />} meta="views" index={0}>
        {!s
          ? wait
          : empty ?? (
              <HBars
                rows={rows.map((r) => ({ name: screenName(r.screen), values: platforms.map((p) => r.platforms[p]?.views ?? 0) }))}
                series={series}
                label="Screen views"
                labelHeader="Screen"
              />
            )}
      </HealthCard>
      <HealthCard title="People per screen" color={color} icon={<UsageIcon name="screens" />} meta="users" index={1}>
        {!s
          ? wait
          : empty ?? (
              <>
                <HBars
                  rows={rows.map((r) => ({ name: screenName(r.screen), values: platforms.map((p) => r.platforms[p]?.users ?? 0) }))}
                  series={series}
                  label="Phones that saw each screen"
                  labelHeader="Screen"
                />
                <Note>Each phone counts once per screen. A phone that moved to the Lune design in this window counts once per design.</Note>
              </>
            )}
      </HealthCard>
    </>
  );
};

// ---- Actions ----

const splitText = (event: string, details: { detail: string; events: number }[]) => {
  const named = details.map((d) => ({ name: detailName(event, d.detail), events: d.events })).filter((d) => d.name);
  return named.map((d) => `${d.name} ${nf.format(d.events)}`).join(" · ");
};

export const ActionsDetail = ({ scope: s, waiting }: SectionProps) => {
  let body: ReactNode = <Waiting size="list">{waiting}</Waiting>;
  let color: Category = "actions";
  if (s && lunePending(s)) {
    color = "idle";
    body = <Empty size="body">{LUNE_SOON}</Empty>;
  } else if (s) {
    const rows = actionRows(s.report);
    body = rows.length ? (
      <>
        <DataTable
          caption="Actions and how often they happened"
          head={["Action", "Times"]}
          numeric={[1]}
          rows={rows.map((a) => {
            const split = splitText(a.event_name, a.details);
            return {
              key: a.event_name,
              cells: [
                <span key="n">
                  {actionName(a.event_name)}
                  {split && <span className="use-d">{split}</span>}
                </span>,
                nf.format(a.events),
              ],
            };
          })}
        />
        <Note>
          Every time it happened, not people. App opens are under Activity and screen views under Screens. Most of these arrive with
          the Lune update; older builds send only the first few.
        </Note>
      </>
    ) : (
      <Empty size="body">No actions from {who(s)} in {windowText(s.days)}.</Empty>
    );
  }
  return (
    <HealthCard title="Actions" color={color} icon={<UsageIcon name="check" />} meta="times" index={0} wide>
      {body}
    </HealthCard>
  );
};

// ---- Funnels ----

type FunnelProps = SectionProps & { index: number };

const stepTable = (rows: UsageStep[], steps: [string, string][]) => (
  <TableView
    caption="People and times per step"
    head={["Step", "People", "Times"]}
    numeric={[1, 2]}
    rows={steps.map(([key, name]) => {
      const t = stepTotals(rows, key);
      return { key, cells: [name, nf.format(t.users), nf.format(t.events)] };
    })}
  />
);

const OnboardingCard = ({ scope: s, waiting, index }: FunnelProps) => {
  let body: ReactNode = <Waiting size="list">{waiting}</Waiting>;
  let color: Category = "onboarding";
  if (s) {
    const rows = s.report.funnels.onboarding;
    const p = (step: string) => stepTotals(rows, step).users;
    const note = lunePending(s) ? LUNE_SOON : luneOnlyNote(s);
    if (!p("shown") && !p("finished") && note) {
      color = "idle";
      body = <Empty size="body">{note}</Empty>;
    } else {
      const steps: [string, string][] = [
        ["shown", "Onboarding shown"],
        ["finished", "Finished"],
        ["car_added", "with a car"],
        ["car_skipped", "car skipped"],
        ["reached_map", "Reached the map"],
      ];
      body = (
        <>
          <Ladder tone="onboarding" steps={steps.map(([k, name]) => ({ name, value: p(k), sub: k.startsWith("car_") }))} />
          {stepTable(rows, steps)}
          <Note>People who reached each step in {windowText(s.days)}. Reached the map = finished onboarding and saw the map the same day.</Note>
        </>
      );
    }
  }
  return (
    <HealthCard title="Onboarding" color={color} icon={<UsageIcon name="check" />} meta="people" index={index}>
      {body}
    </HealthCard>
  );
};

const TripCard = ({ scope: s, waiting, href, index }: FunnelProps) => {
  let body: ReactNode = <Waiting size="list">{waiting}</Waiting>;
  let color: Category = "trip";
  if (s && lunePending(s)) {
    color = "idle";
    body = <Empty size="body">{LUNE_SOON}</Empty>;
  } else if (s) {
    const rows = s.report.funnels.trip;
    const lune = luneOnlyNote(s);
    const all: [string, string][] = [
      ["opened", "Planner opened"],
      ["route_requested", "Route asked"],
      ["route_succeeded", "Route found"],
      ["saved", "Trip saved"],
      ["shared", "Trip shared"],
      ["navigation_launched", "Navigation opened"],
    ];
    // Opened, saved and shared are Lune events: before it they are left out, never drawn as 0.
    const steps = lune ? all.filter(([k]) => !["opened", "saved", "shared"].includes(k)) : all;
    body = (
      <>
        <Ladder tone="trip" steps={steps.map(([k, name]) => ({ name, value: stepTotals(rows, k).users }))} />
        {stepTable(rows, steps)}
        <Note>
          People who reached each step in {windowText(s.days)}.
          {lune && ` Planner opened, saved and shared: ${lune.charAt(0).toLowerCase()}${lune.slice(1)}`} Failures by reason are under{" "}
          <a href={href("routes")}>Routes</a>.
        </Note>
      </>
    );
  }
  return (
    <HealthCard title="Trip planner" color={color} icon={<UsageIcon name="trip" />} meta="people" index={index}>
      {body}
    </HealthCard>
  );
};

const NavigateCard = ({ scope: s, waiting, index }: FunnelProps) => {
  let body: ReactNode = <Waiting size="list">{waiting}</Waiting>;
  let color: Category = "navigate";
  if (s && lunePending(s)) {
    color = "idle";
    body = <Empty size="body">{LUNE_SOON}</Empty>;
  } else if (s) {
    const taps = tapRows(s.report);
    const opened = stepTotals(s.report.funnels.navigate.launched, "navigation_launched");
    const lune = luneOnlyNote(s);
    const tapped = taps.reduce((a, t) => a + t.taps, 0);
    const steps: LadderStep[] = [
      ...(lune ? [] : [{ name: "Navigate tapped", value: tapped }]),
      ...(lune ? [] : taps.map((t) => ({ name: warningName(t.warning), value: t.taps, sub: true, note: `${nf.format(t.went)} went` }))),
      { name: "Navigation opened", value: opened.events, users: opened.users },
    ];
    body = (
      <>
        <Ladder tone="navigate" steps={steps} />
        {!lune && (
          <TableView
            caption="Navigate taps by the warning they met"
            head={["Warning", "Taps", "Went"]}
            numeric={[1, 2]}
            rows={taps.map((t) => ({ key: t.warning, cells: [warningName(t.warning), nf.format(t.taps), nf.format(t.went)] }))}
          />
        )}
        <Note>
          {lune
            ? `Taps and their warnings: ${lune.charAt(0).toLowerCase()}${lune.slice(1)} `
            : "Went = navigation opened for the same charger within 2 minutes of the tap. "}
          Older builds open navigation without a tap event, so Navigation opened can be higher.
        </Note>
      </>
    );
  }
  return (
    <HealthCard title="Navigate from a charger" color={color} icon={<UsageIcon name="navigate" />} meta="times" index={index}>
      {body}
    </HealthCard>
  );
};

const ContributionsCard = ({ scope: s, waiting, index }: FunnelProps) => {
  let body: ReactNode = <Waiting size="list">{waiting}</Waiting>;
  if (s) {
    const c = s.report.funnels.contributions;
    const soon = luneUnsplitNote(s);
    const split = unsplitNote(s);
    const steps: LadderStep[] = soon
      ? [{ name: "Reviews posted", value: c.reviews_posted }]
      : [
          { name: "Review started", value: c.review_started },
          { name: "posted", value: c.reviews_posted, sub: true },
          { name: "Add a charger started", value: c.add_started },
          { name: "sent", value: c.submitted, sub: true },
        ];
    body = (
      <>
        <Ladder tone="contributions" steps={steps} />
        <Note>
          Posted = reviews saved in {windowText(s.days)}, from any app version.
          {soon && ` Started, and adding a charger: ${soon.charAt(0).toLowerCase()}${soon.slice(1)}`}
          {split && ` ${split}`}
        </Note>
      </>
    );
  }
  return (
    <HealthCard title="Contributions" color="contributions" icon={<UsageIcon name="pen" />} meta="times" index={index}>
      {body}
    </HealthCard>
  );
};

const PermissionsCard = ({ scope: s, waiting, index }: FunnelProps) => {
  let body: ReactNode = <Waiting size="list">{waiting}</Waiting>;
  if (s) {
    const kinds = permissionTable(s.report);
    const note = lunePending(s) ? LUNE_SOON : luneOnlyNote(s);
    const split = unsplitNote(s, { ui: false });
    if (!kinds.length) {
      body = <Empty size="body">{note ?? `No permission asked in ${windowText(s.days)}.`}</Empty>;
    } else {
      const steps: LadderStep[] = kinds.flatMap((k) => [
        { name: `${permissionName(k.kind)} asked`, value: k.asked },
        ...Object.entries(k.results)
          .sort(([, a], [, b]) => b - a)
          .map(([result, n]) => ({ name: RESULT_NAME[result] ?? result, value: n, sub: true })),
      ]);
      body = (
        <>
          <Ladder tone="idle" steps={steps} />
          <TableView
            caption="Permission answers by where they were asked"
            head={["Permission", "Asked from", "Answer", "Times"]}
            numeric={[3]}
            rows={kinds.flatMap((k) =>
              k.sources.map((src) => ({
                key: `${k.kind}-${src.source}-${src.result}`,
                cells: [permissionName(k.kind), PERMISSION_SOURCE[src.source] ?? src.source, RESULT_NAME[src.result] ?? src.result, nf.format(src.count)],
              })),
            )}
          />
          <Note>Each time the system asked. {split}</Note>
        </>
      );
    }
  }
  return (
    <HealthCard title="Permissions" color="idle" icon={<UsageIcon name="lock" />} meta="times" index={index}>
      {body}
    </HealthCard>
  );
};

export const FunnelsDetail = (props: SectionProps) => (
  <>
    <OnboardingCard {...props} index={0} />
    <TripCard {...props} index={1} />
    <NavigateCard {...props} index={2} />
    <ContributionsCard {...props} index={3} />
    <PermissionsCard {...props} index={4} />
  </>
);

// ---- Cars (missing names; the catalog is its own card) ----

export const MissingCarsCard = ({ scope: s, waiting }: SectionProps) => {
  let body: ReactNode = <Waiting size="list">{waiting}</Waiting>;
  let color: Category = "cars";
  if (s) {
    const mc = s.report.missing_cars;
    const soon = luneUnsplitNote(s);
    if (!mc.total_searches) {
      if (soon) color = "idle";
      body = <Empty size="body">{soon ?? `No car searches in ${windowText(s.days)}.`}</Empty>;
    } else {
      const { percent, counts } = countOrPercentParts(mc.no_result, mc.total_searches);
      body = (
        <>
          <Stats
            items={[
              { value: percent ?? counts, label: percent ? `${counts} searches found nothing` : "searches found nothing" },
              { value: nf.format(mc.queries.length), label: mc.queries.length === 1 ? "name to look at" : "names to look at" },
            ]}
          />
          {mc.queries.length > 0 ? (
            <DataTable
              caption="Car names searched that the catalog doesn't have"
              head={["Searched for", "Times"]}
              numeric={[1]}
              rows={mc.queries.map((q) => ({ key: q.query, cells: [<bdi key="q">{q.query}</bdi>, nf.format(q.searches)] }))}
            />
          ) : (
            <Empty>No names were typed in the searches that found nothing.</Empty>
          )}
          <Note>Shown only: adding a car stays a database job. Names are lowercased and trimmed; the top 50.</Note>
        </>
      );
    }
  }
  return (
    // Wide: the catalog under it spans the row, so a half card would sit alone.
    <HealthCard title="Cars not in the catalog" color={color} icon={<UsageIcon name="car" />} meta="searches" index={0} wide>
      {body}
    </HealthCard>
  );
};

// ---- Routes ----

const seconds = (ms: number | null) => (ms == null ? "—" : `${(ms / 1000).toFixed(1)} s`);

export const RoutesDetail = ({ scope: s, waiting }: SectionProps) => {
  const r = s?.report.routes;
  const failed = r ? r.failed.reduce((a, f) => a + f.count, 0) : 0;
  const asked = r ? r.found + failed : 0;
  const wait = <Waiting size="chart">{waiting}</Waiting>;
  return (
    <>
      <HealthCard title="Route answers" color="routes" icon={<UsageIcon name="route" />} meta="time to answer" index={0}>
        {!s || !r ? (
          wait
        ) : !asked ? (
          <Empty size="body">No routes asked in {windowText(s.days)}.</Empty>
        ) : (
          <>
            <Stats
              items={[
                { value: seconds(r.p50_ms), label: "typical answer" },
                { value: seconds(r.p95_ms), label: "slowest 5%" },
              ]}
            />
            <Note>
              {countOrPercent(r.found, asked)} routes found, {nf.format(failed)} failed. Times are for found routes. The clock keeps
              running while the app is in the background, so the slowest are mostly people leaving mid-request.
            </Note>
          </>
        )}
      </HealthCard>
      <HealthCard title="Failures" color="routes" icon={<UsageIcon name="route" />} meta="by reason" index={1}>
        {!s || !r ? (
          wait
        ) : !failed ? (
          <Empty size="body">No route failed in {windowText(s.days)}.</Empty>
        ) : (
          <HBars
            rows={r.failed.map((f) => ({ name: failureName(f.reason), values: [f.count] }))}
            series={[{ name: "Failures", tone: "routes" }]}
            label="Route failures by reason"
            labelHeader="Reason"
          />
        )}
      </HealthCard>
    </>
  );
};

// ---- Android Auto ----

export const AndroidAutoDetail = ({ scope: s, waiting }: SectionProps) => {
  let body: ReactNode = <Waiting>{waiting}</Waiting>;
  if (s) {
    const aa = s.report.android_auto;
    body = aa.sessions ? (
      <Stats
        items={[
          { value: nf.format(aa.sessions), label: "sessions" },
          { value: `${(aa.minutes / aa.sessions).toFixed(1)} min`, label: "average length" },
          { value: nf.format(aa.chargers_opened), label: "chargers opened" },
          { value: nf.format(aa.navigations), label: "navigations" },
        ]}
      />
    ) : (
      <Empty size="body">No car events yet. They arrive with the next native build: sessions, their length, chargers opened and navigation started in the car.</Empty>
    );
  }
  return (
    <HealthCard title="Android Auto" color="idle" icon={<UsageIcon name="auto" />} index={0} wide>
      {body}
    </HealthCard>
  );
};
