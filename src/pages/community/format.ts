import { createContext, useContext, useEffect } from "react";
import { timeAgo } from "../../data/queue-report";

export const nf = new Intl.NumberFormat("en-US");

/**
 * The "now" for "3h ago": when the page opened, moved on each time the queue
 * reloads (after every action). Renders stay pure; a just-done action reads
 * "just now".
 */
export const NowContext = createContext(0);
export const useNow = () => useContext(NowContext);

/** "3h ago" as text, for sentences; '' without a time. */
export const ago = (iso: string | null, now: number): string => (iso ? timeAgo(iso, now) : "");

/** The first 8 characters of an id, for a glance (the whole id is in the title). */
export const shortId = (id: string): string => (id.length > 8 ? `${id.slice(0, 8)}…` : id);

/**
 * A ?page= past the end (a shorter list since, or a hand-edited link) moves
 * to the last page once the total is known. True while it is past the end.
 */
export const useClampPage = (page: number, total: number | null, perPage: number, onPage: (page: number) => void): boolean => {
  const last = Math.max(1, Math.ceil((total ?? 0) / perPage));
  const past = total !== null && total > 0 && page > last;
  useEffect(() => {
    if (past) onPage(last);
  }, [past, last, onPage]);
  return past;
};
