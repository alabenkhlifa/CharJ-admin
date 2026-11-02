import type { ReactNode } from "react";
import { useAdminUsers } from "../data/admin-users";
import {
  activitySeries,
  actionRows,
  cohortRows,
  languageTable,
  latestCohort,
  screensTable,
} from "../data/usage-report";
import { countOrPercentParts, plural, shortDay } from "../lib/health-format";
import { Bars } from "../ui/bars";
import { tone as baseTone, type Category } from "../ui/category";
import type { SquareColor } from "../ui/category-square";
import { Empty } from "../ui/empty";
import { HealthCard } from "../ui/health-card";
import { HeroValue } from "../ui/hero-value";
import { Ladder } from "../ui/ladder";
import { Note, Stats, UsageIcon, Waiting } from "./usage-bits";
import { actionName, languageName, screenName, type UsageSection } from "./usage-labels";
import {
  funnelSummaries,
  LUNE_SOON,
  luneOnlyNote,
  lunePending,
  luneUnsplitNote,
  unsplitNote,
  who,
  windowText,
  type FunnelKey,
  type UsageScope,
} from "./usage-scope";

// The Usage overview: one card per category, each a link to its drill-in
// (?section=). Previews hold no controls, so the whole card is the link.

const nf = new Intl.NumberFormat("en-US");
const SHOW_ALL = "Show all";

type CardProps = {
  scope: UsageScope | null;
  /** "Loading…" or "Couldn't load." while there is no report. */
  waiting: string;
  href: (section: UsageSection) => string;
  index: number;
  /** Span both columns (a category alone in its group). */
  wide?: boolean;
};

type ShellProps = {
  section: UsageSection;
  title: string;
  color: SquareColor;
  icon: ReactNode;
  href: (section: UsageSection) => string;
  index: number;
  wide?: boolean;
  children: ReactNode;
};

const Preview = ({ section, title, color, icon, href, index, wide, children }: ShellProps) => (
  <HealthCard title={title} color={color} icon={icon} meta={SHOW_ALL} href={href(section)} id={`usage-${section}`} index={index} wide={wide}>
    {children}
  </HealthCard>
);

const seconds = (ms: number | null) => (ms == null ? "—" : `${(ms / 1000).toFixed(1)} s`);

export const ActivityPreview = ({ scope: s, waiting, href, index, wide }: CardProps) => {
  let body: ReactNode = <Waiting>{waiting}</Waiting>;
  let color: Category = "active";
  if (s && lunePending(s)) {
    color = "idle";
    body = <Empty size="body">{LUNE_SOON}</Empty>;
  } else if (s) {
    const from = s.ui === "lune" ? s.firstLune : null;
    const a = activitySeries(s.report, { from });
    if (!a.totalActive.some(Boolean)) {
      body = <Empty size="body">No {who(s)} opened the app in {windowText(s.days)}.</Empty>;
    } else {
      const week = a.grain === "week";
      body = (
        <>
          <HeroValue value={a.avgActive} decimals={1} unit="phones a day" />
          <Bars
            data={a.labels.map((key, i) => ({ key, value: a.totalActive[i] }))}
            tone="active"
            axis={{ start: shortDay(a.labels[0]), end: week ? "This week" : "Today" }}
            label={`Phones that opened the app ${week ? "a day, averaged by week" : "per day"}, ${windowText(s.days)}: ${a.avgActive.toLocaleString("en-US")} a day on average, peak ${nf.format(Math.max(...a.totalActive))}.`}
          />
          {from && <Note>Starts on {shortDay(from)}, the first day with the Lune design.</Note>}
        </>
      );
    }
  }
  return (
    <Preview section="activity" title="Activity" color={color} icon={<UsageIcon name="pulse" />} href={href} index={index} wide={wide}>
      {body}
    </Preview>
  );
};

export const ComingBackPreview = ({ scope: s, waiting, href, index, wide }: CardProps) => {
  let body: ReactNode = <Waiting>{waiting}</Waiting>;
  let color: Category = "came-back";
  if (s && lunePending(s)) {
    color = "idle";
    body = <Empty size="body">{LUNE_SOON}</Empty>;
  } else if (s) {
    const latest = latestCohort(cohortRows(s.report));
    if (!latest) {
      color = "idle";
      body = (
        <>
          <HeroValue value="—" />
          <Empty size="body">Fills in once an install week has had its 7 days to come back.</Empty>
        </>
      );
    } else {
      const w = latest.windows[1];
      const { percent, counts } = countOrPercentParts(w.n, w.of);
      const week = `Installs from the week of ${shortDay(latest.install_week)} that opened the app again within 7 days.`;
      body = percent ? (
        <>
          <HeroValue value={percent} unit={counts} />
          <Empty size="body">{week}</Empty>
        </>
      ) : (
        <>
          <HeroValue value={w.n} unit={`of ${nf.format(w.of)}`} />
          <Empty size="body">{week} Counts only, since under 10 installs is too few for a percentage.</Empty>
        </>
      );
    }
  }
  return (
    <Preview section="coming-back" title="Coming back" color={color} icon={<UsageIcon name="back" />} href={href} index={index} wide={wide}>
      {body}
    </Preview>
  );
};

export const LanguagesPreview = ({ scope: s, waiting, href, index, wide }: CardProps) => {
  let body: ReactNode = <Waiting>{waiting}</Waiting>;
  let color: Category = "actions";
  if (s && lunePending(s)) {
    color = "idle";
    body = <Empty size="body">{LUNE_SOON}</Empty>;
  } else if (s) {
    const rows = languageTable(s.report);
    if (!rows.some((r) => r.users)) {
      body = <Empty size="body">No {who(s)} used the app in {windowText(s.days)}.</Empty>;
    } else {
      const first = rows.slice(0, 3);
      const rest = rows.slice(3).filter((r) => r.users);
      // language_changed is a Lune event: shown once there are any, never as a 0 before.
      const switches = actionRows(s.report).find((a) => a.event_name === "language_changed")?.events ?? 0;
      body = (
        <>
          <p className="use-cap">Users per language</p>
          <Stats items={first.map((r) => ({ value: nf.format(r.users), label: languageName(r.language) }))} />
          {rest.length > 0 && <Note>Also {rest.map((r) => `${languageName(r.language)} ${nf.format(r.users)}`).join(" · ")}.</Note>}
          {switches > 0 && <Note>{switches === 1 ? "1 language switch" : `${nf.format(switches)} language switches`} in {windowText(s.days)}.</Note>}
        </>
      );
    }
  }
  return (
    <Preview section="languages" title="Languages" color={color} icon={<UsageIcon name="globe" />} href={href} index={index} wide={wide}>
      {body}
    </Preview>
  );
};

export const ScreensPreview = ({ scope: s, waiting, href, index, wide }: CardProps) => {
  let body: ReactNode = <Waiting>{waiting}</Waiting>;
  let color: Category = "screens";
  if (s) {
    const rows = screensTable(s.report);
    const note = luneOnlyNote(s);
    if (!rows.length) {
      if (note) color = "idle";
      body = <Empty size="body">{note ?? `No screen views from ${who(s)} in ${windowText(s.days)}.`}</Empty>;
    } else {
      body = (
        <>
          <HeroValue value={rows.reduce((a, r) => a + r.views, 0)} unit="views" />
          <Ladder tone="screens" steps={rows.slice(0, 3).map((r) => ({ name: screenName(r.screen), value: r.views, users: r.users }))} />
        </>
      );
    }
  }
  return (
    <Preview section="screens" title="Screens" color={color} icon={<UsageIcon name="screens" />} href={href} index={index} wide={wide}>
      {body}
    </Preview>
  );
};

export const ActionsPreview = ({ scope: s, waiting, href, index, wide }: CardProps) => {
  let body: ReactNode = <Waiting>{waiting}</Waiting>;
  let color: Category = "actions";
  if (s && lunePending(s)) {
    color = "idle";
    body = <Empty size="body">{LUNE_SOON}</Empty>;
  } else if (s) {
    const rows = actionRows(s.report);
    if (!rows.length) {
      body = <Empty size="body">No actions from {who(s)} in {windowText(s.days)}.</Empty>;
    } else {
      body = (
        <>
          <HeroValue value={rows.reduce((a, r) => a + r.events, 0)} unit="actions" />
          <Ladder tone="actions" steps={rows.slice(0, 3).map((r) => ({ name: actionName(r.event_name), value: r.events }))} />
        </>
      );
    }
  }
  return (
    <Preview section="actions" title="Actions" color={color} icon={<UsageIcon name="check" />} href={href} index={index} wide={wide}>
      {body}
    </Preview>
  );
};

const FUNNEL_TONE: Record<FunnelKey, Category> = {
  onboarding: "onboarding",
  trip: "trip",
  navigate: "navigate",
  contributions: "contributions",
  permissions: "idle",
};

export const FunnelsPreview = ({ scope: s, waiting, href, index, wide }: CardProps) => (
  <Preview section="funnels" title="Funnels" color="funnels" icon={<UsageIcon name="funnel" />} href={href} index={index} wide={wide}>
    {s ? (
      <ul className="use-lines">
        {funnelSummaries(s).map((f) => (
          <li key={f.key}>
            <span className="use-lines-name">
              <i style={{ background: baseTone(FUNNEL_TONE[f.key]) }} aria-hidden="true" />
              {f.name}
            </span>
            <span className="use-lines-v">{f.text}</span>
          </li>
        ))}
      </ul>
    ) : (
      <Waiting>{waiting}</Waiting>
    )}
  </Preview>
);

export const CarsPreview = ({ scope: s, waiting, href, index, wide }: CardProps) => {
  let body: ReactNode = <Waiting>{waiting}</Waiting>;
  let color: Category = "cars";
  if (s) {
    const mc = s.report.missing_cars;
    const soon = luneUnsplitNote(s);
    const split = unsplitNote(s);
    if (!mc.total_searches) {
      if (soon) color = "idle";
      body = <Empty size="body">{soon ?? `No car searches in ${windowText(s.days)}.`} The catalog is inside.</Empty>;
    } else {
      const { percent, counts } = countOrPercentParts(mc.no_result, mc.total_searches);
      body = (
        <>
          <HeroValue value={percent ?? counts} unit={percent ? `${counts} found nothing` : "searches found nothing"} />
          <Empty size="body">
            {plural(mc.queries.length, "names")} to look at. The catalog is inside.{split && ` ${split}`}
          </Empty>
        </>
      );
    }
  }
  return (
    <Preview section="cars" title="Cars" color={color} icon={<UsageIcon name="car" />} href={href} index={index} wide={wide}>
      {body}
    </Preview>
  );
};

export const RoutesPreview = ({ scope: s, waiting, href, index, wide }: CardProps) => {
  let body: ReactNode = <Waiting>{waiting}</Waiting>;
  if (s) {
    const r = s.report.routes;
    const failed = r.failed.reduce((a, f) => a + f.count, 0);
    const split = unsplitNote(s);
    body =
      r.found + failed === 0 ? (
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
            {nf.format(r.found)} found, {nf.format(failed)} failed.{split && ` ${split}`}
          </Note>
        </>
      );
  }
  return (
    <Preview section="routes" title="Routes" color="routes" icon={<UsageIcon name="route" />} href={href} index={index} wide={wide}>
      {body}
    </Preview>
  );
};

export const AndroidAutoPreview = ({ scope: s, waiting, href, index, wide }: CardProps) => {
  let body: ReactNode = <Waiting>{waiting}</Waiting>;
  if (s) {
    const aa = s.report.android_auto;
    if (!aa.sessions) {
      body = <Empty size="body">No car events yet. They arrive with the next native build.</Empty>;
    } else {
      body = (
        <Stats
          items={[
            { value: nf.format(aa.sessions), label: "sessions" },
            { value: `${(aa.minutes / aa.sessions).toFixed(1)} min`, label: "average length" },
          ]}
        />
      );
    }
  }
  return (
    <Preview section="android-auto" title="Android Auto" color="idle" icon={<UsageIcon name="auto" />} href={href} index={index} wide={wide}>
      {body}
    </Preview>
  );
};

/** Its own source (admin-users): only the total, one row asked for. */
export const UsersPreview = ({ href, index, wide }: Omit<CardProps, "scope" | "waiting">) => {
  const users = useAdminUsers(1, 1, "all", "");
  let body: ReactNode;
  if (users.loading) body = <Waiting>Loading…</Waiting>;
  else if (users.error) body = <Waiting>Couldn't load.</Waiting>;
  else
    body = (
      <>
        <HeroValue value={users.total} unit={users.total === 1 ? "session" : "sessions"} />
        <Empty size="body">Every anonymous session with its device, car and visits.</Empty>
      </>
    );
  return (
    <Preview section="users" title="Users" color="active" icon={<UsageIcon name="person" />} href={href} index={index} wide={wide}>
      {body}
    </Preview>
  );
};
