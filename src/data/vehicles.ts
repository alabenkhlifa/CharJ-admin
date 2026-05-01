import { useEffect, useState } from "react";
import { SUPABASE_CONFIGURED, supabase } from "../lib/supabase";
import type { ConnectorKey, ConnectorTypeRaw } from "./chargers";

// ── Types matching the ev_models catalog table ────────────────────────────
//
// Anon-readable per RLS (`is_active = TRUE`). Schema confirmed against
// supabase/migrations/20260417000001_vehicles.sql plus the source/curve
// add-ons (20260417000003, 20260428000001).
//
// `source` is a free TEXT column in the schema but in practice holds one of
// 'curated' | 'wikidata' | 'automobile-tn' | 'evdb' | 'community'. Keep the
// fallback string so a new value from a sync doesn't break the page.

export type EvModelSource =
  | "curated"
  | "wikidata"
  | "automobile-tn"
  | "evdb"
  | "community"
  | (string & {});

export type DcCurvePoint = { soc: number; kw: number };

export type RawEvModelRow = {
  id: string;
  make: string;
  model: string;
  variant: string | null;
  year_from: number;
  year_to: number | null;
  battery_kwh: number | string;
  usable_battery_kwh: number | string | null;
  max_ac_kw: number | string;
  max_dc_kw: number | string;
  connectors: string[] | null;
  efficiency_wh_per_km: number;
  is_active: boolean;
  source: EvModelSource;
  dc_charge_curve: DcCurvePoint[] | null;
  created_at: string;
  updated_at: string;
};

// ── UI-shaped model ───────────────────────────────────────────────────────

export type EvModel = {
  id: string;
  make: string;
  model: string;
  variant: string;
  yearFrom: number;
  yearTo: number | null;
  batteryKwh: number;
  usableBatteryKwh: number;
  maxAcKw: number;
  maxDcKw: number;
  connectorKeys: ConnectorKey[];
  rawConnectors: string[];
  efficiencyWhPerKm: number;
  source: EvModelSource;
  hasDcCurve: boolean;
};

// ── Mapping ───────────────────────────────────────────────────────────────

const CONNECTOR_TYPE_TO_KEY: Record<string, ConnectorKey> = {
  "Type 2": "t2",
  "Type 1": "t1",
  CCS: "ccs",
  CHAdeMO: "chademo",
};

const connectorTypeToKey = (t: ConnectorTypeRaw): ConnectorKey =>
  CONNECTOR_TYPE_TO_KEY[t] ?? "other";

// `numeric(5,1)` round-trips through PostgREST as a string. Coerce defensively.
const toNumber = (v: number | string | null | undefined): number => {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const mapRawEvModel = (r: RawEvModelRow): EvModel => {
  const conns = r.connectors ?? [];
  const battery = toNumber(r.battery_kwh);
  const usable = r.usable_battery_kwh == null ? battery : toNumber(r.usable_battery_kwh);
  return {
    id: r.id,
    make: r.make,
    model: r.model,
    variant: (r.variant ?? "").trim(),
    yearFrom: r.year_from,
    yearTo: r.year_to,
    batteryKwh: battery,
    usableBatteryKwh: usable,
    maxAcKw: toNumber(r.max_ac_kw),
    maxDcKw: toNumber(r.max_dc_kw),
    connectorKeys: Array.from(new Set(conns.map((c) => connectorTypeToKey(c)))),
    rawConnectors: conns,
    efficiencyWhPerKm: r.efficiency_wh_per_km,
    source: r.source,
    hasDcCurve: Array.isArray(r.dc_charge_curve) && r.dc_charge_curve.length > 0,
  };
};

// ── Hook ──────────────────────────────────────────────────────────────────

type UseEvModelsState = {
  data: EvModel[];
  loading: boolean;
  error: string | null;
};

export const useEvModels = (): UseEvModelsState => {
  const [state, setState] = useState<UseEvModelsState>({
    data: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) {
      setState({ data: [], loading: false, error: "Supabase not configured" });
      return;
    }

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("ev_models")
        .select(
          "id, make, model, variant, year_from, year_to, battery_kwh, usable_battery_kwh, max_ac_kw, max_dc_kw, connectors, efficiency_wh_per_km, is_active, source, dc_charge_curve, created_at, updated_at",
        )
        .order("make", { ascending: true })
        .order("model", { ascending: true })
        .limit(500);

      if (cancelled) return;

      if (error) {
        setState({ data: [], loading: false, error: error.message });
        return;
      }

      const rows = (data ?? []) as RawEvModelRow[];
      setState({ data: rows.map(mapRawEvModel), loading: false, error: null });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
};
