import { useCallback } from "react";
import { getJson, postJson, useAdminLoad, type AdminLoad } from "./admin-load";
import {
  parseReportItem,
  parseReviewReports,
  reportErrorMessage,
  reportsPath,
  type ReportStatus,
  type ReviewReport,
  type ReviewReportsPage,
} from "./review-reports-report";

// ── Review reports inbox ───────────────────────────────────────────────────
// Source: the admin-review-reports Edge Function. `review_reports` is
// service-role only, so it goes through adminFetch.

const ENDPOINT = "admin-review-reports";

/** One page of reports (open first by default), with the open count. */
export const useReviewReports = (status: ReportStatus, page: number): AdminLoad<ReviewReportsPage> => {
  const load = useCallback(
    async (signal: AbortSignal) => parseReviewReports(await getJson(reportsPath(status, page), signal, reportErrorMessage)),
    [status, page],
  );
  return useAdminLoad(load);
};

/** Resolve or reopen one report: the updated report, or why it failed. Nothing is hidden or deleted. */
export const setReportResolved = async (
  id: string,
  resolved: boolean,
): Promise<{ ok: true; item: ReviewReport | null } | { ok: false; message: string }> => {
  const res = await postJson(ENDPOINT, { id, resolved });
  if (!res.ok) return { ok: false, message: res.error ?? reportErrorMessage(res.status) };
  const body = res.body;
  return { ok: true, item: body !== null && typeof body === "object" && "item" in body ? parseReportItem(body.item) : null };
};
