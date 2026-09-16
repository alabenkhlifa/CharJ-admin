import { useEffect, useState } from "react";
import { Card, EmptyState } from "../components/card";
import { DEFAULT_PAGE_SIZE, Pagination } from "../components/pagination";
import { SelectChip } from "../components/select-chip";
import { Icons } from "../lib/icons";
import { formatRelative } from "../data/reviews";
import {
  useAdminUsers,
  type AdminUser,
  type AdminUserDevice,
  type AdminUserVehicle,
  type AdminUsersFilter,
} from "../data/admin-users";

const fmtAgo = (iso: string | null) => {
  if (!iso) return "Never";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "—";
  const min = Math.round(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(iso).toLocaleDateString();
};

const MONO_FONT = "JetBrains Mono, ui-monospace, monospace";

// Reviews + Submissions intentionally absent. Charj uses anonymous Supabase
// auth; UIDs rotate when sessions expire, so rating.rater / submission
// .submitted_by almost never match a current auth.users row. Surfacing
// "0 / 0" for every user was misleading.
const COLUMNS = [
  "User ID",
  "Device",
  "Vehicle",
  "Visits",
  "Activity",
  "Joined",
  "Last active",
] as const;

const PLATFORM_COLORS: Record<string, string> = {
  android: "var(--green)",
  ios: "var(--blue)",
  web: "var(--violet)",
};

const PLATFORM_LABELS: Record<string, string> = {
  android: "Android",
  ios: "iOS",
  web: "Web",
};

const pickPrimary = (vehicles: AdminUserVehicle[]): AdminUserVehicle | null => {
  if (vehicles.length === 0) return null;
  const primary = vehicles.find((v) => v.is_primary);
  return primary ?? vehicles[0];
};

type UserIdCellProps = { id: string };

const UserIdCell = ({ id }: UserIdCellProps) => {
  const [flashed, setFlashed] = useState(false);
  const short = `${id.slice(0, 8)}…`;

  const onCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(id).catch(() => {});
    }
    setFlashed(true);
    window.setTimeout(() => setFlashed(false), 600);
  };

  return (
    <span
      className="num"
      onClick={onCopy}
      title={`Click to copy ${id}`}
      style={{
        cursor: "pointer",
        fontFamily: MONO_FONT,
        color: flashed ? "var(--accent)" : "var(--text)",
        transition: "color 200ms ease",
        fontWeight: 500,
      }}
    >
      {short}
    </span>
  );
};

// Device facts come from the newest analytics event. Model / OS / screen are
// only present on events sent by builds carrying the device-context change —
// older rows show the platform alone rather than a fabricated blank.
const DeviceCell = ({ device }: { device: AdminUserDevice | null }) => {
  if (!device) {
    return <span style={{ color: "var(--text-dim)" }}>No usage data</span>;
  }
  const color = PLATFORM_COLORS[device.platform] ?? "var(--slate)";
  const label = PLATFORM_LABELS[device.platform] ?? device.platform;
  const screen =
    device.screenWidth && device.screenHeight
      ? `${device.screenWidth}×${device.screenHeight}${device.screenScale ? ` @${device.screenScale}x` : ""}`
      : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            fontSize: 11,
            color,
            padding: "1px 7px",
            borderRadius: 4,
            background: `color-mix(in srgb, ${color} 14%, transparent)`,
            whiteSpace: "nowrap",
          }}
        >
          {label}
          {device.osVersion ? ` ${device.osVersion}` : ""}
        </span>
        <span className="num" style={{ fontSize: 11, color: "var(--text-dim)" }}>
          v{device.appVersion}
        </span>
      </span>
      {(device.model || screen) && (
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {device.model ?? "Unknown model"}
          {screen && (
            <span className="num" style={{ color: "var(--text-dim)" }}>
              {" · "}
              {screen}
            </span>
          )}
        </span>
      )}
    </div>
  );
};

const VehicleCell = ({ vehicles }: { vehicles: AdminUserVehicle[] }) => {
  const primary = pickPrimary(vehicles);
  if (!primary) {
    return <span style={{ color: "var(--text-dim)" }}>—</span>;
  }
  const extra = vehicles.length - 1;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text)" }}>
      <span style={{ fontWeight: 500 }}>
        {primary.make} {primary.model}
      </span>
      {primary.variant && (
        <span style={{ color: "var(--text-dim)", fontSize: 12 }}>{primary.variant}</span>
      )}
      {extra > 0 && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "1px 6px",
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 600,
            color: "var(--text-muted)",
            background: "color-mix(in srgb, var(--text) 8%, transparent)",
            border: "1px solid var(--border)",
          }}
        >
          +{extra}
        </span>
      )}
    </span>
  );
};

const ActivityCell = ({ user }: { user: AdminUser }) => {
  if (user.eventsCount === 0) {
    return <span style={{ color: "var(--text-dim)" }}>—</span>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span className="num" style={{ color: "var(--text)" }}>
        {user.sessionsCount} {user.sessionsCount === 1 ? "session" : "sessions"}
      </span>
      <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
        {user.device ? formatRelative(user.device.lastEventAt) : `${user.eventsCount} events`}
      </span>
    </div>
  );
};

const UserRow = ({ user: u }: { user: AdminUser }) => (
  <tr style={{ borderBottom: "1px solid var(--border)" }}>
    <td style={{ padding: "12px 16px" }}>
      <UserIdCell id={u.id} />
    </td>
    <td style={{ padding: "12px 16px" }}>
      <DeviceCell device={u.device} />
    </td>
    <td style={{ padding: "12px 16px" }}>
      <VehicleCell vehicles={u.vehicles ?? []} />
    </td>
    <td style={{ padding: "12px 16px" }} className="num">
      {u.visitsCount > 0 ? (
        <span style={{ color: "var(--accent)", fontWeight: 500 }}>{u.visitsCount}</span>
      ) : (
        <span style={{ color: "var(--text-dim)" }}>0</span>
      )}
    </td>
    <td style={{ padding: "12px 16px" }}>
      <ActivityCell user={u} />
    </td>
    <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{fmtAgo(u.createdAt)}</td>
    <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{fmtAgo(u.lastSignInAt)}</td>
  </tr>
);

type UsersPageProps = {
  lookup?: string;
  onClearLookup?: () => void;
};

export const UsersPage = ({ lookup = "", onClearLookup }: UsersPageProps = {}) => {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [filter, setFilter] = useState<AdminUsersFilter>("all");
  const {
    data: users,
    total,
    loading,
    error,
    refresh,
  } = useAdminUsers(page, perPage, filter, lookup);

  // A deep-link from Driver visits replaces whatever page we were on.
  useEffect(() => {
    if (lookup) setPage(1);
  }, [lookup]);

  const subtitle = lookup
    ? "Showing a single driver"
    : filter === "engaged"
      ? "Sessions with analytics, a saved vehicle, or a visit report"
      : "All anonymous sessions";

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>Users</h1>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
          {loading ? (
            <span style={{ color: "var(--text-dim)" }}>Loading…</span>
          ) : error ? (
            <span style={{ color: "var(--text-dim)" }}>Couldn't load users: {error}</span>
          ) : (
            <>
              <span className="num">{total}</span> {subtitle} ·{" "}
              <span style={{ color: "var(--text-dim)" }}>
                ratings + submissions hidden — orphaned by anon auth pruning
              </span>
            </>
          )}
        </div>
      </div>

      {error && !loading && (
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
          Couldn't load users: {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <SelectChip
          label="Show"
          value={filter}
          active={filter !== "all"}
          onChange={(v) => {
            setFilter(v);
            setPage(1);
          }}
          options={[
            { v: "all", l: "All sessions" },
            { v: "engaged", l: "Engaged only" },
          ]}
        />
        {lookup && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              borderRadius: 6,
              fontSize: 12,
              color: "var(--accent)",
              background: "var(--accent-soft)",
              border: "1px solid var(--accent-border)",
            }}
          >
            <span style={{ fontFamily: MONO_FONT }}>{lookup.slice(0, 8)}…</span>
            <button
              onClick={onClearLookup}
              aria-label="Clear driver filter"
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                color: "inherit",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Icons.X size={11} />
            </button>
          </span>
        )}
        <button
          onClick={refresh}
          disabled={loading}
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "7px 12px",
            fontSize: 11,
            color: "var(--text-muted)",
            fontFamily: "inherit",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Icons.Sync size={12} />
            {loading ? "Refreshing…" : "Refresh"}
          </span>
        </button>
      </div>

      <Card padding={0}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {COLUMNS.map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "start",
                      padding: "12px 16px",
                      fontSize: 10,
                      color: "var(--text-dim)",
                      fontWeight: 500,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                    {Array.from({ length: COLUMNS.length }).map((__, j) => (
                      <td key={j} style={{ padding: "12px 16px" }}>
                        <div className="skeleton" style={{ height: 12, width: j === 0 ? "70%" : "45%" }} />
                      </td>
                    ))}
                  </tr>
                ))}
              {!loading && !error && users.map((u) => <UserRow key={u.id} user={u} />)}
            </tbody>
          </table>
          {!loading && !error && users.length === 0 && (
            <EmptyState
              title={lookup ? "No user with that ID" : "No users yet"}
              subtitle={
                lookup
                  ? "The session may have been pruned since the report was submitted."
                  : "When someone opens the app, their anonymous session appears here."
              }
            />
          )}
        </div>
        {!error && total > 0 && (
          <Pagination
            page={page}
            perPage={perPage}
            total={total}
            onPageChange={setPage}
            onPerPageChange={(n) => {
              setPerPage(n);
              setPage(1);
            }}
            loading={loading}
          />
        )}
      </Card>

      <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5 }}>
        Device details come from the newest usage event a session sent, and exist only for
        users who left analytics enabled. Model, OS version and screen size populate from
        app builds carrying the device-context update; older events show the platform only.
        Device name and hardware identifiers are deliberately not collected.
      </div>
    </div>
  );
};
