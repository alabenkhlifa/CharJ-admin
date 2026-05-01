import type { CSSProperties } from "react";
import {
  AreaChart,
  StackedBarChart,
  Histogram,
  Donut,
  Funnel,
  StackedHBar,
} from "../components/charts";
import { Card, CardHeader } from "../components/card";
import { TunisiaMap } from "../components/tunisia-map";
import { Icons } from "../lib/icons";
import { fmt } from "../data/mock";
import { useOverviewStats } from "../data/overview-stats";
import { useOverviewCharts } from "../data/overview-charts";

type LiveKpi = {
  id: string;
  label: string;
  value: string;
  hint?: string;
  accent?: "teal" | "green" | "amber" | "indigo";
};

const accentVar: Record<NonNullable<LiveKpi["accent"]>, string> = {
  teal: "var(--accent)",
  green: "var(--green)",
  amber: "var(--amber)",
  indigo: "var(--indigo)",
};

const LiveKpiCard = ({ k, loading }: { k: LiveKpi; loading: boolean }) => {
  const accentColor = k.accent ? accentVar[k.accent] : "var(--accent)";
  return (
    <div
      style={{
        background: "var(--bg-elev)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: 110,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          insetInlineStart: 0,
          top: 0,
          width: 3,
          height: 28,
          background: accentColor,
          opacity: 0.6,
          borderRadius: "0 2px 2px 0",
        }}
      />
      <div
        style={{
          fontSize: 12,
          color: "var(--text-muted)",
          letterSpacing: "0.02em",
          textTransform: "uppercase",
          fontWeight: 500,
        }}
      >
        {k.label}
      </div>
      {loading ? (
        <div className="skeleton" style={{ height: 30, width: "60%" }} />
      ) : (
        <div
          className="num"
          style={{
            fontSize: 30,
            fontWeight: 600,
            color: "var(--text)",
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
        >
          {k.value}
        </div>
      )}
      {k.hint && !loading && (
        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{k.hint}</div>
      )}
    </div>
  );
};

const LiveKpiGrid = ({ stats }: { stats: ReturnType<typeof useOverviewStats> }) => {
  const { data, loading } = stats;
  const cards: LiveKpi[] = [
    {
      id: "total",
      label: "Total chargers",
      value: fmt(data.totalChargers),
      hint: `+${fmt(data.newChargersThisWeek)} this week`,
      accent: "teal",
    },
    {
      id: "operational",
      label: "Operational",
      value: `${data.operationalPct.toFixed(1)}%`,
      hint: `${fmt(Math.round((data.totalChargers * data.operationalPct) / 100))} of ${fmt(data.totalChargers)}`,
      accent: "green",
    },
    {
      id: "verified",
      label: "Verified",
      value: `${data.verifiedPct.toFixed(1)}%`,
      hint: `${fmt(data.verifiedThisWeek)} verified this week`,
      accent: "teal",
    },
    {
      id: "public",
      label: "Public access",
      value: fmt(data.publicCount),
      hint: data.totalChargers
        ? `${((data.publicCount / data.totalChargers) * 100).toFixed(0)}% of catalogue`
        : undefined,
      accent: "teal",
    },
    {
      id: "pending",
      label: "Pending submissions",
      value: fmt(data.pendingSubmissions),
      hint: "Community queue",
      accent: data.pendingSubmissions > 0 ? "amber" : "teal",
    },
    {
      id: "rating",
      label: "Avg rating",
      value: data.avgRating == null ? "—" : data.avgRating.toFixed(2),
      hint:
        data.ratingsCount > 0
          ? `${fmt(data.ratingsCount)} reviews`
          : "No reviews yet",
      accent: "amber",
    },
  ];

  return (
    <div
      className="kpi-grid"
      style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}
    >
      {cards.map((k) => (
        <LiveKpiCard key={k.id} k={k} loading={loading} />
      ))}
    </div>
  );
};

const kvLbl: CSSProperties = {
  fontSize: 10,
  color: "var(--text-dim)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const ChartSkeleton = ({ height = 210 }: { height?: number }) => (
  <div className="skeleton" style={{ width: "100%", height, borderRadius: 6 }} />
);

const todayLabel = () =>
  new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

export const OverviewPage = () => {
  const stats = useOverviewStats();
  const charts = useOverviewCharts();
  const c = charts.data;
  const chartsLoading = charts.loading;

  // Approval rate from the live submissions funnel (approved / (approved + rejected)).
  const approved = c.funnel.find((f) => f.stage === "Approved")?.value ?? 0;
  const rejected = c.funnel.find((f) => f.stage === "Rejected")?.value ?? 0;
  const decided = approved + rejected;
  const approvalRate = decided === 0 ? null : (approved / decided) * 100;

  const totalForStatusSubtitle = c.statusDonut.reduce((s, d) => s + d.value, 0);

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-dim)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            {todayLabel()}
          </div>
          <h1
            style={{
              margin: "4px 0 0",
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "var(--text)",
            }}
          >
            Charj Overview
          </h1>
          <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
            {stats.loading ? (
              <span style={{ color: "var(--text-dim)" }}>Loading…</span>
            ) : stats.data.pendingSubmissions > 0 ? (
              <>
                <span className="num" style={{ color: "var(--amber)" }}>
                  {stats.data.pendingSubmissions}
                </span>{" "}
                pending {stats.data.pendingSubmissions === 1 ? "submission" : "submissions"}{" "}
                waiting for review.
              </>
            ) : (
              <>No pending submissions — you're caught up.</>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 500,
              background: "var(--bg-elev)",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
              borderRadius: 8,
            }}
          >
            <Icons.Download size={12} /> Export
          </button>
          <button
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 500,
              background: "var(--accent)",
              border: "1px solid var(--accent)",
              color: "#0a0a0b",
              borderRadius: 8,
            }}
          >
            <Icons.Plus size={12} stroke={2.4} /> Add charger
          </button>
        </div>
      </div>

      <LiveKpiGrid stats={stats} />

      {stats.error && (
        <div
          style={{
            padding: 12,
            border: "1px solid color-mix(in srgb, var(--red) 35%, transparent)",
            background: "color-mix(in srgb, var(--red) 10%, transparent)",
            borderRadius: 8,
            color: "var(--red)",
            fontSize: 12,
          }}
        >
          Failed to load stats: {stats.error}
        </div>
      )}

      {charts.error && (
        <div
          style={{
            padding: 12,
            border: "1px solid color-mix(in srgb, var(--red) 35%, transparent)",
            background: "color-mix(in srgb, var(--red) 10%, transparent)",
            borderRadius: 8,
            color: "var(--red)",
            fontSize: 12,
          }}
        >
          Failed to load charts: {charts.error}
        </div>
      )}

      <div
        className="row-2"
        style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 12 }}
      >
        <Card>
          <CardHeader
            title="Chargers by status"
            subtitle={
              chartsLoading
                ? "Loading…"
                : `Snapshot · ${fmt(totalForStatusSubtitle)} total`
            }
            periodSelector={false}
          />
          {chartsLoading ? (
            <ChartSkeleton height={180} />
          ) : c.statusDonut.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-dim)", padding: 24 }}>
              No chargers yet.
            </div>
          ) : (
            <Donut data={c.statusDonut} size={180} thickness={20} />
          )}
        </Card>
        <Card>
          <CardHeader title="Chargers by connector type" subtitle="Stacked, last 8 months" />
          {chartsLoading ? (
            <ChartSkeleton height={210} />
          ) : (
            <>
              <StackedBarChart
                data={c.connectorStack}
                xKey="m"
                keys={c.connectorKeys}
                height={210}
              />
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10 }}>
                {c.connectorKeys.map((k) => (
                  <div
                    key={k.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 11,
                      color: "var(--text-muted)",
                    }}
                  >
                    <span
                      style={{ width: 8, height: 8, borderRadius: 2, background: k.color }}
                    />
                    {k.label}
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      <div
        className="row-2"
        style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12 }}
      >
        <Card>
          <CardHeader title="Power distribution" subtitle="Across all chargers" />
          {chartsLoading ? (
            <ChartSkeleton height={210} />
          ) : (
            <Histogram data={c.powerHist} height={210} />
          )}
        </Card>
        <Card>
          <CardHeader
            title="Access type"
            subtitle="Split across catalogue"
            periodSelector={false}
          />
          {chartsLoading ? (
            <ChartSkeleton height={120} />
          ) : c.accessSplit.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-dim)", padding: 24 }}>
              No chargers yet.
            </div>
          ) : (
            <StackedHBar data={c.accessSplit} />
          )}
        </Card>
      </div>

      <Card style={{ minHeight: 460 }}>
        <CardHeader
          title="Tunisia coverage"
          subtitle="Live charger map · 24 gouvernorats"
          periodSelector={false}
        />
        <TunisiaMap height={400} />
      </Card>

      <div
        className="row-2"
        style={{ display: "grid", gridTemplateColumns: "0.9fr 1.4fr", gap: 12 }}
      >
        <Card>
          <CardHeader
            title="Submissions funnel"
            subtitle="Community queue"
            periodSelector={false}
          />
          {chartsLoading ? (
            <ChartSkeleton height={160} />
          ) : c.funnel.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-dim)", padding: 24 }}>
              No submissions yet.
            </div>
          ) : (
            <Funnel data={c.funnel} />
          )}
          <div
            style={{
              marginTop: 16,
              padding: 12,
              background: "var(--bg-elev-2)",
              borderRadius: 6,
              border: "1px solid var(--border)",
            }}
          >
            <div style={kvLbl}>Approval rate</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
              <span
                className="num"
                style={{ fontSize: 22, color: "var(--text)", fontWeight: 600 }}
              >
                {approvalRate == null ? "—" : `${approvalRate.toFixed(1)}%`}
              </span>
              <span className="num" style={{ fontSize: 11, color: "var(--text-dim)" }}>
                {decided === 0 ? "no decisions yet" : `${fmt(decided)} decided`}
              </span>
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Rating trend" subtitle="Weekly avg · 12 weeks" />
          {chartsLoading ? (
            <ChartSkeleton height={200} />
          ) : c.ratingTrend.every((r) => r.v === 0) ? (
            <div style={{ fontSize: 12, color: "var(--text-dim)", padding: 24 }}>
              No ratings in the last 12 weeks.
            </div>
          ) : (
            <AreaChart
              data={c.ratingTrend}
              xKey="w"
              yKey="v"
              color="var(--amber)"
              height={200}
              formatY={(v) => v.toFixed(1)}
            />
          )}
        </Card>
      </div>
    </div>
  );
};
