import { NAV, type RouteKey } from "./routes.ts";

export type RouteLocation = {
  route: RouteKey;
  params: URLSearchParams;
};

const CURRENT = new Set<string>(NAV.map((n) => n.k));

// Old page → [new page, params it adds in front of the old ones].
const LEGACY: Record<string, [RouteKey, Record<string, string>]> = {
  overview: ["summary", {}],
  analytics: ["usage", {}],
  users: ["usage", { tab: "users" }],
  vehicles: ["usage", { tab: "catalog" }],
  map: ["chargers", { view: "map" }],
  submissions: ["community", { tab: "submissions" }],
  feedback: ["community", { tab: "feedback" }],
  reviews: ["community", { tab: "reviews" }],
  visits: ["community", { tab: "visits" }],
};

/**
 * Maps an old bookmark (`#/users?user=X`) to its new place
 * (`#/usage?tab=users&user=X`). A current route passes through unchanged;
 * anything else is `null` so the caller falls back to the default page.
 */
export const legacyRedirect = (route: string, params: URLSearchParams): RouteLocation | null => {
  if (CURRENT.has(route)) return { route: route as RouteKey, params: new URLSearchParams(params) };
  const hit = Object.hasOwn(LEGACY, route) ? LEGACY[route] : undefined;
  if (!hit) return null;
  const [next, add] = hit;
  const merged = new URLSearchParams(Object.entries(add));
  params.forEach((value, key) => {
    if (!merged.has(key)) merged.append(key, value);
  });
  return { route: next, params: merged };
};
