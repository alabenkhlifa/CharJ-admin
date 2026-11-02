import { useTweaks } from "./lib/theme";
import { useRoute } from "./lib/use-route";
import type { RouteParams } from "./lib/use-route";
import { Sidebar } from "./ui/sidebar";
import { TabBar } from "./ui/tab-bar";
import { SummaryPage } from "./pages/summary";
import { ChargersPage } from "./pages/chargers";
import { CommunityPage } from "./pages/community";
import { SettingsPage } from "./pages/settings";
import { UsagePage } from "./pages/usage";
import { NotificationsPage } from "./pages/notifications";
import { useQueue } from "./data/queue";
import { parseUsageEnvironment } from "./data/usage-report";

const App = () => {
  // One shared store: the large-title toggle and Settings read it too.
  const [tweaks] = useTweaks();
  // The active page lives in the URL hash, so a refresh (or a bookmark, or a
  // link pasted to someone else) lands on the same page instead of Summary.
  const { route, params, navigate, replace } = useRoute();
  // What waits in Community: Summary's Needs you and the nav badge. Read once,
  // then after every Community action and when the window gets the focus
  // back; moving between pages reads nothing.
  const queue = useQueue();
  const queueTotal = queue.data?.total ?? undefined;

  // Cross-page deep links, carried by the URL rather than React state:
  //   #/chargers?id=<uuid>                — open that charger's detail drawer
  //   #/chargers?id=<uuid>&edit=1         — …straight in its editor (after approving a submission)
  //   #/usage?section=users&user=<uuid>   — pin the Users list to one driver
  //                                         (old links: ?tab=users&user=)
  const pendingChargerId = route === "chargers" ? params.get("id") : null;
  const pendingChargerEdit = pendingChargerId !== null && params.get("edit") === "1";

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
        return <UsagePage params={params} onParams={patchParams} />;
      case "community":
        return <CommunityPage params={params} onParams={patchParams} navigate={navigate} queue={queue} />;
      case "chargers":
        // ?view=map|stats are views of the same page (one charger read, one drawer).
        return (
          <ChargersPage
            params={params}
            onParamsChange={patchParams}
            pendingChargerId={pendingChargerId}
            pendingChargerEdit={pendingChargerEdit}
            // Drop the id once consumed so closing the drawer and navigating
            // back doesn't silently reopen it — but keep every other param.
            onChargerOpened={() => patchParams({ id: null, edit: null })}
          />
        );
      case "notifications":
        // A charger's name links to #/chargers?id=<id>, which opens its drawer.
        return <NotificationsPage />;
      case "settings":
        return <SettingsPage />;
    }
  };

  // The charger map takes the page's full width (DESIGN.md: content is capped
  // at 1120px everywhere else); the page padding stays.
  const wide = route === "chargers" && params.get("view") === "map";

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
          onNavigate={(k) => navigate(k)}
          onOpenCharger={(id) => navigate("chargers", { id })}
        />
      </div>
      <main className="shell-main" data-wide={wide || undefined}>
        {renderPage()}
      </main>
      <TabBar active={route} queueTotal={queueTotal} />
    </div>
  );
};

export default App;
