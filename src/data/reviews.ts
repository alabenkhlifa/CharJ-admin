import { useEffect, useState } from "react";
import { SUPABASE_CONFIGURED, supabase } from "../lib/supabase";

// ── Types matching the `ratings` table ────────────────────────────────────
// Schema (see supabase/migrations/20260416000012_ratings.sql):
//   id UUID, charger_id UUID, rater TEXT, rating SMALLINT (1–5),
//   comment TEXT, created_at TIMESTAMPTZ.
// No "helpful" count exists, so we don't model one.

export type RawRatingRow = {
  id: string;
  charger_id: string;
  rater: string;
  rating: number;
  comment: string;
  created_at: string;
};

export type Review = {
  id: string;
  chargerId: string;
  chargerName: string;
  raterShort: string;
  rating: number;
  comment: string;
  createdAt: string;
};

const RECENT_LIMIT = 50;

// First 6 chars of the UID + ellipsis. Anonymous fallback for empty strings
// just in case (the column is NOT NULL but values can still be whitespace-y).
const shortenRater = (rater: string): string => {
  const trimmed = rater.trim();
  if (!trimmed) return "anon";
  return `${trimmed.slice(0, 6)}…`;
};

type UseReviewsState = {
  data: Review[];
  loading: boolean;
  error: string | null;
};

export const useReviews = (): UseReviewsState => {
  const [state, setState] = useState<UseReviewsState>({
    data: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) {
      setState({ data: [], loading: false, error: "Supabase not configured" });
      return;
    }

    let cancelled = false;
    (async () => {
      // Two queries: (a) the latest 50 ratings, (b) a name lookup for chargers.
      // We don't have `auth.users` access via anon, so we can't enrich the
      // rater further — just truncate the UID.
      const [ratingsRes, chargersRes] = await Promise.all([
        supabase
          .from("ratings")
          .select("id, charger_id, rater, rating, comment, created_at")
          .order("created_at", { ascending: false })
          .limit(RECENT_LIMIT),
        supabase.from("chargers").select("id, name"),
      ]);

      if (cancelled) return;

      if (ratingsRes.error) {
        setState({ data: [], loading: false, error: ratingsRes.error.message });
        return;
      }
      if (chargersRes.error) {
        setState({ data: [], loading: false, error: chargersRes.error.message });
        return;
      }

      const nameById = new Map<string, string>(
        ((chargersRes.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]),
      );

      const rows = (ratingsRes.data ?? []) as RawRatingRow[];
      const mapped: Review[] = rows.map((r) => ({
        id: r.id,
        chargerId: r.charger_id,
        chargerName: nameById.get(r.charger_id) ?? "Unknown charger",
        raterShort: shortenRater(r.rater),
        rating: r.rating,
        comment: r.comment ?? "",
        createdAt: r.created_at,
      }));

      setState({ data: mapped, loading: false, error: null });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
};

// ── Relative-time helper ──────────────────────────────────────────────────
// Pages already use plain inline strings; keep this co-located so the page
// stays declarative.

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

export const formatRelative = (iso: string): string => {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < WEEK) return `${Math.floor(diff / DAY)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
