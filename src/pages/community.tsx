import { useCallback, useState } from "react";
import type { QueueState } from "../data/queue";
import { queueCount, type QueueKey } from "../data/queue-report";
import type { RouteKey } from "../lib/routes";
import type { RouteParams } from "../lib/use-route";
import { toneText, type Category } from "../ui/category";
import { LargeTitle } from "../ui/large-title";
import { FeedbackTab } from "./community/feedback-tab";
import { NowContext } from "./community/format";
import { communityHash, communityView, type CommunityTab } from "./community/params";
import { ReviewsTab } from "./community/reviews-tab";
import { SubmissionsTab } from "./community/submissions-tab";
import { VisitsTab } from "./community/visits-tab";
import "./community.css";

// Community: the admin's one queue page (spec "Community"). Four tabs, each
// in the URL (?tab=), each keeping the old page's actions: feedback (resolve /
// reopen, design votes as a tally), charger submissions (approve / reject),
// reviews (resolve reports), driver visits (hide / unhide, open the driver).
// Tab badges and the nav badge are the same queue (App's useQueue); every
// action refreshes it, so Needs you and the badge stay true.

type Props = {
  params: URLSearchParams;
  /** Merge into the current params (App's patchParams). */
  onParams: (patch: RouteParams) => void;
  navigate: (route: RouteKey, params?: RouteParams) => void;
  queue: QueueState;
};

const TABS: { k: CommunityTab; l: string; queue: QueueKey; tone: Category; what: string }[] = [
  { k: "feedback", l: "Feedback", queue: "feedback", tone: "needs-you", what: "open" },
  { k: "submissions", l: "Submissions", queue: "submissions", tone: "screens", what: "pending" },
  { k: "reviews", l: "Reviews", queue: "reports", tone: "actions", what: "open reports" },
  { k: "visits", l: "Driver visits", queue: "couldNotCharge", tone: "alarm", what: "couldn't charge in 7 days" },
];

/** The tab's open count: coloured above zero, plain at zero, absent while unknown (never a made-up 0). */
const TabBadge = ({ n, tone }: { n: number | null; tone: Category }) =>
  n === null ? null : (
    <span className={n ? "com-badge" : "com-badge com-badge-zero"} style={n ? { background: toneText(tone) } : undefined} aria-hidden="true">
      {n.toLocaleString("en-US")}
    </span>
  );

export const CommunityPage = ({ params, onParams, navigate, queue }: Props) => {
  const view = communityView(params);
  const [openedAt] = useState(() => Date.now());
  const now = Math.max(openedAt, queue.loadedAt ?? 0);
  const refreshQueue = queue.refresh;
  const openDriver = useCallback((id: string) => navigate("usage", { section: "users", user: id }), [navigate]);
  const openCharger = useCallback((id: string, edit: boolean) => navigate("chargers", { id, edit: edit ? "1" : null }), [navigate]);

  return (
    <NowContext.Provider value={now}>
      <div className="com">
        <LargeTitle title="Community" subtitle="What drivers send from the app, and what waits for you." />
        <nav className="com-tabs" aria-label="Community">
          {TABS.map((t) => {
            const n = queue.data ? queueCount(queue.data, t.queue) : null;
            return (
              <a
                key={t.k}
                href={communityHash(t.k)}
                aria-current={view.tab === t.k ? "page" : undefined}
                aria-label={n === null ? t.l : `${t.l}, ${n.toLocaleString("en-US")} ${t.what}`}
              >
                <span>{t.l}</span>
                <TabBadge n={n} tone={t.tone} />
              </a>
            );
          })}
        </nav>
        {view.tab === "feedback" && <FeedbackTab view={view.feedback} onParams={onParams} onChanged={refreshQueue} />}
        {view.tab === "submissions" && (
          <SubmissionsTab view={view.submissions} onParams={onParams} onChanged={refreshQueue} onOpenCharger={openCharger} />
        )}
        {view.tab === "reviews" && <ReviewsTab view={view.reviews} onParams={onParams} onChanged={refreshQueue} />}
        {view.tab === "visits" && (
          <VisitsTab view={view.visits} onParams={onParams} onChanged={refreshQueue} onOpenDriver={openDriver} />
        )}
      </div>
    </NowContext.Provider>
  );
};
