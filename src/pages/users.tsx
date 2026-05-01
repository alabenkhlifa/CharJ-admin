import { Card, EmptyState } from "../components/card";
import { useAdminUsers } from "../data/admin-users";

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

const COLUMNS = [
  "Email",
  "Joined",
  "Last active",
  "Vehicles",
  "Reviews",
  "Submissions",
] as const;

export const UsersPage = () => {
  const { data: users, total, loading, error } = useAdminUsers();

  return (
    <div
      className="fade-in"
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "-0.02em",
          }}
        >
          Users
        </h1>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
          {loading ? (
            <span style={{ color: "var(--text-dim)" }}>Loading…</span>
          ) : error ? (
            <span style={{ color: "var(--text-dim)" }}>
              Couldn't load users: {error}
            </span>
          ) : (
            <>
              <span className="num">{total}</span> loaded
            </>
          )}
        </div>
      </div>

      {error && !loading && (
        <div
          style={{
            padding: 12,
            border:
              "1px solid color-mix(in srgb, var(--red) 35%, transparent)",
            background: "color-mix(in srgb, var(--red) 10%, transparent)",
            borderRadius: 8,
            color: "var(--red)",
            fontSize: 12,
          }}
        >
          Couldn't load users: {error}
        </div>
      )}

      <Card padding={0}>
        <div style={{ overflowX: "auto" }}>
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
          >
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
                  <tr
                    key={i}
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    {Array.from({ length: COLUMNS.length }).map((__, j) => (
                      <td key={j} style={{ padding: "12px 16px" }}>
                        <div
                          className="skeleton"
                          style={{
                            height: 12,
                            width: j === 0 ? "70%" : "40%",
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              {!loading &&
                !error &&
                users.map((u) => (
                  <tr
                    key={u.id}
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ color: "var(--text)", fontWeight: 500 }}>
                        {u.email ?? "—"}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        color: "var(--text-muted)",
                      }}
                    >
                      {fmtAgo(u.createdAt)}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        color: "var(--text-muted)",
                      }}
                    >
                      {fmtAgo(u.lastSignInAt)}
                    </td>
                    <td
                      style={{ padding: "12px 16px", color: "var(--text)" }}
                      className="num"
                    >
                      {u.vehiclesCount}
                    </td>
                    <td
                      style={{ padding: "12px 16px", color: "var(--text)" }}
                      className="num"
                    >
                      {u.ratingsCount}
                    </td>
                    <td
                      style={{ padding: "12px 16px", color: "var(--text)" }}
                      className="num"
                    >
                      {u.submissionsCount}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!loading && !error && users.length === 0 && (
            <EmptyState title="No users yet" />
          )}
        </div>
      </Card>
    </div>
  );
};
