import { useCallback, useEffect, useState } from "react";

// ── Types matching the admin-users Edge Function response ─────────────────
// Function lives at: ${VITE_SUPABASE_URL}/functions/v1/admin-users
// Auth: bearer with VITE_ADMIN_API_SECRET (NOT the anon key — this calls
// the Supabase Admin SDK to read auth.users which is not exposed via PostgREST).

export type AdminUserVehicle = {
  make: string;
  model: string;
  variant: string | null;
  year_from: number | null;
  is_primary: boolean;
};

// What the analytics event stream knows about a user's device.
//
// `model`, `osVersion` and the screen dimensions only exist for events sent
// by app builds that carry the device-context change; every earlier event
// leaves them null. The UI must render the null case, not assume coverage.
export type AdminUserDevice = {
  platform: string;
  appVersion: string;
  language: string;
  environment: string;
  lastEventAt: string;
  model: string | null;
  osVersion: string | null;
  screenWidth: number | null;
  screenHeight: number | null;
  screenScale: number | null;
};

export type AdminUser = {
  id: string;
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  vehiclesCount: number;
  ratingsCount: number;
  submissionsCount: number;
  visitsCount: number;
  eventsCount: number;
  sessionsCount: number;
  device: AdminUserDevice | null;
  vehicles: AdminUserVehicle[];
};

export type AdminUsersFilter = "all" | "engaged";

type RawAdminUserVehicle = {
  make: string;
  model: string;
  variant: string | null;
  year_from: number | null;
  is_primary: boolean;
};

type RawAdminUserDevice = {
  platform: string;
  app_version: string;
  language: string;
  environment: string;
  last_event_at: string;
  model?: string | null;
  os_version?: string | null;
  screen_width?: number | null;
  screen_height?: number | null;
  screen_scale?: number | null;
};

type RawAdminUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  vehicles_count: number;
  ratings_count: number;
  submissions_count: number;
  visits_count?: number;
  events_count?: number;
  sessions_count?: number;
  device?: RawAdminUserDevice | null;
  vehicles?: RawAdminUserVehicle[];
};

type RawAdminUsersResponse = {
  users: RawAdminUser[];
  page: number;
  perPage: number;
  total: number;
};

const mapRaw = (r: RawAdminUser): AdminUser => ({
  id: r.id,
  email: r.email,
  createdAt: r.created_at,
  lastSignInAt: r.last_sign_in_at,
  vehiclesCount: r.vehicles_count ?? 0,
  ratingsCount: r.ratings_count ?? 0,
  submissionsCount: r.submissions_count ?? 0,
  visitsCount: r.visits_count ?? 0,
  eventsCount: r.events_count ?? 0,
  sessionsCount: r.sessions_count ?? 0,
  device: r.device
    ? {
        platform: r.device.platform,
        appVersion: r.device.app_version,
        language: r.device.language,
        environment: r.device.environment,
        lastEventAt: r.device.last_event_at,
        model: r.device.model ?? null,
        osVersion: r.device.os_version ?? null,
        screenWidth: r.device.screen_width ?? null,
        screenHeight: r.device.screen_height ?? null,
        screenScale: r.device.screen_scale ?? null,
      }
    : null,
  vehicles: (r.vehicles ?? []).map((v) => ({
    make: v.make,
    model: v.model,
    variant: v.variant,
    year_from: v.year_from,
    is_primary: v.is_primary,
  })),
});

// ── Hook ──────────────────────────────────────────────────────────────────

type UseAdminUsersState = {
  data: AdminUser[];
  total: number;
  loading: boolean;
  error: string | null;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_API_SECRET ?? "";
const ADMIN_CONFIGURED = Boolean(SUPABASE_URL && ADMIN_SECRET);

export const useAdminUsers = (
  page = 1,
  perPage = 25,
  filter: AdminUsersFilter = "all",
  lookup = "",
) => {
  const [state, setState] = useState<UseAdminUsersState>({
    data: [],
    total: 0,
    loading: true,
    error: null,
  });
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(() => setRevision((n) => n + 1), []);

  useEffect(() => {
    if (!ADMIN_CONFIGURED) {
      setState({
        data: [],
        total: 0,
        loading: false,
        error:
          "Admin API not configured. Set VITE_SUPABASE_URL + VITE_ADMIN_API_SECRET.",
      });
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);

    (async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const params = new URLSearchParams({
          page: String(page),
          perPage: String(perPage),
          filter,
        });
        if (lookup) params.set("user", lookup);
        const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-users?${params}`, {
          headers: {
            Authorization: `Bearer ${ADMIN_SECRET}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        });

        if (cancelled) return;

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(
            res.status === 401
              ? "Your admin credentials could not be verified."
              : `HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
          );
        }

        const json = (await res.json()) as RawAdminUsersResponse;
        if (cancelled) return;

        const users = (json.users ?? []).map(mapRaw);
        setState({
          data: users,
          total: json.total ?? users.length,
          loading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof DOMException && err.name === "AbortError"
            ? "Request timed out."
            : err instanceof Error
              ? err.message
              : String(err);
        setState({ data: [], total: 0, loading: false, error: msg });
      } finally {
        window.clearTimeout(timeout);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [page, perPage, filter, lookup, revision]);

  return { ...state, refresh };
};
