import { useEffect, useState } from "react";
import { SUPABASE_CONFIGURED, supabase } from "../lib/supabase";

// Counts that drive the sidebar nav badges. Anon-key only — anything that
// needs service-role (feedback, reported reviews) is intentionally absent
// here and rendered without a badge upstream.

export type SidebarCounts = {
  chargers: number;
  pendingSubmissions: number;
  ratings: number;
};

const ZERO: SidebarCounts = {
  chargers: 0,
  pendingSubmissions: 0,
  ratings: 0,
};

type State = {
  data: SidebarCounts;
  loading: boolean;
  error: string | null;
};

export const useSidebarCounts = (): State => {
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
      const head = { count: "exact" as const, head: true as const };

      const [chargers, pending, ratings] = await Promise.all([
        supabase.from("chargers").select("id", head),
        supabase
          .from("community_submissions")
          .select("id", head)
          .eq("status", "pending"),
        supabase.from("ratings").select("id", head),
      ]);

      if (cancelled) return;

      const firstError =
        chargers.error ?? pending.error ?? ratings.error;

      if (firstError) {
        setState({ data: ZERO, loading: false, error: firstError.message });
        return;
      }

      setState({
        data: {
          chargers: chargers.count ?? 0,
          pendingSubmissions: pending.count ?? 0,
          ratings: ratings.count ?? 0,
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
