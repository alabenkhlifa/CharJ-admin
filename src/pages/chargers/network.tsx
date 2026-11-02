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

const Bodies = ({ s }: { s: NetworkStats }) => {
  const statusRows: HBarRow[] = STATUSES.map((k) => ({ name: STATUS_LABELS[k], values: [s.status[k]], color: STATUS_COLORS[k] }));
  const connectorRows: HBarRow[] = CONNECTOR_KEYS.filter((k) => k === "t2" || k === "ccs" || k === "chademo" || s.connectors[k] > 0).map((k) => ({
    name: CONNECTOR_LABELS[k],
    values: [s.connectors[k]],
    color: CONNECTOR_COLORS[k],
  }));
  const accessRows: HBarRow[] = ACCESS_TYPES.map((k) => ({ name: ACCESS_LABELS[k], values: [s.access[k]] }));
  const powerRows: HBarRow[] = [
    ...POWER_BUCKETS.map((k) => ({ name: POWER_LABELS[k], values: [s.power[k]] })),
    ...(s.powerUnknown ? [{ name: "Not listed", values: [s.powerUnknown] }] : []),
  ];
  const govRows: HBarRow[] = s.governorates.map((g) => ({ name: g.name, values: [g.count] }));
  // "of 24" only once the governorates list has loaded; never a made-up total.
  const reference = s.referenceCount;
  const covered = reference ? reference - s.uncovered.length : s.governorates.length;
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
        <HBars rows={statusRows} series={ONE} label="Chargers by status" labelHeader="Status" />
      </Card>

      <Card title="Connectors" icon="plug" meta={plural(s.plugs, "plugs")} index={2}>
        <HeroValue value={s.connectors.ccs} unit={`${s.connectors.ccs === 1 ? "charger offers" : "chargers offer"} CCS`} />
        <HBars rows={connectorRows} series={ONE} label="Chargers offering each connector" labelHeader="Connector" />
        <Note>A charger with two connector types counts once in each, so the bars add up to more than the chargers.</Note>
      </Card>

      <Card title="Access" icon="lock" index={3}>
        <Share n={s.access.public} of={s.total} what="open to the public" />
        <HBars rows={accessRows} series={ONE} label="Chargers by access" labelHeader="Access" />
        <Note>Customers-only and brand-only chargers stay on the app's map but are left out of the trip planner.</Note>
      </Card>

      <Card title="Power" icon="bolt" index={4}>
        <Share n={s.fast} of={s.total} what="DC, over 22 kW" />
        <HBars rows={powerRows} series={ONE} label="Chargers by top power" labelHeader="Top power" />
        <Note>Each charger counts once, by its most powerful connector; "Not listed" has no power figure. The groups match the list's Power filter.</Note>
      </Card>

      <Card title="Coverage" icon="pin" index={5} wide>
        <HeroValue value={covered} unit={reference ? `of ${nf.format(reference)} governorates have a charger` : `${covered === 1 ? "governorate has" : "governorates have"} a charger`} />
        {govRows.length ? <HBars rows={govRows} series={ONE} label="Chargers per governorate" labelHeader="Governorate" /> : <Empty>No charger is linked to a city yet.</Empty>}
        {s.uncovered.length > 0 && <Note>No charger yet: {s.uncovered.join(", ")}.</Note>}
        {s.unlinked > 0 && (
          <Note>
            {plural(s.unlinked, "chargers")} {s.unlinked === 1 ? "isn't" : "aren't"} linked to a city, so {s.unlinked === 1 ? "it's" : "they're"} not counted by governorate.{" "}
            <a href={list({ cities: NO_CITY })}>Show {s.unlinked === 1 ? "it" : "them"}</a>
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

export const NetworkView = ({ chargers, governorates, loading, error, onRetry, filtered }: Props) => {
  const stats = useMemo(() => networkStats(chargers, governorates), [chargers, governorates]);
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
        <RetryLine onRetry={onRetry}>Couldn't load chargers. {error}</RetryLine>
      </HealthCard>
    );
  else if (!stats.total)
    body = (
      <HealthCard title="About the network" color="idle" icon={<ChgIcon name="bars" />} index={0} wide>
        <Empty size="body">No chargers in the database yet. Run the OCM sync or add a charger, and the network fills in here.</Empty>
      </HealthCard>
    );
  else body = <Bodies s={stats} />;

  return (
    <section aria-labelledby="chg-network-title">
      <h2 className="chg-sec" id="chg-network-title">
        About the network
      </h2>
      <p className="chg-lede">
        Every charger in the catalogue as it stands now{filtered ? ". The list's search and filters don't apply here" : ""}.
      </p>
      <div className="chg-grid">{body}</div>
    </section>
  );
};
