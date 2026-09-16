import { Sidebar, Topbar } from "./components/shell";
import { useTweaks } from "./lib/theme";
import { useIsMobile } from "./lib/use-is-mobile";
import { useRoute } from "./lib/use-route";
import type { RouteKey } from "./lib/routes";
import { useSidebarCounts } from "./data/sidebar-counts";
import { useState } from "react";
import { OverviewPage } from "./pages/overview";
import { ChargersPage } from "./pages/chargers";
import { SubmissionsPage } from "./pages/submissions";
import { FeedbackPage } from "./pages/feedback";
import { ReviewsPage } from "./pages/reviews";
import { VisitsPage } from "./pages/visits";
import { UsersPage } from "./pages/users";
import { VehiclesPage } from "./pages/vehicles";
import { MapPage } from "./pages/map";
import { SettingsPage } from "./pages/settings";
import { AnalyticsPage } from "./pages/analytics";

// Pages with no route params render straight from here. Chargers, Visits and
// Users read/write the hash query string, so they're wired up explicitly below.
const ROUTE_COMPONENTS: Record<RouteKey, () => React.ReactElement> = {
  overview: OverviewPage,
  analytics: AnalyticsPage,
  chargers: ChargersPage,
  submissions: SubmissionsPage,
  feedback: FeedbackPage,
  reviews: ReviewsPage,
  visits: VisitsPage,
  users: UsersPage,
  vehicles: VehiclesPage,
  map: MapPage,
  settings: SettingsPage,
};

const App = () => {
  const [tweaks, setTweak] = useTweaks();
  // The active page lives in the URL hash, so a refresh (or a bookmark, or a
  // link pasted to someone else) lands on the same page instead of Overview.
  const { route, params, navigate, replace } = useRoute();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isMobile = useIsMobile();
  const { data: countsData, loading: countsLoading } = useSidebarCounts();
  // While loading we pass `undefined` so the sidebar simply omits badges
  // rather than flashing a 0 → real-number sequence.
  const sidebarCounts = countsLoading ? undefined : countsData;

  // Cross-page deep links, now carried by the URL rather than React state:
  //   #/chargers?id=<uuid>  — open that charger's detail drawer on mount
  //   #/users?user=<uuid>   — pin the Users table to a single driver
  const pendingChargerId = route === "chargers" ? params.get("id") : null;
  const userLookup = route === "users" ? (params.get("user") ?? "") : "";

  const Page = ROUTE_COMPONENTS[route];
  const padding = isMobile
    ? "16px 14px"
    : tweaks.density === "compact"
      ? "20px 24px"
      : "28px 32px";

  const renderPage = () => {
    switch (route) {
      case "chargers":
        return (
          <ChargersPage
            pendingChargerId={pendingChargerId}
            // Drop the id once consumed so closing the drawer and navigating
            // back doesn't silently reopen it.
            onChargerOpened={() => replace("chargers")}
          />
        );
      case "visits":
        return <VisitsPage onOpenDriver={(userId) => navigate("users", { user: userId })} />;
      case "users":
        return <UsersPage lookup={userLookup} onClearLookup={() => replace("users")} />;
      default:
        return <Page />;
    }
  };

  return (
    <div
      data-screen-label={`Charj Admin · ${route}`}
      style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}
    >
      <Sidebar
        active={route}
        onNav={(k) => navigate(k)}
        density={tweaks.density}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        isMobile={isMobile}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        counts={sidebarCounts}
      />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <Topbar
          theme={tweaks.theme}
          setTheme={(v) => setTweak("theme", v)}
          active={route}
          isMobile={isMobile}
          onOpenMenu={() => setMobileNavOpen(true)}
          onNavigate={(k) => navigate(k)}
          onOpenCharger={(id) => navigate("chargers", { id })}
        />
        <main style={{ flex: 1, padding, overflow: "auto" }}>{renderPage()}</main>
      </div>
    </div>
  );
};

export default App;
