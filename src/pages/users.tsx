import { Card, EmptyState } from "../components/card";

export const UsersPage = () => (
  <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Users</h1>
    <Card padding={0}>
      <EmptyState
        title="User directory needs an admin function"
        subtitle="Supabase auth.users isn't exposed via PostgREST — wire a Supabase Edge Function with the Admin SDK to surface user accounts."
      />
    </Card>
  </div>
);
