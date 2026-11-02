// Community's view lives in the URL hash (#/community?tab=…&…), so a refresh,
// a pasted link or Summary's Needs-you rows land on the same tab and filters:
//   ?tab=feedback&status=open                      (category defaults to requests)
//   ?tab=visits&outcome=could_not_charge&since=7
//   ?tab=submissions&status=pending
//   ?tab=reviews&reports=open
// Defaults are derived, never written into the URL. Pure module.

import { FEEDBACK_CATEGORIES, type FeedbackCategoryFilter, type FeedbackStatus } from "../../data/feedback-report.ts";
import { REPORT_STATUSES, type ReportStatus } from "../../data/review-reports-report.ts";
import { SUBMISSION_FILTERS, type SubmissionFilter } from "../../data/submissions-report.ts";
import {
  VISIT_OUTCOMES,
  VISIT_VISIBILITIES,
  VISIT_WINDOWS,
  type VisitsView,
  type VisitWindow,
} from "../../data/visits-report.ts";

export const COMMUNITY_TABS = ["feedback", "submissions", "reviews", "visits"] as const;
export type CommunityTab = (typeof COMMUNITY_TABS)[number];

export type CommunityView = {
  tab: CommunityTab;
  feedback: { status: FeedbackStatus; category: FeedbackCategoryFilter; page: number };
  submissions: { status: SubmissionFilter; page: number };
  /** `page` pages the reports, `reviewsPage` (?rpage=) the recent reviews under them. */
  reviews: { reports: ReportStatus; page: number; reviewsPage: number };
  visits: VisitsView;
};

const FEEDBACK_STATUSES: readonly FeedbackStatus[] = ["open", "resolved", "all"];
const FEEDBACK_FILTERS: readonly FeedbackCategoryFilter[] = ["requests", "all", ...FEEDBACK_CATEGORIES];

const oneOf = <T extends string>(raw: string | null, allowed: readonly T[], fallback: T): T =>
  allowed.includes(raw as T) ? (raw as T) : fallback;

const pageOf = (raw: string | null): number => {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 1;
};

const windowOf = (raw: string | null): VisitWindow => {
  const n = Number(raw);
  return (VISIT_WINDOWS as readonly number[]).includes(n) ? (n as Exclude<VisitWindow, null>) : null;
};

export const communityView = (params: URLSearchParams): CommunityView => {
  const tab = oneOf<CommunityTab>(params.get("tab"), COMMUNITY_TABS, "feedback");
  const page = pageOf(params.get("page"));
  // `status` and `page` mean something different on each tab; only the open tab reads them.
  const mine = (t: CommunityTab) => (tab === t ? params : new URLSearchParams());
  return {
    tab,
    feedback: {
      status: oneOf(mine("feedback").get("status"), FEEDBACK_STATUSES, "open"),
      category: oneOf(mine("feedback").get("category"), FEEDBACK_FILTERS, "requests"),
      page: tab === "feedback" ? page : 1,
    },
    submissions: {
      status: oneOf(mine("submissions").get("status"), SUBMISSION_FILTERS, "pending"),
      page: tab === "submissions" ? page : 1,
    },
    reviews: {
      reports: oneOf(params.get("reports"), REPORT_STATUSES, "open"),
      page: tab === "reviews" ? page : 1,
      reviewsPage: pageOf(params.get("rpage")),
    },
    visits: {
      outcome: oneOf(params.get("outcome"), VISIT_OUTCOMES, "all"),
      visibility: oneOf(params.get("visibility"), VISIT_VISIBILITIES, "visible"),
      since: windowOf(params.get("since")),
      page: tab === "visits" ? page : 1,
    },
  };
};

/** A tab's own link: just the tab, every filter at its default. */
export const communityHash = (tab: CommunityTab): string => `#/community?tab=${tab}`;
