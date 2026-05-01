import { useEffect, useState } from "react";
import { SUPABASE_CONFIGURED, supabase } from "../lib/supabase";

// Numbers that can actually be computed from anon-readable tables.
// Anything user-/session-related needs a service-role Edge Function and
// is intentionally absent here — see db-agent audit, 2026-05-02.

export type OverviewStats = {
  totalChargers: number;
  operationalPct: number;
  verifiedPct: number;
  verifiedThisWeek: number;
  newChargersThisWeek: number;
  publicCount: number;
  pendingSubmissions: number;
  avgRating: number | null;
  ratingsCount: number;
};

const ZERO: OverviewStats = {
  totalChargers: 0,
  operationalPct: 0,
  verifiedPct: 0,
  verifiedThisWeek: 0,
  newChargersThisWeek: 0,
  publicCount: 0,
  pendingSubmissions: 0,
  avgRating: null,
  ratingsCount: 0,
};

const weekAgo = () => new Date(Date.now() - 7 * 86_400_000).toISOString();

type State = {
  data: OverviewStats;
  loading: boolean;
  error: string | null;
};

export const useOverviewStats = (): State => {
  const [state, setState] = useState<State>({
    data: ZERO,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) {
      setState({ data: ZERO, loading: false, error: "Supabase not configured" });
      return;
    }

    let cancelled = false;
    (async () => {
      const since = weekAgo();
      const head = { count: "exact" as const, head: true as const };

      const [
        total,
        operational,
        verified,
        verifiedRecent,
        newChargers,
        pub,
        pending,
        ratingsAgg,
      ] = await Promise.all([
        supabase.from("chargers").select("id", head),
        supabase.from("chargers").select("id", head).eq("status", "operational"),
        supabase.from("chargers").select("id", head).eq("is_verified", true),
        supabase
          .from("chargers")
          .select("id", head)
          .eq("is_verified", true)
          .gte("verified_at", since),
        supabase.from("chargers").select("id", head).gte("created_at", since),
        supabase.from("chargers").select("id", head).eq("access_type", "public"),
        supabase.from("community_submissions").select("id", head).eq("status", "pending"),
        // Ratings: pull all ratings to compute avg locally. The table is
        // small (a few thousand rows max in practice). If it grows, swap
        // to an RPC that returns AVG.
        supabase.from("ratings").select("rating"),
      ]);

      if (cancelled) return;

      const firstError =
        total.error ??
        operational.error ??
        verified.error ??
        verifiedRecent.error ??
        newChargers.error ??
        pub.error ??
        pending.error ??
        ratingsAgg.error;

      if (firstError) {
        setState({ data: ZERO, loading: false, error: firstError.message });
        return;
      }

      const totalCount = total.count ?? 0;
      const ratings = (ratingsAgg.data ?? []) as { rating: number }[];
      const avgRating =
        ratings.length === 0
          ? null
          : ratings.reduce((s, r) => s + (r.rating ?? 0), 0) / ratings.length;

      setState({
        data: {
          totalChargers: totalCount,
          operationalPct:
            totalCount === 0 ? 0 : ((operational.count ?? 0) / totalCount) * 100,
          verifiedPct:
            totalCount === 0 ? 0 : ((verified.count ?? 0) / totalCount) * 100,
          verifiedThisWeek: verifiedRecent.count ?? 0,
          newChargersThisWeek: newChargers.count ?? 0,
          publicCount: pub.count ?? 0,
          pendingSubmissions: pending.count ?? 0,
          avgRating,
          ratingsCount: ratings.length,
        },
        loading: false,
        error: null,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
};
