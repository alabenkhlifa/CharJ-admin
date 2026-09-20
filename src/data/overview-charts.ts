import { useEffect, useMemo, useState } from "react";
import { SUPABASE_CONFIGURED, supabase } from "../lib/supabase";
import {
  bucketKey,
  bucketsFor,
  GRAIN_FOR,
  rangeStart,
  WIDEST_RANGE,
  type RangeKey,
} from "../lib/time-range";

// All anon-readable from `chargers` / `ratings` / `community_submissions`.
// Pull raw rows once, aggregate client-side. Catalogue is in the low thousands
// — single Promise.all batch is cheaper than six round-trips.

// ── Public chart shapes (mirror the components in components/charts.tsx) ──

export type DonutSlice = { key: string; label: string; value: number; color: string };

export type ConnectorPoint = {
  m: string;
  t2: number;
  ccs: number;
  chademo: number;
  t1: number;
};
export type ConnectorKeyDef = {
  key: "t2" | "ccs" | "chademo" | "t1";
  label: string;
  color: string;
};

export type HistBar = { label: string; value: number; color?: string };
export type FunnelStage = { stage: string; value: number; color: string };
// `v` is null for a bucket with no ratings — the chart draws a gap there
// rather than a dive to zero stars.
export type RatingPoint = { w: string; v: number | null };

export type OverviewCharts = {
  statusDonut: DonutSlice[];
  connectorStack: ConnectorPoint[];
  connectorKeys: ConnectorKeyDef[];
  powerHist: HistBar[];
  accessSplit: DonutSlice[];
  funnel: FunnelStage[];
  ratingTrend: RatingPoint[];
};

const EMPTY: OverviewCharts = {
  statusDonut: [],
  connectorStack: [],
  connectorKeys: [
    { key: "t2", label: "Type 2", color: "#3B82F6" },
    { key: "ccs", label: "CCS", color: "#8B5CF6" },
    { key: "chademo", label: "CHAdeMO", color: "#EC4899" },
    { key: "t1", label: "Type 1", color: "#71717A" },
  ],
  powerHist: [],
  accessSplit: [],
  funnel: [],
  ratingTrend: [],
};

// ── Palettes (kept here so the page never reaches into mock.ts for chart wiring)

const STATUS_PALETTE: Record<string, { label: string; color: string }> = {
  operational: { label: "Operational", color: "#10B981" },
  under_repair: { label: "Under repair", color: "#F59E0B" },
  planned: { label: "Planned", color: "#6366F1" },
  unknown: { label: "Unknown", color: "#71717A" },
};

const ACCESS_PALETTE: Record<string, { label: string; color: string }> = {
  public: { label: "Public", color: "var(--accent)" },
  customers_only: { label: "Customers only", color: "#6366F1" },
  employees_only: { label: "Employees only", color: "var(--indigo)" },
  brand_exclusive: { label: "Brand exclusive", color: "#8B5CF6" },
};

const SUBMISSION_PALETTE: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "#71717A" },
  under_review: { label: "Under review", color: "#6366F1" },
  approved: { label: "Approved", color: "#10B981" },
  rejected: { label: "Rejected", color: "#EF4444" },
};

const SUBMISSION_ORDER = ["pending", "under_review", "approved", "rejected"] as const;

const CONNECTOR_KEYS: ConnectorKeyDef[] = [
  { key: "t2", label: "Type 2", color: "#3B82F6" },
  { key: "ccs", label: "CCS", color: "#8B5CF6" },
  { key: "chademo", label: "CHAdeMO", color: "#EC4899" },
  { key: "t1", label: "Type 1", color: "#71717A" },
];

// ── Helpers ───────────────────────────────────────────────────────────────

type RawConnector = { type?: string; power_kw?: number; count?: number };

const connectorKeyForType = (t: string | undefined): ConnectorKeyDef["key"] | null => {
  if (!t) return null;
  const norm = t.trim().toLowerCase();
  if (norm === "type 2") return "t2";
  if (norm === "type 1") return "t1";
  if (norm === "ccs") return "ccs";
  if (norm === "chademo") return "chademo";
  return null;
};

const powerBucket = (maxKw: number): string => {
  if (maxKw <= 22) return "AC ≤22kW";
  if (maxKw < 100) return "DC 50kW";
  if (maxKw < 150) return "DC 100–150kW";
  return "DC 150kW+";
};

const POWER_BUCKETS = ["AC ≤22kW", "DC 50kW", "DC 100–150kW", "DC 150kW+"];

// ── Hook ──────────────────────────────────────────────────────────────────

type State = {
  data: OverviewCharts;
  loading: boolean;
  error: string | null;
};

type ChargerRow = {
  id: string;
  status: string | null;
  access_type: string | null;
  connectors: RawConnector[] | null;
  created_at: string;
};

type SubmissionRow = { status: string | null };
type RatingRow = { rating: number | null; created_at: string };

// ── Raw fetch (once) ──────────────────────────────────────────────────────
// Ranges are applied in memory, not re-fetched: the widest window is pulled
// up front so flipping 7d ↔ 1y is instant and costs no round-trip.

type RawState = {
  chargers: ChargerRow[];
  submissions: SubmissionRow[];
  ratings: RatingRow[];
  loading: boolean;
  error: string | null;
};

const EMPTY_RAW: RawState = {
  chargers: [],
  submissions: [],
  ratings: [],
  loading: true,
  error: null,
};

const useOverviewRaw = (): RawState => {
  const [raw, setRaw] = useState<RawState>(EMPTY_RAW);

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) {
      setRaw({ ...EMPTY_RAW, loading: false, error: "Supabase not configured" });
      return;
    }

    let cancelled = false;
    (async () => {
      const oldest = rangeStart(WIDEST_RANGE).toISOString();

      const [chargersRes, submissionsRes, ratingsRes] = await Promise.all([
        supabase.from("chargers").select("id, status, access_type, connectors, created_at"),
        supabase.from("community_submissions").select("status"),
        supabase.from("ratings").select("rating, created_at").gte("created_at", oldest),
      ]);

      if (cancelled) return;

      const firstError = chargersRes.error ?? submissionsRes.error ?? ratingsRes.error;
      if (firstError) {
        setRaw({ ...EMPTY_RAW, loading: false, error: firstError.message });
        return;
      }

      setRaw({
        chargers: (chargersRes.data ?? []) as ChargerRow[],
        submissions: (submissionsRes.data ?? []) as SubmissionRow[],
        ratings: (ratingsRes.data ?? []) as RatingRow[],
        loading: false,
        error: null,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return raw;
};

// ── Derivations ───────────────────────────────────────────────────────────

const buildStatusDonut = (chargers: ChargerRow[]): DonutSlice[] => {
  const counts = new Map<string, number>();
  for (const c of chargers) {
    const s = c.status ?? "unknown";
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, value]) => {
      const meta = STATUS_PALETTE[key] ?? { label: key, color: "#71717A" };
      return { key, label: meta.label, value, color: meta.color };
    })
    .sort((a, b) => b.value - a.value);
};

// Cumulative catalogue size by connector at the end of each bucket — i.e.
// "how many Type 2 plugs existed on this date". Deliberately not
// per-bucket additions: on a 7-day window almost nothing is added, and a
// chart that is empty at every short range reads as broken rather than calm.
const buildConnectorStack = (chargers: ChargerRow[], range: RangeKey): ConnectorPoint[] => {
  const buckets = bucketsFor(range);
  const dated = chargers
    .map((c) => ({ at: new Date(c.created_at).getTime(), conns: Array.isArray(c.connectors) ? c.connectors : [] }))
    .filter((c) => Number.isFinite(c.at))
    .sort((a, b) => a.at - b.at);

  const running: Record<ConnectorKeyDef["key"], number> = { t2: 0, ccs: 0, chademo: 0, t1: 0 };
  let cursor = 0;
  return buckets.map((b) => {
    const cutoff = b.end.getTime();
    while (cursor < dated.length && dated[cursor].at < cutoff) {
      for (const conn of dated[cursor].conns) {
        const k = connectorKeyForType(conn.type);
        if (!k) continue;
        running[k] += typeof conn.count === "number" && conn.count > 0 ? conn.count : 1;
      }
      cursor += 1;
    }
    return { m: b.label, t2: running.t2, ccs: running.ccs, chademo: running.chademo, t1: running.t1 };
  });
};

const buildPowerHist = (chargers: ChargerRow[]): HistBar[] => {
  const counts = new Map<string, number>(POWER_BUCKETS.map((b) => [b, 0]));
  for (const c of chargers) {
    const conns = Array.isArray(c.connectors) ? c.connectors : [];
    if (conns.length === 0) continue;
    const maxKw = conns.reduce(
      (mx, conn) => Math.max(mx, typeof conn.power_kw === "number" ? conn.power_kw : 0),
      0,
    );
    if (maxKw <= 0) continue;
    const bucket = powerBucket(maxKw);
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  return POWER_BUCKETS.map((label) => ({
    label,
    value: counts.get(label) ?? 0,
    color: "var(--accent)",
  }));
};

const buildAccessSplit = (chargers: ChargerRow[]): DonutSlice[] => {
  const counts = new Map<string, number>();
  for (const c of chargers) {
    const a = c.access_type ?? "public";
    counts.set(a, (counts.get(a) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, value]) => {
      const meta = ACCESS_PALETTE[key] ?? { label: key, color: "#71717A" };
      return { key, label: meta.label, value, color: meta.color };
    })
    .sort((a, b) => b.value - a.value);
};

const buildFunnel = (submissions: SubmissionRow[]): FunnelStage[] => {
  const counts = new Map<string, number>();
  for (const s of submissions) {
    const k = s.status ?? "pending";
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return SUBMISSION_ORDER.filter((k) => counts.has(k)).map((k) => {
    const meta = SUBMISSION_PALETTE[k];
    return { stage: meta.label, value: counts.get(k) ?? 0, color: meta.color };
  });
};

const buildRatingTrend = (ratings: RatingRow[], range: RangeKey): RatingPoint[] => {
  const grain = GRAIN_FOR[range];
  const buckets = bucketsFor(range);
  const index = new Map(buckets.map((b, i) => [b.key, i]));
  const sums = buckets.map(() => ({ sum: 0, count: 0 }));
  for (const r of ratings) {
    if (typeof r.rating !== "number") continue;
    const at = new Date(r.created_at);
    if (Number.isNaN(at.getTime())) continue;
    const idx = index.get(bucketKey(at, grain));
    if (idx === undefined) continue;
    sums[idx].sum += r.rating;
    sums[idx].count += 1;
  }
  return buckets.map((b, i) => {
    const { sum, count } = sums[i];
    return { w: b.label, v: count === 0 ? null : parseFloat((sum / count).toFixed(2)) };
  });
};

// ── Hook ──────────────────────────────────────────────────────────────────
// The snapshot charts (status, power, access, funnel) describe the catalogue
// as it stands and take no range. Only the two genuine time series do.

export const useOverviewCharts = (
  connectorRange: RangeKey,
  ratingRange: RangeKey,
): State => {
  const raw = useOverviewRaw();
  const { chargers, submissions, ratings, loading, error } = raw;

  const statusDonut = useMemo(() => buildStatusDonut(chargers), [chargers]);
  const powerHist = useMemo(() => buildPowerHist(chargers), [chargers]);
  const accessSplit = useMemo(() => buildAccessSplit(chargers), [chargers]);
  const funnel = useMemo(() => buildFunnel(submissions), [submissions]);
  const connectorStack = useMemo(
    () => buildConnectorStack(chargers, connectorRange),
    [chargers, connectorRange],
  );
  const ratingTrend = useMemo(
    () => buildRatingTrend(ratings, ratingRange),
    [ratings, ratingRange],
  );

  const data = useMemo<OverviewCharts>(
    () => ({
      statusDonut,
      connectorStack,
      connectorKeys: CONNECTOR_KEYS,
      powerHist,
      accessSplit,
      funnel,
      ratingTrend,
    }),
    [statusDonut, connectorStack, powerHist, accessSplit, funnel, ratingTrend],
  );

  return { data: error ? EMPTY : data, loading, error };
};
