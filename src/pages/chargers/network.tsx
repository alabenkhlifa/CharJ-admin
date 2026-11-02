import { useMemo, type ReactNode } from "react";
import {
  ACCESS_LABELS,
  ACCESS_TYPES,
  CONNECTOR_KEYS,
  networkStats,
  NO_CITY,
  POWER_BUCKETS,
  POWER_LABELS,
  STATUSES,
  STATUS_LABELS,
  type NetworkStats,
} from "../../data/charger-catalog";
import { CONNECTOR_COLORS, CONNECTOR_LABELS, STATUS_COLORS, type Charger } from "../../data/chargers";
import type { Governorate } from "../../data/locations-model";
import { countOrPercentParts, plural } from "../../lib/health-format";
import { downloadCsv, stampedFilename, type CsvCell } from "../../lib/csv";
import { buildHash } from "../../lib/use-route";
import { Bubble } from "../../ui/bubble";
import { Empty } from "../../ui/empty";
import { HBars, type HBarRow } from "../../ui/hbars";
import { HealthCard } from "../../ui/health-card";
import { HeroValue } from "../../ui/hero-value";
import { ListRow, ListRows } from "../../ui/list-row";
import { ChgIcon, LOADING, Note, RetryLine, Waiting, type ChgIconName } from "./bits";
import { nf } from "./format";

// ?view=stats, "About the network": the catalogue as it stands (a snapshot,
// so no time range), from the same rows as the list. Status and connector
// bars keep their domain colours; the other bars are the Chargers colour.
// Under 10 chargers a share is left out and the counts stay.

type Props = {
  chargers: Charger[];
  governorates: Governorate[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** The list or map has filters set: say they don't apply here. */
  filtered: boolean;
  /** The read stopped at this many rows, so every count may run short; null when it didn't. */
  cap: number | null;
};

const ONE: { name: string; tone: "screens" }[] = [{ name: "Chargers", tone: "screens" }];

/** "92%" with "184 of 200 operational", or under 10 "3" with "of 5 operational". */
const Share = ({ n, of, what }: { n: number; of: number; what: string }) => {
  const { percent, counts } = countOrPercentParts(n, of);
  return percent ? <HeroValue value={percent} unit={`${counts} ${what}`} /> : <HeroValue value={n} unit={`of ${nf.format(of)} ${what}`} />;
};

const Card = ({
  title,
  icon,
  color = "screens",
  meta,
  index,
  wide,
  children,
}: {
  title: string;
  icon: ChgIconName;
  color?: "screens" | "needs-you";
  meta?: ReactNode;
  index: number;
  wide?: boolean;
  children: ReactNode;
}) => (
  <HealthCard title={title} color={color} icon={<ChgIcon name={icon} />} meta={meta} index={index} wide={wide}>
    {children}
  </HealthCard>
);

const list = (q: Record<string, string>) => buildHash("chargers", q);

/** A chart's rows as a two-column CSV, like the old Overview cards' exports. */
const rowsCsv = (stem: string, header: string, rows: HBarRow[]) => () =>
  downloadCsv(stampedFilename(stem), [[header, "Chargers"], ...rows.map((r) => [r.name, r.values[0] ?? 0])]);

const Csv = ({ what, onClick }: { what: string; onClick: () => void }) => (
  <button type="button" className="chg-link chg-csv" onClick={onClick} aria-label={`Download ${what} as CSV`}>
    <ChgIcon name="download" /> Download CSV
  </button>
);

type Rows = ReturnType<typeof chartRows>;

const chartRows = (s: NetworkStats) => ({
  status: STATUSES.map((k) => ({ name: STATUS_LABELS[k], values: [s.status[k]], color: STATUS_COLORS[k] })),
  connectors: CONNECTOR_KEYS.filter((k) => k === "t2" || k === "ccs" || k === "chademo" || s.connectors[k] > 0).map((k) => ({
    name: CONNECTOR_LABELS[k],
    values: [s.connectors[k]],
    color: CONNECTOR_COLORS[k],
  })),
  access: ACCESS_TYPES.map((k) => ({ name: ACCESS_LABELS[k], values: [s.access[k]] })),
  power: [
    ...POWER_BUCKETS.map((k) => ({ name: POWER_LABELS[k], values: [s.power[k]] })),
    ...(s.powerUnknown ? [{ name: "Not listed", values: [s.powerUnknown] }] : []),
  ],
  governorates: s.governorates.map((g) => ({ name: g.name, values: [g.count] })),
});

/** Every number on the page in one file (the old Overview's summary export). */
const summaryCsv = (s: NetworkStats, rows: Rows) => () => {
  const section = (name: string, rs: HBarRow[]): CsvCell[][] => rs.map((r) => [name, r.name, r.values[0] ?? 0]);
  downloadCsv(stampedFilename("network"), [
    ["Section", "Metric", "Value"],
    ["Catalogue", "Chargers", s.total],
    ["Catalogue", "Verified", s.verified],
    ["Catalogue", "Plugs", s.plugs],
    ...section("Status", rows.status),
    ...section("Connector (chargers offering it)", rows.connectors),
    ...section("Access", rows.access),
    ...section("Top power", rows.power),
    ...section("Governorate", rows.governorates),
    ["Coverage", "Not counted by governorate", s.unplaced],
    ["Needs a look", "Not verified", s.total - s.verified],
    ["Needs a look", "No city linked", s.unlinked],
    ["Needs a look", "No working hours", s.noHours],
  ]);
};

const Bodies = ({ s, rows }: { s: NetworkStats; rows: Rows }) => {
  // One bar per covered governorate, so the count is the bars; "of 24" only
  // once the governorates list has loaded, never a made-up total.
  const reference = s.referenceCount;
  const covered = rows.governorates.length;
  const unverified = s.total - s.verified;

  return (
    <>
      <Card title="Needs a look" icon="wrench" color="needs-you" index={0} wide>
        <ListRows label="Catalogue gaps">
          <ListRow title="Not verified" detail="Nobody has checked these on site yet." href={list({ ver: "no" })} trailing={<Bubble n={unverified} tone="needs-you" />} label={`Not verified: ${nf.format(unverified)}`} />
          <ListRow title="No city linked" detail="They show the old city text in the app." href={list({ cities: NO_CITY })} trailing={<Bubble n={s.unlinked} tone="needs-you" />} label={`No city linked: ${nf.format(s.unlinked)}`} />
          <ListRow title="No working hours" detail="The app can't say if they're open." href={list({ hours: "missing" })} trailing={<Bubble n={s.noHours} tone="needs-you" />} label={`No working hours: ${nf.format(s.noHours)}`} />
        </ListRows>
      </Card>

      <Card title="Status" icon="pulse" meta={plural(s.total, "chargers")} index={1}>
        <Share n={s.status.operational} of={s.total} what="operational" />
        <HBars rows={rows.status} series={ONE} label="Chargers by status" labelHeader="Status" tableAction={<Csv what="chargers by status" onClick={rowsCsv("chargers-by-status", "Status", rows.status)} />} />
      </Card>

      <Card title="Connectors" icon="plug" meta={plural(s.plugs, "plugs")} index={2}>
        <HeroValue value={s.connectors.ccs} unit={`${s.connectors.ccs === 1 ? "charger offers" : "chargers offer"} CCS`} />
        <HBars rows={rows.connectors} series={ONE} label="Chargers offering each connector" labelHeader="Connector" tableAction={<Csv what="chargers by connector" onClick={rowsCsv("chargers-by-connector", "Connector", rows.connectors)} />} />
        <Note>A charger with two connector types counts once in each, so the bars add up to more than the chargers.</Note>
      </Card>

      <Card title="Access" icon="lock" index={3}>
        <Share n={s.access.public} of={s.total} what="open to the public" />
        <HBars rows={rows.access} series={ONE} label="Chargers by access" labelHeader="Access" tableAction={<Csv what="chargers by access" onClick={rowsCsv("access-split", "Access", rows.access)} />} />
        <Note>Customers-only and brand-only chargers stay on the app's map but are left out of the trip planner.</Note>
      </Card>

      <Card title="Power" icon="bolt" index={4}>
        <Share n={s.fast} of={s.total} what="DC, over 22 kW" />
        <HBars rows={rows.power} series={ONE} label="Chargers by top power" labelHeader="Top power" tableAction={<Csv what="chargers by power" onClick={rowsCsv("power-distribution", "Top power", rows.power)} />} />
        <Note>Each charger counts once, by its most powerful connector; "Not listed" has no power figure. The groups match the list's Power filter.</Note>
      </Card>

      <Card title="Coverage" icon="pin" index={5} wide>
        <HeroValue value={covered} unit={reference ? `of ${nf.format(reference)} governorates have a charger` : `${covered === 1 ? "governorate has" : "governorates have"} a charger`} />
        {rows.governorates.length ? (
          <HBars
            rows={rows.governorates}
            series={ONE}
            label="Chargers per governorate"
            labelHeader="Governorate"
            tableAction={<Csv what="chargers per governorate" onClick={rowsCsv("chargers-by-governorate", "Governorate", rows.governorates)} />}
          />
        ) : (
          <Empty>No charger is linked to a city yet.</Empty>
        )}
        {s.uncovered.length > 0 && <Note>No charger yet: {s.uncovered.join(", ")}.</Note>}
        {s.unplaced > 0 && (
          <Note>
            {plural(s.unplaced, "chargers")} {s.unplaced === 1 ? "isn't" : "aren't"} placed in a known governorate (no city linked), so{" "}
            {s.unplaced === 1 ? "it's" : "they're"} not counted here.{" "}
            {s.unlinked > 0 && <a href={list({ cities: NO_CITY })}>Show the ones with no city</a>}
          </Note>
        )}
        <p className="chg-open-map">
          <a href={list({ view: "map" })}>
            <ChgIcon name="map" /> Open the map
          </a>
        </p>
      </Card>
    </>
  );
};

export const NetworkView = ({ chargers, governorates, loading, error, onRetry, filtered, cap }: Props) => {
  const stats = useMemo(() => networkStats(chargers, governorates), [chargers, governorates]);
  const rows = useMemo(() => chartRows(stats), [stats]);
  const ready = !loading && !error && stats.total > 0;
  let body: ReactNode;
  if (loading)
    body = (
      <HealthCard title="About the network" color="screens" icon={<ChgIcon name="bars" />} index={0} wide>
        <Waiting tall>{LOADING}</Waiting>
      </HealthCard>
    );
  else if (error)
    body = (
      <HealthCard title="About the network" color="screens" icon={<ChgIcon name="bars" />} index={0} wide>
        <RetryLine onRetry={onRetry}>Couldn't load chargers: {error}</RetryLine>
      </HealthCard>
    );
  else if (!stats.total)
    body = (
      <HealthCard title="About the network" color="idle" icon={<ChgIcon name="bars" />} index={0} wide>
        <Empty size="body">No chargers in the database yet. Run the OCM sync or add a charger, and the network fills in here.</Empty>
      </HealthCard>
    );
  else body = <Bodies s={stats} rows={rows} />;

  return (
    <section aria-labelledby="chg-network-title">
      <div className="chg-sec-row">
        <h2 className="chg-sec" id="chg-network-title">
          About the network
        </h2>
        {ready && <Csv what="every number on this page" onClick={summaryCsv(stats, rows)} />}
      </div>
      <p className="chg-lede">
        {cap === null
          ? "Every charger in the catalogue as it stands now"
          : `The first ${nf.format(cap)} chargers in the catalogue as they stand now. The list reads at most ${nf.format(cap)}, so every count here may run short`}
        {filtered ? ". The list's search and filters don't apply here" : ""}.
      </p>
      <div className="chg-grid">{body}</div>
    </section>
  );
};
