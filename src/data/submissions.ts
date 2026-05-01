import { useEffect, useState } from "react";
import { SUPABASE_CONFIGURED, supabase } from "../lib/supabase";

// ── Types matching the community_submissions table ─────────────────────────
// Schema (see supabase/migrations/20260416000004_create_community_submissions.sql
// + 20260423000003_community_submissions_app_version.sql):
//   id UUID, submitted_by TEXT, name TEXT, location GEOMETRY(Point, 4326),
//   address TEXT, connectors JSONB, photos TEXT[], notes TEXT,
//   status submission_status ('pending' | 'approved' | 'rejected'),
//   reviewed_at TIMESTAMPTZ, created_at TIMESTAMPTZ, app_version TEXT.
// RLS policy submissions_read_own (USING true) lets anon SELECT every row.

export type SubmissionStatus = "pending" | "approved" | "rejected";

export type SubmissionConnector = {
  type?: string;
  power_kw?: number;
  count?: number;
};

export type RawSubmissionRow = {
  id: string;
  submitted_by: string;
  name: string;
  address: string;
  connectors: SubmissionConnector[] | null;
  photos: string[] | null;
  notes: string;
  status: SubmissionStatus;
  reviewed_at: string | null;
  created_at: string;
  app_version: string | null;
};

// ── UI-shaped submission ───────────────────────────────────────────────────

export type Submission = {
  id: string;
  submittedBy: string;
  name: string;
  address: string;
  notes: string;
  connectors: SubmissionConnector[];
  photos: string[];
  status: SubmissionStatus;
  reviewedAt: string | null;
  createdAt: string;
  appVersion: string;
};

const mapRawSubmission = (r: RawSubmissionRow): Submission => ({
  id: r.id,
  submittedBy: r.submitted_by || "anonymous",
  name: r.name,
  address: r.address ?? "",
  notes: r.notes ?? "",
  connectors: r.connectors ?? [],
  photos: r.photos ?? [],
  status: r.status,
  reviewedAt: r.reviewed_at,
  createdAt: r.created_at,
  appVersion: r.app_version ?? "",
});

// ── Hook ───────────────────────────────────────────────────────────────────

type UseSubmissionsState = {
  data: Submission[];
  loading: boolean;
  error: string | null;
};

export const useSubmissions = (): UseSubmissionsState => {
  const [state, setState] = useState<UseSubmissionsState>({
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
      const { data, error } = await supabase
        .from("community_submissions")
        .select(
          "id, submitted_by, name, address, connectors, photos, notes, status, reviewed_at, created_at, app_version",
        )
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        setState({ data: [], loading: false, error: error.message });
        return;
      }

      const rows = (data ?? []) as RawSubmissionRow[];
      setState({ data: rows.map(mapRawSubmission), loading: false, error: null });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
};
