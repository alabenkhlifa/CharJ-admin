import { useCallback } from "react";
import { getJson, postJson, useAdminLoad, type AdminLoad } from "./admin-load";
import { parseVisits, visitErrorMessage, visitsPath, type VisitsPage, type VisitsView } from "./visits-report";

// ── Driver visit reports (`charging_confirmations`) ───────────────────────
// Source: the admin-confirmations Edge Function. The table is service-role
// only (REVOKEd from anon/authenticated), so it goes through adminFetch.

const ENDPOINT = "admin-confirmations";

/** One page of visits for the filters, with the all-time summary. */
export const useVisits = ({ outcome, visibility, since, page }: VisitsView): AdminLoad<VisitsPage> => {
  const load = useCallback(
    async (signal: AbortSignal) => parseVisits(await getJson(visitsPath({ outcome, visibility, since, page }), signal, visitErrorMessage)),
    [outcome, visibility, since, page],
  );
  return useAdminLoad(load);
};

/** Hide (with a reason, 1–500 characters) or unhide one report. Null on success, else why it failed. */
export const moderateVisit = async (id: string, hidden: boolean, reason?: string): Promise<string | null> => {
  const res = await postJson(ENDPOINT, { id, hidden, reason: hidden ? reason : undefined });
  if (res.ok) return null;
  const text = res.body !== null && typeof res.body === "object" && "error" in res.body ? String(res.body.error) : "";
  return res.error ?? visitErrorMessage(res.status, text);
};
