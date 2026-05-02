import { useEffect, useState } from "react";

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

export type AdminUser = {
  id: string;
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  vehiclesCount: number;
  ratingsCount: number;
  submissionsCount: number;
  vehicles: AdminUserVehicle[];
};

type RawAdminUserVehicle = {
  make: string;
  model: string;
  variant: string | null;
  year_from: number | null;
  is_primary: boolean;
};

type RawAdminUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  vehicles_count: number;
  ratings_count: number;
  submissions_count: number;
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

export const useAdminUsers = (page = 1, perPage = 100): UseAdminUsersState => {
  const [state, setState] = useState<UseAdminUsersState>({
    data: [],
    total: 0,
    loading: true,
    error: null,
  });

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
    (async () => {
      try {
        const url = `${SUPABASE_URL}/functions/v1/admin-users?page=${page}&perPage=${perPage}`;
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${ADMIN_SECRET}`,
            "Content-Type": "application/json",
          },
        });

        if (cancelled) return;

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          setState({
            data: [],
            total: 0,
            loading: false,
            error: `HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
          });
          return;
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
        const msg = err instanceof Error ? err.message : String(err);
        setState({ data: [], total: 0, loading: false, error: msg });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [page, perPage]);

  return state;
};
