import { useEffect, useState, type ReactNode } from "react";
import {
  useAdminUsers,
  type AdminUser,
  type AdminUserDevice,
  type AdminUserVehicle,
  type AdminUsersFilter,
} from "../data/admin-users";
import { formatRelative } from "../data/reviews";
import type { RouteParams } from "../lib/use-route";
import { Empty } from "../ui/empty";
import { HealthCard } from "../ui/health-card";
import { Pager } from "../ui/pager";
import { Pill } from "../ui/pill";
import { Segmented } from "../ui/segmented";
import { Note, RetryLine, UsageIcon, Waiting } from "./usage-bits";
import { platformName } from "./usage-labels";

// Usage → Users: the old Users page (admin-users Edge Function), in the Health
// Rings look. Every view choice lives in the URL: ?show=engaged, ?page=,
// ?per= and the ?user= lookup from Driver visits.

const SIZES = [10, 25, 50, 100] as const;
const DEFAULT_PER = 25;
const nf = new Intl.NumberFormat("en-US");

const SHOW_OPTIONS: { v: AdminUsersFilter; l: string }[] = [
  { v: "all", l: "All sessions" },
  { v: "engaged", l: "Engaged only" },
];

const ago = (iso: string | null) => {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "—";
  const min = Math.round(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

const primaryOf = (vehicles: AdminUserVehicle[]) => vehicles.find((v) => v.is_primary) ?? vehicles[0] ?? null;

/** Click to copy the full id; the short id is what shows. */
const UserId = ({ id }: { id: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(id).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 900);
  };
  return (
    <button type="button" className="use-id" onClick={copy} title={id} aria-label={`Copy user id ${id}`}>
      {copied ? "Copied" : `${id.slice(0, 8)}…`}
    </button>
  );
};

// Model / OS / screen come from the newest analytics event and only exist for
// builds that carry the device context; older rows show the platform alone.
const deviceText = (d: AdminUserDevice) => {
  const screen = d.screenWidth && d.screenHeight ? `${d.screenWidth}×${d.screenHeight}${d.screenScale ? ` @${d.screenScale}x` : ""}` : null;
  return [d.model, screen, `v${d.appVersion}`].filter(Boolean).join(" · ");
};
const platformPill = (d: AdminUserDevice) => `${platformName(d.platform)}${d.osVersion ? ` ${d.osVersion}` : ""}`;

const carText = (vehicles: AdminUserVehicle[]) => {
  const car = primaryOf(vehicles);
  if (!car) return null;
  const more = vehicles.length - 1;
  return `${car.make} ${car.model}${car.variant ? ` ${car.variant}` : ""}${more > 0 ? ` +${more}` : ""}`;
};

const activityText = (u: AdminUser) =>
  u.eventsCount === 0 ? null : `${nf.format(u.sessionsCount)} ${u.sessionsCount === 1 ? "session" : "sessions"}`;

/** Phones and narrow cards: two lines per user. */
const UserItem = ({ user: u }: { user: AdminUser }) => {
  const car = carText(u.vehicles);
  const activity = activityText(u);
  const facts = [
    car,
    u.visitsCount ? `${nf.format(u.visitsCount)} ${u.visitsCount === 1 ? "visit" : "visits"}` : null,
    activity,
    `joined ${ago(u.createdAt)}`,
  ].filter(Boolean);
  return (
    <li className="use-user">
      <div className="use-user-top">
        <span className="use-user-who">
          <UserId id={u.id} />
          {u.device && <Pill>{platformPill(u.device)}</Pill>}
        </span>
        <span className="use-user-when">{ago(u.lastSignInAt)}</span>
      </div>
      <p className="use-d">{u.device ? deviceText(u.device) : "No usage data"}</p>
      <p className="use-d">{facts.join(" · ")}</p>
    </li>
  );
};

const Dim = ({ children }: { children: ReactNode }) => <span className="use-dim">{children}</span>;

/** Wide cards: the table. */
const UserTable = ({ users }: { users: AdminUser[] }) => (
  <div className="use-users-table">
    <table className="ui-table">
      <caption className="ui-sr">Users</caption>
      <thead>
        <tr>
          {["User", "Device", "Car", "Visits", "Activity", "Joined", "Last active"].map((h, i) => (
            <th key={h} scope="col" className={i === 3 ? "ui-end" : undefined}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr key={u.id}>
            <td>
              <UserId id={u.id} />
            </td>
            <td>
              {u.device ? (
                <>
                  <Pill>{platformPill(u.device)}</Pill>
                  <span className="use-d">{deviceText(u.device)}</span>
                </>
              ) : (
                <Dim>No usage data</Dim>
              )}
            </td>
            <td>{carText(u.vehicles) ?? <Dim>—</Dim>}</td>
            <td className="ui-end">{u.visitsCount ? nf.format(u.visitsCount) : <Dim>0</Dim>}</td>
            <td>
              {activityText(u) ?? <Dim>—</Dim>}
              {u.eventsCount > 0 && <span className="use-d">{u.device ? formatRelative(u.device.lastEventAt) : `${nf.format(u.eventsCount)} events`}</span>}
            </td>
            <td className="use-nw">{ago(u.createdAt)}</td>
            <td className="use-nw">{ago(u.lastSignInAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

type Props = {
  params: URLSearchParams;
  onParams: (patch: RouteParams) => void;
};

const positive = (value: string | null, fallback: number) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

export const UsersSection = ({ params, onParams }: Props) => {
  const lookup = params.get("user") ?? "";
  const show: AdminUsersFilter = params.get("show") === "engaged" ? "engaged" : "all";
  const per = (SIZES as readonly number[]).includes(Number(params.get("per"))) ? Number(params.get("per")) : DEFAULT_PER;
  const page = positive(params.get("page"), 1);
  const { data: users, total, loading, error, refresh } = useAdminUsers(page, per, show, lookup);
  // A ?page= past the end (a shorter list since, or a hand-edited link) moves
  // to the last page once the total is known, as the catalog does.
  const last = Math.max(1, Math.ceil(total / per));
  const past = !loading && !error && total > 0 && page > last;
  useEffect(() => {
    if (past) onParams({ page: last > 1 ? String(last) : null });
  }, [past, last, onParams]);

  const scope = lookup
    ? "One driver, from Driver visits."
    : show === "engaged"
      ? "Sessions with analytics, a saved car or a visit report."
      : "Every anonymous session.";

  let body: ReactNode;
  if (loading || past) body = <Waiting size="list">Loading…</Waiting>;
  else if (error) body = <RetryLine onRetry={refresh}>Couldn't load users: {error}</RetryLine>;
  else if (!users.length)
    body = (
      <Empty size="body">
        {lookup
          ? "No user with that id. The session may have been pruned since the report was sent."
          : "No users yet. When someone opens the app, their anonymous session appears here."}
      </Empty>
    );
  else
    body = (
      <>
        <ul className="use-users">
          {users.map((u) => (
            <UserItem key={u.id} user={u} />
          ))}
        </ul>
        <UserTable users={users} />
      </>
    );

  return (
    <HealthCard
      title="Users"
      color="active"
      icon={<UsageIcon name="person" />}
      meta={!loading && !error ? `${nf.format(total)} ${lookup ? (total === 1 ? "driver" : "drivers") : total === 1 ? "session" : "sessions"}` : undefined}
      index={0}
      wide
    >
      <div className="use-users-bar">
        <Segmented label="Show" value={show} options={SHOW_OPTIONS} onChange={(v) => onParams({ show: v === "all" ? null : v, page: null })} />
        {lookup && (
          <span className="use-chip">
            Driver <bdi>{lookup.slice(0, 8)}…</bdi>
            <button type="button" onClick={() => onParams({ user: null, page: null })} aria-label="Show every user again">
              ×
            </button>
          </span>
        )}
        <button type="button" className="use-link" onClick={refresh} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <p className="use-cap">{scope} Reviews and submissions are left out: anonymous sign-ins rotate, so they rarely match a current session.</p>
      {body}
      {!error && total > 0 && !past && (
        <Pager
          label="Users"
          page={page}
          perPage={per}
          total={total}
          sizes={SIZES}
          busy={loading}
          onPage={(n) => onParams({ page: n > 1 ? String(n) : null })}
          onPerPage={(n) => onParams({ per: n === DEFAULT_PER ? null : String(n), page: null })}
        />
      )}
      <Note>
        Device details come from the newest usage event a session sent, and exist only for people who left analytics on. Model, OS
        version and screen size come from builds with the device-context update; older events show the platform only. Device names
        and hardware ids are never collected.
      </Note>
    </HealthCard>
  );
};
