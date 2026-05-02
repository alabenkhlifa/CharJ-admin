import { useCallback, useEffect, useState } from "react";
import { SUPABASE_CONFIGURED, supabase } from "../lib/supabase";

// ── Types matching the search_chargers RPC return shape ───────────────────

export type ChargerStatus = "operational" | "under_repair" | "planned" | "unknown";
export type AccessType = "public" | "customers_only" | "brand_exclusive";
export type ChargerSource = "ocm" | "curated" | "community";
export type ConnectorTypeRaw = "Type 2" | "CCS" | "CHAdeMO" | string;
export type ConnectorKey = "t2" | "ccs" | "chademo" | "t1" | "other";

export type RawConnector = {
  type: ConnectorTypeRaw;
  power_kw: number;
  count: number;
};

// Database shape (`chargers.working_hours` JSONB):
//   { "weekly": { "mon": [{ "from": "08:00", "to": "17:30" }], ..., "sun": [] } }
// Lowercase 3-letter day keys, an array of `{from, to}` ranges per day.
// Empty array means closed that day. 24/7 is encoded as `00:00`–`24:00`.
export type WorkingHoursRange = {
  from: string;
  to: string;
};

export type WorkingHoursWeekly = {
  mon?: WorkingHoursRange[];
  tue?: WorkingHoursRange[];
  wed?: WorkingHoursRange[];
  thu?: WorkingHoursRange[];
  fri?: WorkingHoursRange[];
  sat?: WorkingHoursRange[];
  sun?: WorkingHoursRange[];
};

export type WorkingHours = {
  weekly?: WorkingHoursWeekly;
} | null;

export type RawChargerRow = {
  id: string;
  ocm_id: number | null;
  name: string;
  name_ar: string | null;
  name_fr: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  city: string | null;
  connectors: RawConnector[] | null;
  operator: string | null;
  status: ChargerStatus;
  photos: string[] | null;
  source: ChargerSource;
  is_verified: boolean;
  verified_by: string | null;
  working_hours: WorkingHours;
  access_type: AccessType;
  exclusive_to: string[] | null;
  amenities: string[] | null;
  contact_phone: string | null;
  created_at: string;
  updated_at: string;
};

// ── UI-shaped charger ─────────────────────────────────────────────────────
// Matches what the table / map / drawer want to render. Keep this thin —
// derive everything else (max power, connector keys) here once.

export type Charger = {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  connectors: ConnectorKey[];
  rawConnectors: RawConnector[];
  power: number;
  status: ChargerStatus;
  access: AccessType;
  verified: boolean;
  verifiedBy: string | null;
  source: ChargerSource;
  hours: string;
  workingHours: WorkingHours;
  amenities: string[];
  ocmId: number | null;
  updatedAt: string;
};

// ── Mappers ───────────────────────────────────────────────────────────────

const CONNECTOR_TYPE_TO_KEY: Record<string, ConnectorKey> = {
  "Type 2": "t2",
  "Type 1": "t1",
  CCS: "ccs",
  CHAdeMO: "chademo",
};

const connectorTypeToKey = (t: ConnectorTypeRaw): ConnectorKey =>
  CONNECTOR_TYPE_TO_KEY[t] ?? "other";

const summarizeRanges = (ranges: WorkingHoursRange[] | undefined): string | null => {
  if (!ranges || ranges.length === 0) return null;
  return ranges.map((r) => `${r.from}-${r.to}`).join(",");
};

const summarizeHours = (wh: WorkingHours): string => {
  if (!wh || !wh.weekly) return "—";
  const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
  const opens = days.map((d) => summarizeRanges(wh.weekly?.[d]));

  // All seven days share the same window.
  if (opens.every((o) => o === "00:00-24:00")) return "24/7";
  if (opens.every((o) => o !== null && o === opens[0])) return opens[0]!;

  // Mon–Fri identical, weekend differs (a common case).
  const weekday = opens.slice(0, 5);
  if (weekday.every((o) => o !== null && o === weekday[0])) {
    return `Mon–Fri ${weekday[0]}`;
  }

  return "Varies";
};

export const mapRawCharger = (r: RawChargerRow): Charger | null => {
  if (r.latitude == null || r.longitude == null) return null;
  const conns = r.connectors ?? [];
  const power = conns.reduce((max, c) => Math.max(max, c.power_kw ?? 0), 0);
  const keys = Array.from(new Set(conns.map((c) => connectorTypeToKey(c.type))));
  return {
    id: r.id,
    name: r.name,
    city: r.city ?? "—",
    lat: r.latitude,
    lng: r.longitude,
    connectors: keys,
    rawConnectors: conns,
    power,
    status: r.status,
    access: r.access_type,
    verified: r.is_verified,
    verifiedBy: r.verified_by,
    source: r.source,
    hours: summarizeHours(r.working_hours),
    workingHours: r.working_hours,
    amenities: r.amenities ?? [],
    ocmId: r.ocm_id,
    updatedAt: r.updated_at,
  };
};

// ── UI palettes (kept here so wiring doesn't leak Supabase types into pages)

export const CONNECTOR_COLORS: Record<ConnectorKey, string> = {
  t2: "#3B82F6",
  ccs: "#8B5CF6",
  chademo: "#EC4899",
  t1: "#71717A",
  other: "#52525B",
};

export const CONNECTOR_LABELS: Record<ConnectorKey, string> = {
  t2: "Type 2",
  ccs: "CCS",
  chademo: "CHAdeMO",
  t1: "Type 1",
  other: "Other",
};

export const STATUS_COLORS: Record<ChargerStatus, string> = {
  operational: "#10B981",
  under_repair: "#F59E0B",
  planned: "#6366F1",
  unknown: "#71717A",
};

// ── Hook ──────────────────────────────────────────────────────────────────

type UseChargersState = {
  data: Charger[];
  loading: boolean;
  error: string | null;
};

type UseChargersResult = UseChargersState & {
  refetch: () => Promise<void>;
};

export const useChargers = (): UseChargersResult => {
  const [state, setState] = useState<UseChargersState>({
    data: [],
    loading: true,
    error: null,
  });

  const fetchOnce = useCallback(async (signal?: { cancelled: boolean }) => {
    if (!SUPABASE_CONFIGURED) {
      if (!signal?.cancelled) {
        setState({ data: [], loading: false, error: "Supabase not configured" });
      }
      return;
    }

    const { data, error } = await supabase.rpc("search_chargers", {
      query: "",
      sort_by: "name",
      max_results: 1000,
    });

    if (signal?.cancelled) return;

    if (error) {
      setState({ data: [], loading: false, error: error.message });
      return;
    }

    const rows = (data ?? []) as RawChargerRow[];
    const mapped = rows
      .map(mapRawCharger)
      .filter((c): c is Charger => c !== null);

    setState({ data: mapped, loading: false, error: null });
  }, []);

  useEffect(() => {
    const signal = { cancelled: false };
    void fetchOnce(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [fetchOnce]);

  const refetch = useCallback(async () => {
    await fetchOnce();
  }, [fetchOnce]);

  return { ...state, refetch };
};
