import { useState } from "react";
import { Sidebar, Topbar } from "./components/shell";
import { useTweaks } from "./lib/theme";
import type { RouteKey } from "./lib/routes";
import { OverviewPage } from "./pages/overview";
import { ChargersPage } from "./pages/chargers";
import { SubmissionsPage } from "./pages/submissions";
import { FeedbackPage } from "./pages/feedback";
import { ReviewsPage } from "./pages/reviews";
import { UsersPage } from "./pages/users";
import { VehiclesPage } from "./pages/vehicles";
import { MapPage } from "./pages/map";
import { SettingsPage } from "./pages/settings";

const ROUTE_COMPONENTS: Record<RouteKey, () => React.ReactElement> = {
  overview: OverviewPage,
  chargers: ChargersPage,
  submissions: SubmissionsPage,
  feedback: FeedbackPage,
  reviews: ReviewsPage,
  users: UsersPage,
  vehicles: VehiclesPage,
  map: MapPage,
  settings: SettingsPage,
};

const App = () => {
  const [tweaks, setTweak] = useTweaks();
  const [active, setActive] = useState<RouteKey>("overview");
  const [collapsed, setCollapsed] = useState(false);

  const Page = ROUTE_COMPONENTS[active];
  const padding = tweaks.density === "compact" ? "20px 24px" : "28px 32px";

  return (
    <div
      data-screen-label={`Charj Admin · ${active}`}
      style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}
    >
      <Sidebar
        active={active}
        onNav={setActive}
        density={tweaks.density}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <Topbar
          theme={tweaks.theme}
          setTheme={(v) => setTweak("theme", v)}
          active={active}
        />
        <main style={{ flex: 1, padding, overflow: "auto" }}>
          <Page />
        </main>
      </div>
    </div>
  );
};

export default App;
