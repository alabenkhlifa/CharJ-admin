import { useEffect, useMemo, type ReactNode } from "react";
import { useUsage } from "../data/usage";
import {
  parseUsageDays,
  parseUsageEnvironment,
  parseUsagePlatform,
  parseUsageUi,
  USAGE_ENVIRONMENTS,
  type UsageEnvironment,
} from "../data/usage-report";
import { buildHash, type RouteParams } from "../lib/use-route";
import { LargeTitle } from "../ui/large-title";
import { Segmented } from "../ui/segmented";
import { LOADING, RetryLine } from "./usage-bits";
import { CatalogCard } from "./usage-catalog";
import {
  DAYS_OPTIONS,
  ENV_LABEL,
  parseSection,
  PLATFORM_OPTIONS,
  SECTION_FILTERS,
  SECTION_TITLE,
  UI_OPTIONS,
  type FilterKey,
  type UsageSection,
} from "./usage-labels";
import {
  ActionsPreview,
  ActivityPreview,
  AndroidAutoPreview,
  CarsPreview,
  ComingBackPreview,
  FunnelsPreview,
  LanguagesPreview,
  RoutesPreview,
  ScreensPreview,
  UsersPreview,
} from "./usage-overview";
import { makeScope, scopeLine, type UsageFilters } from "./usage-scope";
import {
  ActionsDetail,
  ActivityDetail,
  AndroidAutoDetail,
  ComingBackDetail,
  FunnelsDetail,
  LanguagesDetail,
  MissingCarsCard,
  RoutesDetail,
  ScreensDetail,
  type SectionProps,
} from "./usage-sections";
import { UsersSection } from "./usage-users";
import "./usage.css";

// Usage: how people use the app, as Health categories (DESIGN.md, the mock's
// Usage screen). The overview has one card per category; each opens its
// drill-in (?section=). Filters live in the URL: ?days= refetches from
// admin-usage (view=usage) like ?env=; ?platform= and ?ui= filter the report
// in the browser. Users and the car catalog (the old Users and Vehicles
// pages) are sections here too; ?tab=users / ?tab=catalog still land on them.

type Props = {
  params: URLSearchParams;
  onParams: (patch: RouteParams) => void;
};

const ENV_OPTIONS = USAGE_ENVIRONMENTS.map((v) => ({ v, l: ENV_LABEL[v] }));

const Filters = ({ keys, f, onParams }: { keys: FilterKey[]; f: UsageFilters; onParams: Props["onParams"] }) =>
  keys.length ? (
    <div className="use-filters">
      {keys.includes("days") && <Segmented label="Window" value={f.days} options={DAYS_OPTIONS} onChange={(v) => onParams({ days: String(v) })} />}
      {keys.includes("platform") && <Segmented label="Platform" value={f.platform} options={PLATFORM_OPTIONS} onChange={(v) => onParams({ platform: v })} />}
      {keys.includes("ui") && <Segmented label="App design" value={f.ui} options={UI_OPTIONS} onChange={(v) => onParams({ ui: v })} />}
      {keys.includes("env") && <Segmented<UsageEnvironment> label="Data" value={f.env} options={ENV_OPTIONS} onChange={(v) => onParams({ env: v })} />}
    </div>
  ) : null;

const Group = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="use-group" aria-label={title}>
    <h2 className="use-sec">{title}</h2>
    <div className="use-grid">{children}</div>
  </section>
);

const Back = ({ href }: { href: string }) => (
  <a className="use-back" href={href}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 6l-6 6 6 6" />
    </svg>
    Usage
  </a>
);

const Foot = () => (
  <p className="use-foot">
    Days are Tunis days, and internal test phones are left out. Any design counts each phone once, even one that moved to Lune
    inside the window. No label is the builds from before the design label existed; they run the classic look.
  </p>
);

const DETAIL: Record<Exclude<UsageSection, "users" | "cars">, (p: SectionProps) => ReactNode> = {
  activity: ActivityDetail,
  "coming-back": ComingBackDetail,
  languages: LanguagesDetail,
  screens: ScreensDetail,
  actions: ActionsDetail,
  funnels: FunnelsDetail,
  routes: RoutesDetail,
  "android-auto": AndroidAutoDetail,
};

export const UsagePage = ({ params, onParams }: Props) => {
  const section = parseSection(params.get("section"), params.get("tab"));
  const focusCatalog = !params.get("section") && params.get("tab") === "catalog";
  const days = parseUsageDays(params.get("days"));
  const platform = parseUsagePlatform(params.get("platform"));
  const ui = parseUsageUi(params.get("ui"));
  const env = parseUsageEnvironment(params.get("env"));
  const keys = SECTION_FILTERS[section ?? "overview"];
  const filters = useMemo<UsageFilters>(() => ({ days, platform, ui, env }), [days, platform, ui, env]);
  // A view reads only the filters it shows: a platform or design kept in the
  // URL from the overview doesn't narrow (or annotate) Cars or Routes.
  const shown = useMemo<UsageFilters>(
    () => ({ ...filters, platform: keys.includes("platform") ? platform : "all", ui: keys.includes("ui") ? ui : "all" }),
    [filters, keys, platform, ui],
  );

  // Users has its own source; every other view reads the report.
  const usage = useUsage("usage", days, env, { enabled: section !== "users" });
  // Null while loading another window or environment: never the previous numbers.
  const scope = useMemo(() => (usage.data ? makeScope(usage.data, shown) : null), [usage.data, shown]);
  const waiting = usage.error ? "Couldn't load." : LOADING;

  // Links keep the filters exactly as the URL has them.
  const keep = { days: params.get("days"), platform: params.get("platform"), ui: params.get("ui"), env: params.get("env") };
  const href = (s?: UsageSection) => buildHash("usage", { ...keep, section: s });

  // A drill-in opens at its top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [section]);

  const failed = usage.error && section !== "users" && (
    <RetryLine onRetry={usage.refresh}>Couldn't load usage. {usage.error}</RetryLine>
  );
  const card = { scope, waiting, href };

  if (!section) {
    return (
      <div className="use">
        <LargeTitle title="Usage" subtitle={scopeLine(filters, keys)} />
        <Filters keys={keys} f={filters} onParams={onParams} />
        {failed}
        <Group title="Is anyone using it?">
          <ActivityPreview {...card} index={0} />
          <LanguagesPreview {...card} index={1} />
        </Group>
        <Group title="Do people come back?">
          <ComingBackPreview {...card} index={2} wide />
        </Group>
        <Group title="Which features get used?">
          <ScreensPreview {...card} index={3} />
          <ActionsPreview {...card} index={4} />
        </Group>
        <Group title="Where do people get stuck?">
          <FunnelsPreview {...card} index={5} />
          <RoutesPreview {...card} index={6} />
        </Group>
        <Group title="Cars and Android Auto">
          <CarsPreview {...card} index={7} />
          <AndroidAutoPreview {...card} index={8} />
        </Group>
        <Group title="Who uses it?">
          <UsersPreview href={href} index={9} wide />
        </Group>
        <Foot />
      </div>
    );
  }

  let content: ReactNode;
  if (section === "users") content = <UsersSection params={params} onParams={onParams} />;
  else if (section === "cars")
    // The old Vehicles link (?tab=catalog) puts the catalog first.
    content = focusCatalog ? (
      <>
        <CatalogCard params={params} onParams={onParams} index={0} />
        <MissingCarsCard {...card} />
      </>
    ) : (
      <>
        <MissingCarsCard {...card} />
        <CatalogCard params={params} onParams={onParams} />
      </>
    );
  else {
    const Detail = DETAIL[section];
    content = <Detail {...card} />;
  }

  return (
    <div className="use">
      <Back href={href()} />
      <LargeTitle title={SECTION_TITLE[section]} subtitle={scopeLine(filters, keys) || undefined} />
      <Filters keys={keys} f={filters} onParams={onParams} />
      {failed}
      <div className="use-grid">{content}</div>
      {section !== "users" && <Foot />}
    </div>
  );
};
