import { useTweaks } from "./lib/theme";
import { useRoute } from "./lib/use-route";
import type { RouteParams } from "./lib/use-route";
import { Sidebar } from "./ui/sidebar";
import { TabBar } from "./ui/tab-bar";
import { SummaryPage } from "./pages/summary";
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
import { NotificationsPage } from "./pages/notifications";
import { useQueue } from "./data/queue";
import { parseUsageEnvironment } from "./data/usage-report";

const App = () => {
  const [tweaks, setTweak, resolvedTheme] = useTweaks();
  // The active page lives in the URL hash, so a refresh (or a bookmark, or a
  // link pasted to someone else) lands on the same page instead of Summary.
  const { route, params, navigate, replace } = useRoute();
  // What waits in Community: Summary's Needs you and the nav badge. Reloaded
  // on every page change, so working the queue in Community updates both.
  const queue = useQueue(route);
  const queueTotal = queue.data?.total ?? undefined;

  // Cross-page deep links, carried by the URL rather than React state:
  //   #/chargers?id=<uuid>             — open that charger's detail drawer
  //   #/usage?tab=users&user=<uuid>    — pin the Users table to one driver
  const pendingChargerId = route === "chargers" ? params.get("id") : null;
  const tab = params.get("tab");
  const userLookup = route === "usage" && tab === "users" ? (params.get("user") ?? "") : "";

  // Merge a patch into the current query string instead of replacing it. The
  // Chargers page keeps its search / filters / sort / page there too, so a
  // blind `replace("chargers")` would wipe the view out from under the user.
  const patchParams = (patch: RouteParams) => {
    const next: RouteParams = {};
    params.forEach((value, key) => {
      next[key] = value;
    });
    Object.assign(next, patch);
    replace(route, next);
  };

  // Until the new pages land (Tasks 8-11) each new route renders the page it
  // replaces, and the old sub-pages stay reachable through their tab param.
  const renderPage = () => {
    switch (route) {
      case "summary":
        return (
          <SummaryPage
            env={parseUsageEnvironment(params.get("env"))}
            onEnv={(env) => patchParams({ env })}
            queue={queue}
          />
        );
      case "usage":
        if (tab === "users") {
          return <UsersPage lookup={userLookup} onClearLookup={() => replace("usage", { tab: "users" })} />;
        }
        if (tab === "catalog") return <VehiclesPage />;
        return <AnalyticsPage />;
      case "community":
        if (tab === "submissions") return <SubmissionsPage />;
        if (tab === "reviews") return <ReviewsPage />;
        if (tab === "visits") {
          return (
            <VisitsPage
              onOpenDriver={(userId) => navigate("usage", { tab: "users", user: userId })}
            />
          );
        }
        return <FeedbackPage />;
      case "chargers":
        if (params.get("view") === "map") return <MapPage />;
        return (
          <ChargersPage
            params={params}
            onParamsChange={patchParams}
            pendingChargerId={pendingChargerId}
            // Drop the id once consumed so closing the drawer and navigating
            // back doesn't silently reopen it — but keep every other param.
            onChargerOpened={() => patchParams({ id: null })}
          />
        );
      case "notifications":
        return <NotificationsPage onOpenCharger={(id) => navigate("chargers", { id })} />;
      case "settings":
        return <SettingsPage />;
    }
  };

  return (
    <div
      className="shell"
      data-density={tweaks.density}
      data-screen-label={`Charj Admin · ${route}`}
    >
      <div className="shell-side">
        <Sidebar
          active={route}
          queueTotal={queueTotal}
          theme={tweaks.theme}
          resolvedTheme={resolvedTheme}
          onTheme={(v) => setTweak("theme", v)}
          onNavigate={(k) => navigate(k)}
          onOpenCharger={(id) => navigate("chargers", { id })}
        />
      </div>
      <main className="shell-main">{renderPage()}</main>
      <TabBar active={route} queueTotal={queueTotal} />
    </div>
  );
};

export default App;
