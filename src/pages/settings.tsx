import { Card } from "../components/card";

export const SettingsPage = () => (
  <div className="fade-in">
    <h1 style={{ margin: "0 0 16px", fontSize: 22, fontWeight: 600 }}>Settings</h1>
    <Card>
      <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
        Workspace, integrations, OCM API keys, admin roles…
      </div>
    </Card>
  </div>
);
