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
  const [chargers, setChargers] = useState<ChargerHit[]>([]);
  const [loading, setLoading] = useState(false);

  const trimmed = rawQuery.trim();
  const routes = matchRoutes(trimmed);

  useEffect(() => {
    if (!SUPABASE_CONFIGURED || trimmed.length < MIN_QUERY) {
      setChargers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      const { data, error } = await supabase.rpc("search_chargers", {
        query: trimmed,
        sort_by: "name",
        max_results: CHARGER_LIMIT,
      });

      if (cancelled) return;

      if (error) {
        setChargers([]);
        setLoading(false);
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

      setChargers(hits);
      setLoading(false);
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [trimmed]);

  return {
    query: trimmed,
    loading,
    routes,
    chargers,
    total: routes.length + chargers.length,
  };
};
