import { useState, type ReactNode } from "react";
import type { QueueState } from "../data/queue";
import { QUEUE_LINKS, queueCount, timeAgo, type QueueKey } from "../data/queue-report";
import { useUsage } from "../data/usage";
import {
  activeGoal,
  languageCounts,
  USAGE_ENVIRONMENTS,
  versionRows,
  type SummaryReport,
  type UsageEnvironment,
} from "../data/usage-report";
import {
  countOrPercentParts,
  highlight,
  plural,
  ringProgress,
  ringSegments,
  shortDay,
} from "../lib/health-format";
import { isTracked, untrackedNote, untrackedRuns } from "../lib/tracking";
import { buildHash } from "../lib/use-route";
import { Bars } from "../ui/bars";
import { Bubble } from "../ui/bubble";
import type { Category } from "../ui/category";
import { CategorySquare } from "../ui/category-square";
import { Empty } from "../ui/empty";
import { HealthCard } from "../ui/health-card";
import { HeroValue } from "../ui/hero-value";
import { LargeTitle } from "../ui/large-title";
import { ListRow, ListRows } from "../ui/list-row";
import { scrollToId } from "../ui/motion";
import { Pill } from "../ui/pill";
import { Rings, type Ring } from "../ui/rings";
import { Segmented } from "../ui/segmented";
import "./summary.css";

// Home: is the app healthy, and what needs Ala (DESIGN.md, docs/mockups/admin-dashboard.html).
// Usage numbers: admin-usage (view=summary, ?env=). The queue comes from App
// (useQueue), which also feeds the Community badge.

type Props = {
  env: UsageEnvironment;
  onEnv: (env: UsageEnvironment) => void;
  queue: QueueState;
};

const ENV_LABEL: Record<UsageEnvironment, string> = {
  production: "Production",
  preview: "Preview",
  development: "Development",
};
const ENV_OPTIONS = USAGE_ENVIRONMENTS.map((v) => ({ v, l: ENV_LABEL[v] }));
const LANGUAGE_NAME: Record<string, string> = { fr: "French", ar: "Arabic", en: "English" };

const nf = new Intl.NumberFormat("en-US");
const tunis = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "Africa/Tunis" });
const longDay = tunis({ weekday: "long", day: "numeric", month: "long" });
const weekday = tunis({ weekday: "long" });

const Icon = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const ICON = {
  rings: (
    <Icon>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  ),
  bell: (
    <Icon>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10 21h4" />
    </Icon>
  ),
  pulse: (
    <Icon>
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </Icon>
  ),
  back: (
    <Icon>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
    </Icon>
  ),
  phone: (
    <Icon>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </Icon>
  ),
  alert: (
    <Icon>
      <path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </Icon>
  ),
};

const NEEDS: { key: QueueKey; title: string; tone: Category }[] = [
  { key: "feedback", title: "Open feedback", tone: "needs-you" },
  { key: "couldNotCharge", title: "Couldn't charge", tone: "alarm" },
  { key: "submissions", title: "Charger submissions", tone: "screens" },
  { key: "reports", title: "Review reports", tone: "actions" },
];

const RetryLine = ({ children, onRetry }: { children: ReactNode; onRetry: () => void }) => (
  <p className="sum-retry">
    {children}{" "}
    <button type="button" onClick={onRetry}>
      Try again
    </button>
  </p>
);

/** What waits in Community; each row opens its filtered tab. */
const NeedsYou = ({ queue }: { queue: QueueState }) => {
  const { data, loading, loadedAt } = queue;
  const failed = data ? Object.keys(data.errors).length > 0 : !loading;
  const meta = data?.total != null ? `${nf.format(data.total)} waiting` : undefined;
  return (
    <HealthCard title="Needs you" color="needs-you" icon={ICON.bell} meta={meta} id="card-needs" index={2}>
      <ListRows label="Waiting in Community">
        {NEEDS.map(({ key, title, tone }) => {
          const n = data ? queueCount(data, key) : null;
          const newest = n ? data?.[key]?.newest[0] : undefined;
          const ago = newest ? timeAgo(newest.at, loadedAt ?? Date.parse(newest.at)) : "";
          let status = "";
          if (n === null) status = loading && !data ? "Loading…" : "Couldn't load";
          else if (n === 0) status = "Nothing waiting";
          // Drivers' own words and charger names may be Arabic or French: <bdi> keeps them in their direction.
          const detail = newest ? (
            <>
              <bdi>{newest.text}</bdi>
              {ago && ` · ${ago}`}
            </>
          ) : (
            status
          );
          const said = newest ? [newest.text, ago].filter(Boolean).join(", ") : status;
          const label = n ? `${title}: ${nf.format(n)} waiting.${newest ? ` Newest: ${said}` : ""}` : `${title}: ${said}`;
          return (
            <ListRow
              key={key}
              title={title}
              detail={detail}
              href={QUEUE_LINKS[key]}
              label={label}
              trailing={n === null ? undefined : <Bubble n={n} tone={tone} />}
            />
          );
        })}
      </ListRows>
      {failed && (
        <RetryLine onRetry={queue.refresh}>
          {queue.error ?? "Some counts couldn't load, so they are left out rather than shown as zero."}
        </RetryLine>
      )}
    </HealthCard>
  );
};

const TodayRings = ({ report, queue }: { report: SummaryReport; queue: QueueState }) => {
  const today = report.today.active;
  const goal = activeGoal(report.avg7);
  const cohort = report.cohort && report.cohort.installed > 0 ? report.cohort : null;
  const waiting = queue.data?.total ?? null;
  const rings: Ring[] = [
    {
      id: "active",
      label: "Active",
      value: today,
      unit: `goal ${nf.format(goal)} (7-day avg)`,
      progress: ringProgress(today, goal),
      segments: ringSegments(goal),
      tone: "active",
      onPick: () => scrollToId("card-active"),
    },
    {
      id: "back",
      label: "Came back",
      value: cohort ? cohort.back_7d : "—",
      unit: cohort ? `of ${nf.format(cohort.installed)} in 7 days` : "no full week yet",
      progress: cohort ? ringProgress(cohort.back_7d, cohort.installed) : 0,
      segments: cohort ? ringSegments(cohort.installed) : undefined,
      tone: "came-back",
      onPick: () => scrollToId("card-back"),
    },
    {
      id: "queue",
      label: "Queue clear",
      value: waiting ?? "—",
      unit: waiting === null ? (queue.loading ? "loading" : "couldn't load") : waiting ? "waiting" : "nothing waiting",
      // Closes only when nothing waits; unknown is not clear.
      progress: waiting === 0 ? 1 : 0,
      tone: "queue",
      onPick: () => scrollToId("card-needs"),
    },
  ];
  return <Rings rings={rings} />;
};

const LOADING = "Loading…";

/** A usage card's body while the report loads or failed: no numbers, about the loaded height. */
const Waiting = ({ size, children }: { size: "rings" | "active" | "back" | "versions"; children: ReactNode }) => (
  <div className={`sum-wait sum-wait-${size}`} aria-busy={children === LOADING}>
    {typeof children === "string" ? <Empty size="body">{children}</Empty> : children}
  </div>
);

const ActiveCard = ({ report, waiting, href }: { report: SummaryReport | null; waiting: string; href: string }) => {
  if (!report) {
    return (
      <HealthCard title="Active phones" color="active" icon={ICON.pulse} meta="30 days" href={href} id="card-active" index={1}>
        <Waiting size="active">{waiting}</Waiting>
      </HealthCard>
    );
  }
  // A day nobody measured is hatched, never a 0; real zero days stay stubs.
  const daily = report.daily.map((d) => ({ key: d.day, value: isTracked(d.day) ? d.active : null }));
  const peak = Math.max(0, ...daily.map((d) => d.value ?? 0));
  const missing = untrackedNote(report.daily.map((d) => d.day));
  const hatched = untrackedRuns(report.daily.map((d) => d.day)).map((r) => (r.from === r.to ? shortDay(r.from) : `${shortDay(r.from)} – ${shortDay(r.to)}`));
  const avg = report.avg7.toLocaleString("en-US", { maximumFractionDigits: 1 });
  return (
    <HealthCard title="Active phones" color="active" icon={ICON.pulse} meta="30 days" href={href} id="card-active" index={1}>
      <HeroValue value={report.avg7} decimals={1} unit="avg / day, last 7 days" />
      {/* No tooltip or table here: the whole card links to Usage, where the full chart has both. */}
      <Bars
        data={daily}
        tone="active"
        axis={report.daily.length ? { start: shortDay(report.daily[0].day), end: "Today" } : undefined}
        label={`Phones that opened the app per day, last ${report.daily.length} days: ${plural(report.today.active, "phones")} today, ${avg} a day over the last 7 days, peak ${nf.format(peak)}.${missing ? ` ${missing}` : ""}`}
      />
      {hatched.length > 0 && <Empty>Hatched days weren't tracked ({hatched.join(", ")}).</Empty>}
    </HealthCard>
  );
};

const CameBackCard = ({ report, waiting, href }: { report: SummaryReport | null; waiting: string; href: string }) => {
  const cohort = report?.cohort && report.cohort.installed > 0 ? report.cohort : null;
  // The square goes Idle Grey while no install week has finished its 7 days (DESIGN.md empty states).
  const color = report && !cohort ? "idle" : "came-back";
  let body: ReactNode;
  if (!report) {
    body = <Waiting size="back">{waiting}</Waiting>;
  } else if (!cohort) {
    body = (
      <>
        <HeroValue value="—" />
        <Empty size="body">Fills in once an install week has had its 7 days to come back.</Empty>
      </>
    );
  } else {
    const { percent, counts } = countOrPercentParts(cohort.back_7d, cohort.installed);
    const week = `Installs from the week of ${shortDay(cohort.install_week)} that opened the app again within 7 days.`;
    body = percent ? (
      <>
        <HeroValue value={percent} unit={counts} />
        <Empty size="body">{week}</Empty>
      </>
    ) : (
      <>
        <HeroValue value={cohort.back_7d} unit={`of ${nf.format(cohort.installed)}`} />
        <Empty size="body">{week} Counts only, since under 10 installs is too few for a percentage.</Empty>
      </>
    );
  }
  return (
    <HealthCard title="Came back" color={color} icon={ICON.back} meta="7 days" href={href} id="card-back" index={3}>
      {body}
    </HealthCard>
  );
};

const VersionsCard = ({ report, waiting }: { report: SummaryReport | null; waiting: string }) => {
  const { rows, versions } = versionRows(report?.versions ?? []);
  let body: ReactNode;
  if (!report) {
    body = <Waiting size="versions">{waiting}</Waiting>;
  } else if (!rows.length) {
    body = <Empty size="body">No one opened the app in the last 30 days.</Empty>;
  } else {
    body = (
      <>
        <ul className="sum-vers">
          {rows.map((r) => (
            <li key={r.key}>
              <span>
                {r.name}
                <Pill>{r.ui}</Pill>
              </span>
              <em>{plural(r.users, "users")}</em>
            </li>
          ))}
        </ul>
        <p className="sum-lang">
          <span>Users per language</span>
          <em>
            {languageCounts(report.languages).map((l, i) => (
              <span key={l.language}>
                {i > 0 && " · "}
                <abbr title={LANGUAGE_NAME[l.language] ?? l.language}>{l.label}</abbr> {nf.format(l.users)}
              </span>
            ))}
          </em>
        </p>
      </>
    );
  }
  return (
    <HealthCard
      title="Versions in use"
      color="actions"
      icon={ICON.phone}
      meta={rows.length ? plural(versions, "versions") : undefined}
      index={4}
    >
      {body}
    </HealthCard>
  );
};

const Dropped = ({ n }: { n: number }) => (
  <div className="sum-warn" role="status">
    <CategorySquare color="alarm" icon={ICON.alert} />
    <p>
      <b>{plural(n, "events")} dropped</b> in the last 7 days: the ingestion cap was hit, so this week's numbers
      run low.
    </p>
  </div>
);

export const SummaryPage = ({ env, onEnv, queue }: Props) => {
  const usage = useUsage("summary", 30, env);
  // Null while loading another environment or retrying: never the previous numbers.
  const report = usage.data;
  const waiting = usage.error ? "Couldn't load." : LOADING;
  const [openedAt] = useState(() => Date.now());
  // Each card opens its own Usage drill-in, for the same data.
  const activityHref = buildHash("usage", { env, section: "activity" });
  const comingBackHref = buildHash("usage", { env, section: "coming-back" });

  const asOf = report ? Date.parse(report.generated_at) : openedAt;
  const sentence = report
    ? highlight(report.today.active, report.same_day_last_week.active, "active phones", weekday.format(asOf))
    : null;

  return (
    <div className="sum">
      <LargeTitle title="Summary" subtitle={longDay.format(asOf)} />
      <p className="sum-hl">{sentence && `${sentence}.`}</p>
      <div className="sum-env">
        <Segmented label="Data" value={env} options={ENV_OPTIONS} onChange={onEnv} />
      </div>
      {report && report.dropped_7d > 0 && <Dropped n={report.dropped_7d} />}
      {/* The card shells stay mounted while the report loads, so the page keeps its shape. */}
      <div className="sum-grid">
        <HealthCard title="Today" color="rings" icon={ICON.rings} meta={env} index={0}>
          {report ? (
            // Keyed by environment so the rings refill when the data switches.
            <TodayRings key={env} report={report} queue={queue} />
          ) : (
            <Waiting size="rings">
              {usage.error ? (
                <RetryLine onRetry={usage.refresh}>Couldn't load today's numbers. {usage.error}</RetryLine>
              ) : (
                LOADING
              )}
            </Waiting>
          )}
        </HealthCard>
        <NeedsYou queue={queue} />
        <ActiveCard report={report} waiting={waiting} href={activityHref} />
        <CameBackCard report={report} waiting={waiting} href={comingBackHref} />
        <VersionsCard report={report} waiting={waiting} />
      </div>
    </div>
  );
};
