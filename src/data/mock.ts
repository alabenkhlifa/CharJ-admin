import type { IconKey } from "../lib/icons";

export const fmt = (n: number | null | undefined, d = 0): string => {
  if (n === null || n === undefined || isNaN(n)) return "—";
  if (Math.abs(n) >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: d });
  return n.toFixed(d);
};
export const fmtPct = (n: number, d = 1) => `${n.toFixed(d)}%`;
export const fmtDelta = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;

let _seed = 42;
const srand = () => {
  _seed = (_seed * 9301 + 49297) % 233280;
  return _seed / 233280;
};
const sspark = (n: number, base: number, vol = 0.04, trend = 0): number[] => {
  const arr: number[] = [];
  let v = base * (1 - (trend * (n - 1)) / 2);
  for (let i = 0; i < n; i++) {
    v = v * (1 + (srand() - 0.5) * vol + trend);
    arr.push(Math.max(0, v));
  }
  return arr;
};

export type AccentTone = "teal" | "green" | "amber" | "indigo" | "red" | "slate";

export type Kpi = {
  id: string;
  label: string;
  value: number;
  fmt: (v: number) => string;
  delta: number;
  period: string;
  series: number[];
  accent: AccentTone;
  urgent?: boolean;
  multi?: { dau: number; wau: number; mau: number };
  stars?: boolean;
};

export const KPIS: Kpi[] = [
  { id: "total", label: "Total chargers", value: 412, fmt: (v) => fmt(v), delta: 4.2, period: "vs last week", series: sspark(24, 380, 0.03, 0.005), accent: "teal" },
  { id: "operational", label: "Operational", value: 78.4, fmt: (v) => fmtPct(v), delta: 1.8, period: "vs last week", series: sspark(24, 76, 0.02, 0.002), accent: "green" },
  { id: "verified", label: "Verified", value: 64.1, fmt: (v) => fmtPct(v), delta: 2.4, period: "vs last week", series: sspark(24, 60, 0.025, 0.003), accent: "teal" },
  { id: "uptime", label: "Avg uptime", value: 96.2, fmt: (v) => fmtPct(v), delta: -0.3, period: "vs last week", series: sspark(24, 96.5, 0.005), accent: "green" },
  { id: "subs", label: "Pending submissions", value: 47, fmt: (v) => fmt(v), delta: 12.0, period: "vs last week", series: sspark(24, 40, 0.06, 0.005), accent: "amber", urgent: true },
  { id: "fb", label: "Unread feedback", value: 23, fmt: (v) => fmt(v), delta: -8.0, period: "vs last week", series: sspark(24, 28, 0.06, -0.005), accent: "indigo" },
  { id: "reports", label: "Open review reports", value: 6, fmt: (v) => fmt(v), delta: 0, period: "vs last week", series: sspark(24, 6, 0.1), accent: "red" },
  { id: "rating", label: "Avg rating", value: 4.36, fmt: (v) => v.toFixed(2), delta: 0.6, period: "vs last week", series: sspark(24, 4.3, 0.01, 0.001), accent: "amber", stars: true },
  { id: "dau", label: "DAU / WAU / MAU", value: 1842, fmt: (v) => fmt(v), delta: 6.4, period: "DAU vs last week", series: sspark(24, 1700, 0.05, 0.005), accent: "teal", multi: { dau: 1842, wau: 8410, mau: 22341 } },
  { id: "newusers", label: "New users (week)", value: 312, fmt: (v) => fmt(v), delta: 14.2, period: "vs last week", series: sspark(24, 260, 0.08, 0.01), accent: "teal" },
  { id: "vehicles", label: "Registered vehicles", value: 1186, fmt: (v) => fmt(v), delta: 3.1, period: "vs last week", series: sspark(24, 1140, 0.02, 0.003), accent: "indigo" },
  { id: "trips", label: "Trip plans created", value: 4209, fmt: (v) => fmt(v), delta: 22.1, period: "vs last week", series: sspark(24, 3300, 0.05, 0.015), accent: "teal" },
];

export type DonutSlice = { key: string; label: string; value: number; color: string };

export const STATUS_DONUT: DonutSlice[] = [
  { key: "operational", label: "Operational", value: 323, color: "#10B981" },
  { key: "under_repair", label: "Under repair", value: 41, color: "#F59E0B" },
  { key: "planned", label: "Planned", value: 28, color: "#6366F1" },
  { key: "unknown", label: "Unknown", value: 20, color: "#71717A" },
];

export type ConnectorPoint = { m: string; t2: number; ccs: number; chademo: number; t1: number };
export type StackKey<T extends string> = { key: T; label: string; color: string };

export const CONNECTOR_STACK: ConnectorPoint[] = [
  { m: "Jun", t2: 92, ccs: 64, chademo: 22, t1: 8 },
  { m: "Jul", t2: 96, ccs: 71, chademo: 24, t1: 9 },
  { m: "Aug", t2: 104, ccs: 78, chademo: 26, t1: 9 },
  { m: "Sep", t2: 112, ccs: 84, chademo: 27, t1: 10 },
  { m: "Oct", t2: 121, ccs: 92, chademo: 28, t1: 10 },
  { m: "Nov", t2: 134, ccs: 101, chademo: 30, t1: 11 },
  { m: "Dec", t2: 141, ccs: 110, chademo: 31, t1: 11 },
  { m: "Jan", t2: 148, ccs: 118, chademo: 32, t1: 12 },
];

export const CONNECTOR_KEYS: StackKey<"t2" | "ccs" | "chademo" | "t1">[] = [
  { key: "t2", label: "Type 2", color: "#3B82F6" },
  { key: "ccs", label: "CCS", color: "#8B5CF6" },
  { key: "chademo", label: "CHAdeMO", color: "#EC4899" },
  { key: "t1", label: "Type 1", color: "#71717A" },
];

export type HistBar = { label: string; value: number; color?: string };

export const POWER_HIST: HistBar[] = [
  { label: "AC ≤22kW", value: 184, color: "var(--accent)" },
  { label: "DC 50kW", value: 96, color: "var(--accent)" },
  { label: "DC 100–150kW", value: 84, color: "var(--accent)" },
  { label: "DC 150kW+", value: 48, color: "var(--accent)" },
];

export type GouvRow = { name: string; count: number; op: number };

export const GOUV: GouvRow[] = [
  { name: "Tunis", count: 78, op: 64 },
  { name: "Ariana", count: 41, op: 35 },
  { name: "Ben Arous", count: 38, op: 30 },
  { name: "Sousse", count: 36, op: 28 },
  { name: "Sfax", count: 32, op: 24 },
  { name: "Nabeul", count: 28, op: 22 },
  { name: "Manouba", count: 22, op: 18 },
  { name: "Monastir", count: 19, op: 14 },
  { name: "Bizerte", count: 17, op: 13 },
  { name: "Mahdia", count: 12, op: 9 },
];

export const ACCESS_SPLIT: DonutSlice[] = [
  { key: "public", label: "Public", value: 248, color: "var(--accent)" },
  { key: "customers_only", label: "Customers only", value: 112, color: "#6366F1" },
  { key: "brand_exclusive", label: "Brand exclusive", value: 52, color: "#8B5CF6" },
];

export type FunnelStage = { stage: string; value: number; color: string };

export const FUNNEL: FunnelStage[] = [
  { stage: "Submitted", value: 184, color: "#71717A" },
  { stage: "Under review", value: 138, color: "#6366F1" },
  { stage: "Approved", value: 92, color: "#10B981" },
  { stage: "Rejected", value: 46, color: "#EF4444" },
];

export type FeedbackPoint = { w: string; bug: number; feature_request: number; charger_issue: number; general: number };

export const FEEDBACK_AREA: FeedbackPoint[] = (() => {
  const weeks = 12;
  const arr: FeedbackPoint[] = [];
  for (let i = 0; i < weeks; i++) {
    arr.push({
      w: `W${i + 1}`,
      bug: 6 + Math.round(Math.sin(i * 0.6) * 3 + srand() * 4),
      feature_request: 8 + Math.round(srand() * 5 + i * 0.4),
      charger_issue: 10 + Math.round(Math.cos(i * 0.4) * 3 + srand() * 4),
      general: 4 + Math.round(srand() * 3),
    });
  }
  return arr;
})();

export const FEEDBACK_KEYS: StackKey<"charger_issue" | "bug" | "feature_request" | "general">[] = [
  { key: "charger_issue", label: "Charger issue", color: "#F59E0B" },
  { key: "bug", label: "Bug", color: "#EF4444" },
  { key: "feature_request", label: "Feature request", color: "#0BD8B6" },
  { key: "general", label: "General", color: "#71717A" },
];

export type RatingPoint = { w: string; v: number };

export const RATING_TREND: RatingPoint[] = (() => {
  const arr: RatingPoint[] = [];
  let v = 4.18;
  for (let i = 0; i < 12; i++) {
    v += (srand() - 0.4) * 0.05;
    v = Math.max(3.9, Math.min(4.6, v));
    arr.push({ w: `W${i + 1}`, v: parseFloat(v.toFixed(2)) });
  }
  return arr;
})();

export type VerifyPoint = { w: string; count: number; admin: string };

export const VERIFY_VELOCITY: VerifyPoint[] = [
  { w: "W1", count: 8, admin: "amine" },
  { w: "W2", count: 12, admin: "amine" },
  { w: "W3", count: 6, admin: "leila" },
  { w: "W4", count: 14, admin: "amine" },
  { w: "W5", count: 18, admin: "leila" },
  { w: "W6", count: 11, admin: "amine" },
  { w: "W7", count: 22, admin: "leila" },
  { w: "W8", count: 16, admin: "amine" },
];

export const TOP_REQUESTED: { name: string; count: number }[] = [
  { name: "Tozeur centre-ville", count: 18 },
  { name: "Hammamet Yasmine", count: 14 },
  { name: "Djerba Houmt Souk", count: 12 },
  { name: "Aéroport Tunis–Carthage", count: 11 },
  { name: "Kairouan médina", count: 9 },
  { name: "Bizerte port", count: 7 },
  { name: "Tabarka", count: 6 },
];

export const RATING_DIST: { stars: number; count: number }[] = [
  { stars: 5, count: 1842 },
  { stars: 4, count: 1124 },
  { stars: 3, count: 412 },
  { stars: 2, count: 168 },
  { stars: 1, count: 96 },
];

export const OCM_SYNC = {
  lastSync: "12 min ago",
  rowsUpdated: 84,
  conflicts: 3,
  status: "healthy" as const,
};

export type ActivityTone = "green" | "teal" | "amber" | "indigo" | "red";
export type ActivityEntry = {
  t: string;
  who: string;
  action: string;
  target: string;
  icon: IconKey;
  tone: ActivityTone;
};

export const ACTIVITY: ActivityEntry[] = [
  { t: "2 min ago", who: "amine", action: "verified", target: "Total Energies La Marsa", icon: "Verify", tone: "green" },
  { t: "9 min ago", who: "leila", action: "approved submission", target: "Audi Ennakl Lac 2", icon: "Check", tone: "green" },
  { t: "21 min ago", who: "system", action: "OCM sync", target: "84 rows updated", icon: "Sync", tone: "teal" },
  { t: "38 min ago", who: "amine", action: "marked under repair", target: "Hôtel Le Corail Sousse", icon: "Charger", tone: "amber" },
  { t: "1 h ago", who: "leila", action: "resolved feedback", target: "#FB-2841 (charger issue)", icon: "Inbox", tone: "indigo" },
  { t: "2 h ago", who: "amine", action: "rejected submission", target: "Café Sidi Bou Saïd (duplicate)", icon: "X", tone: "red" },
  { t: "3 h ago", who: "system", action: "auto-flagged review", target: "Spam keywords detected", icon: "Reviews", tone: "amber" },
  { t: "5 h ago", who: "leila", action: "edited override", target: "IKEA Tunis power 50→75kW", icon: "Bolt", tone: "teal" },
];

export type ConnectorKey = "t2" | "ccs" | "chademo" | "t1";
export type ChargerStatus = "operational" | "under_repair" | "planned" | "unknown";
export type AccessType = "public" | "customers_only" | "brand_exclusive";
export type ChargerSource = "ocm" | "curated" | "community";

export type Charger = {
  id: string;
  name: string;
  gouv: string;
  lat: number;
  lng: number;
  connectors: ConnectorKey[];
  power: number;
  status: ChargerStatus;
  access: AccessType;
  verified: boolean;
  source: ChargerSource;
  hours: string;
};

export const CHARGERS: Charger[] = [
  { id: "ch-001", name: "Total Energies La Marsa", gouv: "Tunis", lat: 36.878, lng: 10.323, connectors: ["t2", "ccs"], power: 50, status: "operational", access: "public", verified: true, source: "ocm", hours: "24/7" },
  { id: "ch-002", name: "Audi Ennakl Lac 2", gouv: "Tunis", lat: 36.835, lng: 10.276, connectors: ["t2"], power: 22, status: "operational", access: "customers_only", verified: true, source: "curated", hours: "Mon–Sat 08–20" },
  { id: "ch-003", name: "Hôtel Le Corail Sousse", gouv: "Sousse", lat: 35.825, lng: 10.638, connectors: ["t2"], power: 22, status: "under_repair", access: "customers_only", verified: false, source: "community", hours: "24/7" },
  { id: "ch-004", name: "IKEA Tunis", gouv: "Ben Arous", lat: 36.752, lng: 10.272, connectors: ["t2", "ccs", "chademo"], power: 75, status: "operational", access: "public", verified: true, source: "curated", hours: "Mon–Sun 09–22" },
  { id: "ch-005", name: "Carrefour Lac", gouv: "Tunis", lat: 36.836, lng: 10.247, connectors: ["t2", "ccs"], power: 50, status: "operational", access: "public", verified: true, source: "ocm", hours: "24/7" },
  { id: "ch-006", name: "Mövenpick Gammarth", gouv: "Tunis", lat: 36.917, lng: 10.290, connectors: ["t2"], power: 22, status: "operational", access: "customers_only", verified: true, source: "curated", hours: "24/7" },
  { id: "ch-007", name: "Géant Manar", gouv: "Tunis", lat: 36.835, lng: 10.171, connectors: ["ccs"], power: 100, status: "planned", access: "public", verified: false, source: "community", hours: "—" },
  { id: "ch-008", name: "Renault Tunisie HQ", gouv: "Ariana", lat: 36.866, lng: 10.183, connectors: ["t2", "ccs"], power: 50, status: "operational", access: "brand_exclusive", verified: true, source: "curated", hours: "Mon–Fri 08–18" },
  { id: "ch-009", name: "Mall of Sousse", gouv: "Sousse", lat: 35.826, lng: 10.598, connectors: ["t2", "ccs"], power: 50, status: "operational", access: "public", verified: true, source: "ocm", hours: "Mon–Sun 09–23" },
  { id: "ch-010", name: "Aéroport Monastir", gouv: "Monastir", lat: 35.758, lng: 10.755, connectors: ["ccs", "chademo"], power: 150, status: "operational", access: "public", verified: false, source: "ocm", hours: "24/7" },
  { id: "ch-011", name: "Tunisia Mall", gouv: "Tunis", lat: 36.849, lng: 10.226, connectors: ["t2", "ccs"], power: 100, status: "operational", access: "public", verified: true, source: "curated", hours: "Mon–Sun 09–23" },
  { id: "ch-012", name: "Hôtel Diar Lemdina Hammamet", gouv: "Nabeul", lat: 36.371, lng: 10.541, connectors: ["t2"], power: 22, status: "under_repair", access: "customers_only", verified: true, source: "community", hours: "24/7" },
];

export const STATUS_COLORS: Record<ChargerStatus, string> = {
  operational: "#10B981",
  under_repair: "#F59E0B",
  planned: "#6366F1",
  unknown: "#71717A",
};

export const CONNECTOR_COLORS: Record<ConnectorKey, string> = {
  t2: "#3B82F6",
  ccs: "#8B5CF6",
  chademo: "#EC4899",
  t1: "#71717A",
};

export const CONNECTOR_LABELS: Record<ConnectorKey, string> = {
  t2: "Type 2",
  ccs: "CCS",
  chademo: "CHAdeMO",
  t1: "Type 1",
};
