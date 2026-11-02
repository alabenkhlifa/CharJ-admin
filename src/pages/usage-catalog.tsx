import type { ReactNode } from "react";
import { CONNECTOR_LABELS } from "../data/chargers";
import { useEvModels, type EvModel } from "../data/vehicles";
import type { RouteParams } from "../lib/use-route";
import { Empty } from "../ui/empty";
import { HealthCard } from "../ui/health-card";
import { Pager } from "../ui/pager";
import { Pill } from "../ui/pill";
import { UsageIcon, Waiting } from "./usage-bits";

// Usage → Cars → the car catalog: the old Vehicles page (ev_models, anon
// readable), read-only. Page and page size live in the URL (?page=, ?per=).

const SIZES = [24, 48, 96] as const;
const DEFAULT_PER = 24;
const nf = new Intl.NumberFormat("en-US");

const years = (m: EvModel) => (m.yearTo == null ? `${m.yearFrom}+` : m.yearTo === m.yearFrom ? `${m.yearFrom}` : `${m.yearFrom}–${m.yearTo}`);

// Usable kWh when known (what drivers plan around), else gross; one decimal at most.
const battery = (m: EvModel) => {
  const kwh = Math.round((m.usableBatteryKwh > 0 ? m.usableBatteryKwh : m.batteryKwh) * 10) / 10;
  return `${Number.isInteger(kwh) ? kwh : kwh.toFixed(1)} kWh`;
};

// The headline charging spec: DC peak when the car has one, else AC peak.
const charge = (m: EvModel) => (m.maxDcKw > 0 ? `${Math.round(m.maxDcKw)} kW DC` : m.maxAcKw > 0 ? `${Math.round(m.maxAcKw)} kW AC` : null);

const facts = (m: EvModel) =>
  [years(m), battery(m), charge(m), m.connectorKeys.map((k) => CONNECTOR_LABELS[k]).join(", ") || null].filter(Boolean).join(" · ");

type Props = {
  params: URLSearchParams;
  onParams: (patch: RouteParams) => void;
  index?: number;
};

const positive = (value: string | null, fallback: number) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

export const CatalogCard = ({ params, onParams, index = 1 }: Props) => {
  const { data: models, loading, error } = useEvModels();
  const per = (SIZES as readonly number[]).includes(Number(params.get("per"))) ? Number(params.get("per")) : DEFAULT_PER;
  const pages = Math.max(1, Math.ceil(models.length / per));
  const page = Math.min(positive(params.get("page"), 1), pages);
  const shown = models.slice((page - 1) * per, page * per);

  const sources = new Map<string, number>();
  for (const m of models) sources.set(m.source, (sources.get(m.source) ?? 0) + 1);
  const breakdown = [...sources.entries()].sort((a, b) => b[1] - a[1]);

  let body: ReactNode;
  if (loading) body = <Waiting size="list">Loading…</Waiting>;
  else if (error) body = <Empty size="body">Couldn't load the catalog: {error}</Empty>;
  else if (!models.length)
    body = <Empty size="body">No car models in the catalog yet. Run the ev_models seed migration or the Wikidata sync to fill it.</Empty>;
  else
    body = (
      <>
        <p className="use-cap">
          {breakdown.map(([source, n]) => `${nf.format(n)} ${source}`).join(" · ")}. Read-only: adding a car stays a database job.
        </p>
        <ul className="use-models">
          {shown.map((m) => (
            <li key={m.id}>
              <span className="use-model-main">
                <span className="use-model-name">
                  {m.make} {m.model}
                  {m.variant && <span className="use-dim"> {m.variant}</span>}
                </span>
                <span className="use-d">{facts(m)}</span>
              </span>
              <Pill>{m.source}</Pill>
            </li>
          ))}
        </ul>
        <Pager
          label="Car models"
          page={page}
          perPage={per}
          total={models.length}
          sizes={SIZES}
          onPage={(n) => onParams({ page: n > 1 ? String(n) : null })}
          onPerPage={(n) => onParams({ per: n === DEFAULT_PER ? null : String(n), page: null })}
        />
      </>
    );

  return (
    <HealthCard
      title="Car catalog"
      color="cars"
      icon={<UsageIcon name="book" />}
      meta={!loading && !error ? `${nf.format(models.length)} ${models.length === 1 ? "model" : "models"}` : undefined}
      id="usage-catalog"
      index={index}
      wide
    >
      {body}
    </HealthCard>
  );
};
