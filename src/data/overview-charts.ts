import { useEffect, useState } from "react";
import { SUPABASE_CONFIGURED, supabase } from "../lib/supabase";

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
export type RatingPoint = { w: string; v: number };

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

const monthKey = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const monthLabel = (d: Date) =>
  d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });

// Returns the last N months as [{key: 'YYYY-MM', label: 'Mmm'}], oldest first.
const lastMonths = (n: number): { key: string; label: string }[] => {
  const out: { key: string; label: string }[] = [];
  const now = new Date();
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(cursor);
    d.setUTCMonth(cursor.getUTCMonth() - i);
    out.push({ key: monthKey(d), label: monthLabel(d) });
  }
  return out;
};

// ISO-like week: Monday-anchored bucket. Returns YYYY-MM-DD of the Monday.
const weekStart = (d: Date): Date => {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = dt.getUTCDay(); // 0=Sun..6=Sat
  const offset = (dow + 6) % 7; // days since Monday
  dt.setUTCDate(dt.getUTCDate() - offset);
  return dt;
};
const weekKey = (d: Date) => weekStart(d).toISOString().slice(0, 10);

const lastWeeks = (n: number): { key: string; label: string }[] => {
  const out: { key: string; label: string }[] = [];
  const monday = weekStart(new Date());
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() - i * 7);
    out.push({ key: weekKey(d), label: `W${n - i}` });
  }
  return out;
};

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

export const useOverviewCharts = (): State => {
  const [state, setState] = useState<State>({
    data: EMPTY,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) {
      setState({ data: EMPTY, loading: false, error: "Supabase not configured" });
      return;
    }

    let cancelled = false;
    (async () => {
      const twelveWeeksAgo = new Date();
      twelveWeeksAgo.setUTCDate(twelveWeeksAgo.getUTCDate() - 12 * 7);

      const [chargersRes, submissionsRes, ratingsRes] = await Promise.all([
        supabase
          .from("chargers")
          .select("id, status, access_type, connectors, created_at"),
        supabase.from("community_submissions").select("status"),
        supabase
          .from("ratings")
          .select("rating, created_at")
          .gte("created_at", twelveWeeksAgo.toISOString()),
      ]);

      if (cancelled) return;

      const firstError =
        chargersRes.error ?? submissionsRes.error ?? ratingsRes.error;
      if (firstError) {
        setState({ data: EMPTY, loading: false, error: firstError.message });
        return;
      }

      const chargers = (chargersRes.data ?? []) as ChargerRow[];
      const submissions = (submissionsRes.data ?? []) as SubmissionRow[];
      const ratings = (ratingsRes.data ?? []) as RatingRow[];

      // ── Status donut ───────────────────────────────────────────────────
      const statusCounts = new Map<string, number>();
      for (const c of chargers) {
        const s = c.status ?? "unknown";
        statusCounts.set(s, (statusCounts.get(s) ?? 0) + 1);
      }
      const statusDonut: DonutSlice[] = Array.from(statusCounts.entries())
        .map(([key, value]) => {
          const meta = STATUS_PALETTE[key] ?? { label: key, color: "#71717A" };
          return { key, label: meta.label, value, color: meta.color };
        })
        .sort((a, b) => b.value - a.value);

      // ── Connector stack (last 8 months) ────────────────────────────────
      const months = lastMonths(8);
      const monthIndex = new Map(months.map((m, i) => [m.key, i]));
      const connectorStack: ConnectorPoint[] = months.map((m) => ({
        m: m.label,
        t2: 0,
        ccs: 0,
        chademo: 0,
        t1: 0,
      }));
      for (const c of chargers) {
        const created = new Date(c.created_at);
        const idx = monthIndex.get(monthKey(created));
        if (idx === undefined) continue;
        const conns = Array.isArray(c.connectors) ? c.connectors : [];
        // Aggregate connector counts per charger; use `count` if present, else 1.
        for (const conn of conns) {
          const k = connectorKeyForType(conn.type);
          if (!k) continue;
          const n = typeof conn.count === "number" && conn.count > 0 ? conn.count : 1;
          connectorStack[idx][k] += n;
        }
      }

      // ── Power histogram ────────────────────────────────────────────────
      const powerCounts = new Map<string, number>(POWER_BUCKETS.map((b) => [b, 0]));
      for (const c of chargers) {
        const conns = Array.isArray(c.connectors) ? c.connectors : [];
        if (conns.length === 0) continue;
        const maxKw = conns.reduce(
          (mx, conn) => Math.max(mx, typeof conn.power_kw === "number" ? conn.power_kw : 0),
          0,
        );
        if (maxKw <= 0) continue;
        const bucket = powerBucket(maxKw);
        powerCounts.set(bucket, (powerCounts.get(bucket) ?? 0) + 1);
      }
      const powerHist: HistBar[] = POWER_BUCKETS.map((label) => ({
        label,
        value: powerCounts.get(label) ?? 0,
        color: "var(--accent)",
      }));

      // ── Access split ───────────────────────────────────────────────────
      const accessCounts = new Map<string, number>();
      for (const c of chargers) {
        const a = c.access_type ?? "public";
        accessCounts.set(a, (accessCounts.get(a) ?? 0) + 1);
      }
      const accessSplit: DonutSlice[] = Array.from(accessCounts.entries())
        .map(([key, value]) => {
          const meta = ACCESS_PALETTE[key] ?? { label: key, color: "#71717A" };
          return { key, label: meta.label, value, color: meta.color };
        })
        .sort((a, b) => b.value - a.value);

      // ── Submissions funnel ─────────────────────────────────────────────
      const submissionCounts = new Map<string, number>();
      for (const s of submissions) {
        const k = s.status ?? "pending";
        submissionCounts.set(k, (submissionCounts.get(k) ?? 0) + 1);
      }
      const funnel: FunnelStage[] = SUBMISSION_ORDER.filter((k) =>
        submissionCounts.has(k),
      ).map((k) => {
        const meta = SUBMISSION_PALETTE[k];
        return {
          stage: meta.label,
          value: submissionCounts.get(k) ?? 0,
          color: meta.color,
        };
      });

      // ── Rating trend (12 weeks) ────────────────────────────────────────
      const weeks = lastWeeks(12);
      const weekIndex = new Map(weeks.map((w, i) => [w.key, i]));
      const weekSums = weeks.map(() => ({ sum: 0, count: 0 }));
      for (const r of ratings) {
        if (typeof r.rating !== "number") continue;
        const idx = weekIndex.get(weekKey(new Date(r.created_at)));
        if (idx === undefined) continue;
        weekSums[idx].sum += r.rating;
        weekSums[idx].count += 1;
      }
      const ratingTrend: RatingPoint[] = weeks.map((w, i) => {
        const { sum, count } = weekSums[i];
        return {
          w: w.label,
          v: count === 0 ? 0 : parseFloat((sum / count).toFixed(2)),
        };
      });

      setState({
        data: {
          statusDonut,
          connectorStack,
          connectorKeys: CONNECTOR_KEYS,
          powerHist,
          accessSplit,
          funnel,
          ratingTrend,
        },
        loading: false,
        error: null,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
};
