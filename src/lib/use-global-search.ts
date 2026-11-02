import { useEffect, useState } from "react";
import { SUPABASE_CONFIGURED, supabase } from "./supabase";
import { NAV, type RouteKey } from "./routes";
import { mapRawCharger, type Charger, type RawChargerRow } from "../data/chargers";

export type ChargerHit = {
  kind: "charger";
  id: string;
  name: string;
  city: string;
  charger: Charger;
};

export type RouteHit = {
  kind: "route";
  k: RouteKey;
  l: string;
};

export type SearchHit = ChargerHit | RouteHit;

export type GlobalSearchState = {
  query: string;
  loading: boolean;
  routes: RouteHit[];
  chargers: ChargerHit[];
  total: number;
};

const CHARGER_LIMIT = 8;
const DEBOUNCE_MS = 180;
const MIN_QUERY = 2;

const matchRoutes = (q: string): RouteHit[] => {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  return NAV.filter((n) => n.l.toLowerCase().includes(needle) || n.k.includes(needle)).map(
    (n): RouteHit => ({ kind: "route", k: n.k, l: n.l }),
  );
};

export const useGlobalSearch = (rawQuery: string): GlobalSearchState => {
  // The last answer and the query it answers. Loading is derived: the query
  // moved on and its answer hasn't arrived. The previous hits stay on screen
  // meanwhile, so typing doesn't flicker the list empty.
  const [answer, setAnswer] = useState<{ query: string; hits: ChargerHit[] } | null>(null);

  const trimmed = rawQuery.trim();
  const routes = matchRoutes(trimmed);
  const searching = SUPABASE_CONFIGURED && trimmed.length >= MIN_QUERY;

  useEffect(() => {
    if (!searching) return;
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      const { data, error } = await supabase.rpc("search_chargers", {
        query: trimmed,
        sort_by: "name",
        max_results: CHARGER_LIMIT,
        include_employees_only: true,
      });

      if (cancelled) return;

      if (error) {
        setAnswer({ query: trimmed, hits: [] });
        return;
      }

      const hits = ((data ?? []) as RawChargerRow[])
        .map(mapRawCharger)
        .filter((c): c is Charger => c !== null)
        .map((c): ChargerHit => ({
          kind: "charger",
          id: c.id,
          name: c.name,
          city: c.city,
          charger: c,
        }));

      setAnswer({ query: trimmed, hits });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [searching, trimmed]);

  // While a longer or shorter version of the same query loads, its hits stay.
  const related = answer !== null && (answer.query === trimmed || trimmed.startsWith(answer.query) || answer.query.startsWith(trimmed));
  const chargers = searching && related ? answer.hits : [];
  return {
    query: trimmed,
    loading: searching && answer?.query !== trimmed,
    routes,
    chargers,
    total: routes.length + chargers.length,
  };
};
