import type { CSSProperties } from "react";
import {
  AreaChart,
  StackedAreaChart,
  StackedBarChart,
  Histogram,
  HBarList,
  Donut,
  Funnel,
  StackedHBar,
  iconBtnStyle,
} from "../components/charts";
import { Card, CardHeader } from "../components/card";
import { TunisiaMap } from "../components/tunisia-map";
import { Icons } from "../lib/icons";
import {
  STATUS_DONUT,
  CONNECTOR_STACK,
  CONNECTOR_KEYS,
  POWER_HIST,
  GOUV,
  ACCESS_SPLIT,
  FUNNEL,
  FEEDBACK_AREA,
  FEEDBACK_KEYS,
  RATING_TREND,
  VERIFY_VELOCITY,
  TOP_REQUESTED,
  OCM_SYNC,
  ACTIVITY,
  fmt,
} from "../data/mock";
import { useOverviewStats } from "../data/overview-stats";

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

const ActivityFeed = () => {
  const toneBg: Record<string, string> = {
    green: "rgba(16, 185, 129, .12)",
    teal: "rgba(11, 216, 182, .12)",
    amber: "rgba(245, 158, 11, .12)",
    indigo: "rgba(99, 102, 241, .12)",
    red: "rgba(239, 68, 68, .12)",
  };
  const toneFg: Record<string, string> = {
    green: "var(--green)",
    teal: "var(--accent)",
    amber: "var(--amber)",
    indigo: "var(--indigo)",
    red: "var(--red)",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {ACTIVITY.map((a, i) => {
        const Ic = Icons[a.icon] ?? Icons.Bell;
        return (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "28px 1fr auto",
              gap: 10,
              padding: "10px 0",
              borderBottom:
                i === ACTIVITY.length - 1 ? "none" : "1px solid var(--border)",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                display: "grid",
                placeItems: "center",
                background: toneBg[a.tone],
                color: toneFg[a.tone],
                borderRadius: 6,
              }}
            >
              <Ic size={13} />
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                <span style={{ fontWeight: 500 }}>{a.who}</span>{" "}
                <span style={{ color: "var(--text-muted)" }}>{a.action}</span>{" "}
                <span style={{ color: "var(--text)" }}>{a.target}</span>
              </div>
              <div style={{ fontSize: 10, color: "var(--text-dim)" }}>{a.t}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const OcmSyncCard = () => {
  const s = OCM_SYNC;
  return (
    <Card padding={16} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            OpenChargeMap sync
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--green)",
                boxShadow: "0 0 0 4px rgba(16,185,129,.18)",
              }}
            />
            <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>Healthy</span>
          </div>
        </div>
        <button
          style={{ ...iconBtnStyle, width: 30, height: 30, color: "var(--accent)" }}
          title="Sync now"
        >
          <Icons.Sync size={14} />
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div>
          <div style={kvLbl}>Last sync</div>
          <div className="num" style={kvVal}>
            {s.lastSync}
          </div>
        </div>
        <div>
          <div style={kvLbl}>Rows updated</div>
          <div className="num" style={kvVal}>
            {s.rowsUpdated}
          </div>
        </div>
        <div>
          <div style={kvLbl}>Conflicts</div>
          <div className="num" style={{ ...kvVal, color: "var(--amber)" }}>
            {s.conflicts}
          </div>
        </div>
      </div>
      <button
        style={{
          background: "var(--bg-elev-2)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)",
          fontSize: 11,
          padding: "8px 10px",
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>Resolve {s.conflicts} pending overrides</span>
        <Icons.ChevronRight size={12} />
      </button>
    </Card>
  );
};

const kvLbl: CSSProperties = {
  fontSize: 10,
  color: "var(--text-dim)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};
const kvVal: CSSProperties = {
  fontSize: 14,
  color: "var(--text)",
  marginTop: 4,
  fontWeight: 500,
};

const todayLabel = () =>
  new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

export const OverviewPage = () => {
  const stats = useOverviewStats();
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

      <div
        className="row-3"
        style={{ display: "grid", gridTemplateColumns: "1.1fr 1.4fr 1fr", gap: 12 }}
      >
        <Card>
          <CardHeader title="Chargers by status" subtitle="Snapshot · 412 total" periodSelector={false} />
          <Donut data={STATUS_DONUT} size={180} thickness={20} />
        </Card>
        <Card>
          <CardHeader title="Chargers by connector type" subtitle="Stacked, last 8 months" />
          <StackedBarChart data={CONNECTOR_STACK} xKey="m" keys={CONNECTOR_KEYS} height={210} />
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10 }}>
            {CONNECTOR_KEYS.map((k) => (
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
        </Card>
        <OcmSyncCard />
      </div>

      <div
        className="row-3"
        style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 0.9fr", gap: 12 }}
      >
        <Card>
          <CardHeader title="Power distribution" subtitle="Across all chargers" />
          <Histogram data={POWER_HIST} height={210} />
        </Card>
        <Card>
          <CardHeader
            title="Coverage by gouvernorat"
            subtitle="Top 10 · total / operational"
            periodSelector={false}
          />
          <HBarList data={GOUV} valueKey="count" labelKey="name" showOp />
          <div
            style={{
              display: "flex",
              gap: 14,
              marginTop: 12,
              fontSize: 11,
              color: "var(--text-dim)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: "var(--accent)",
                  opacity: 0.85,
                }}
              />{" "}
              All chargers
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: "var(--green)",
                  opacity: 0.55,
                }}
              />{" "}
              Operational
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Access type" subtitle="Split across catalogue" periodSelector={false} />
          <StackedHBar data={ACCESS_SPLIT} />
        </Card>
      </div>

      <div className="row-2" style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 12 }}>
        <Card style={{ minHeight: 460 }}>
          <CardHeader
            title="Tunisia coverage"
            subtitle="Live charger map · 24 gouvernorats"
            periodSelector={false}
          />
          <TunisiaMap height={400} />
        </Card>
        <Card>
          <CardHeader title="Recent activity" subtitle="Across admin team" periodSelector={false} />
          <ActivityFeed />
        </Card>
      </div>

      <div className="row-2" style={{ display: "grid", gridTemplateColumns: "0.9fr 1.4fr", gap: 12 }}>
        <Card>
          <CardHeader title="Submissions funnel" subtitle="Last 30 days" periodSelector={false} />
          <Funnel data={FUNNEL} />
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
                66.7%
              </span>
              <span className="num" style={{ fontSize: 11, color: "var(--green)" }}>
                +4.2pp WoW
              </span>
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Feedback by category" subtitle="Stacked, last 12 weeks" />
          <StackedAreaChart data={FEEDBACK_AREA} xKey="w" keys={FEEDBACK_KEYS} height={220} />
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8 }}>
            {FEEDBACK_KEYS.map((k) => (
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
        </Card>
      </div>

      <div className="row-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <Card>
          <CardHeader title="Rating trend" subtitle="Weekly avg · 12 weeks" />
          <AreaChart
            data={RATING_TREND}
            xKey="w"
            yKey="v"
            color="var(--amber)"
            height={200}
            formatY={(v) => v.toFixed(1)}
          />
        </Card>
        <Card>
          <CardHeader title="Verification velocity" subtitle="Chargers verified per week" />
          <AreaChart
            data={VERIFY_VELOCITY}
            xKey="w"
            yKey="count"
            color="var(--accent)"
            height={200}
            formatY={(v) => String(Math.round(v))}
          />
          <div
            style={{
              display: "flex",
              gap: 12,
              marginTop: 8,
              fontSize: 11,
              color: "var(--text-muted)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "var(--indigo)",
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 9,
                  fontWeight: 600,
                }}
              >
                A
              </span>
              Amine · 79
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "var(--accent)",
                  color: "#0a0a0b",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 9,
                  fontWeight: 600,
                }}
              >
                L
              </span>
              Leila · 28
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader
            title="Most requested locations"
            subtitle="From community submissions"
            periodSelector={false}
          />
          <HBarList data={TOP_REQUESTED} valueKey="count" labelKey="name" />
        </Card>
      </div>
    </div>
  );
};
