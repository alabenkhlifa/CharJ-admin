import { Card } from "../components/card";

type Row = [string, string, number, number, number, string, "admin" | "user"];

const ROWS: Row[] = [
  ["amine.dkhili@charj.tn", "Mar 2024", 1, 14, 38, "now", "admin"],
  ["leila.mansour@charj.tn", "Apr 2024", 2, 8, 24, "5m ago", "admin"],
  ["salma.k@gmail.com", "Jun 2024", 1, 21, 4, "1h ago", "user"],
  ["mehdi.s@gmail.com", "Aug 2024", 2, 12, 7, "2h ago", "user"],
  ["nadia.t@yahoo.fr", "Sep 2024", 1, 6, 1, "1d ago", "user"],
  ["ahmed.b@hotmail.com", "Nov 2024", 3, 18, 9, "3d ago", "user"],
];

const HEAD = ["Email", "Joined", "Vehicles", "Reviews", "Submissions", "Last active", "Role"];

export const UsersPage = () => (
  <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Users</h1>
    <Card padding={0}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {HEAD.map((h) => (
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
          {ROWS.map((r, i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
              {r.map((c, j) => {
                const isNum = j === 1 || j === 2 || j === 3 || j === 4;
                const isRole = j === 6;
                return (
                  <td
                    key={j}
                    className={isNum ? "num" : ""}
                    style={{
                      padding: "12px 16px",
                      color: j === 0 ? "var(--text)" : "var(--text-muted)",
                    }}
                  >
                    {isRole ? (
                      <span
                        style={{
                          fontSize: 10,
                          padding: "2px 8px",
                          borderRadius: 3,
                          background:
                            c === "admin" ? "var(--accent-soft)" : "var(--bg-elev-2)",
                          color: c === "admin" ? "var(--accent)" : "var(--text-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {c}
                      </span>
                    ) : (
                      c
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  </div>
);
