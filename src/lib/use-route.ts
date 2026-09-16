import { useCallback, useEffect, useState } from "react";
import { NAV, type RouteKey } from "./routes";

// ── Hash-based routing ────────────────────────────────────────────────────
// Deliberately hand-rolled instead of pulling in react-router: the whole
// need is "which page + a couple of query params", and the bundle is
// already over Vite's 500 KB warning threshold.
//
// Hash (not history) routing because the site is served from GitHub Pages
// under the /CharJ-admin/ subpath. A real path router would need the
// 404.html SPA-fallback dance AND a matching `basename`; `#/users` is
// immune to both and survives a hard refresh untouched.

const VALID_ROUTES = new Set<string>(NAV.map((n) => n.k));
const DEFAULT_ROUTE: RouteKey = "overview";

export type RouteLocation = {
  route: RouteKey;
  params: URLSearchParams;
};

export type RouteParams = Record<string, string | null | undefined>;

// "#/chargers?id=abc" → { route: "chargers", params: URLSearchParams(id=abc) }
// Anything unrecognised (empty hash, "#", "#/bogus") falls back to Overview
// rather than rendering a blank shell.
const parseHash = (raw: string): RouteLocation => {
  const withoutHash = raw.startsWith("#") ? raw.slice(1) : raw;
  const path = withoutHash.startsWith("/") ? withoutHash.slice(1) : withoutHash;
  const queryAt = path.indexOf("?");
  const head = (queryAt === -1 ? path : path.slice(0, queryAt)).trim().toLowerCase();
  const query = queryAt === -1 ? "" : path.slice(queryAt + 1);
  return {
    route: VALID_ROUTES.has(head) ? (head as RouteKey) : DEFAULT_ROUTE,
    params: new URLSearchParams(query),
  };
};

export const buildHash = (route: RouteKey, params?: RouteParams): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return `#/${route}${query ? `?${query}` : ""}`;
};

type UseRouteResult = RouteLocation & {
  // Adds a history entry — the browser Back button returns to the previous page.
  navigate: (route: RouteKey, params?: RouteParams) => void;
  // Rewrites the current entry — for param churn that isn't worth a Back step
  // (e.g. closing a detail drawer).
  replace: (route: RouteKey, params?: RouteParams) => void;
};

export const useRoute = (): UseRouteResult => {
  const [location, setLocation] = useState<RouteLocation>(() =>
    parseHash(typeof window === "undefined" ? "" : window.location.hash),
  );

  useEffect(() => {
    const sync = () => setLocation(parseHash(window.location.hash));
    window.addEventListener("hashchange", sync);

    // Normalise a bare or malformed URL so what's in the address bar always
    // matches what's rendered — otherwise the first refresh silently moves
    // the user somewhere else. replaceState doesn't fire `hashchange`, and
    // the state above already resolved to the same route, so no extra sync.
    const current = window.location.hash;
    const normalised = buildHash(parseHash(current).route);
    if (current !== normalised && !current.includes("?")) {
      window.history.replaceState(null, "", normalised);
    }

    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const navigate = useCallback((route: RouteKey, params?: RouteParams) => {
    const next = buildHash(route, params);
    if (window.location.hash === next) {
      // Assigning an identical hash is a no-op that never fires `hashchange`,
      // so re-picking the current page from the sidebar would hang on stale
      // params. Push the state through by hand.
      setLocation(parseHash(next));
      return;
    }
    window.location.hash = next;
  }, []);

  const replace = useCallback((route: RouteKey, params?: RouteParams) => {
    const next = buildHash(route, params);
    window.history.replaceState(null, "", next);
    setLocation(parseHash(next));
  }, []);

  return { ...location, navigate, replace };
};
