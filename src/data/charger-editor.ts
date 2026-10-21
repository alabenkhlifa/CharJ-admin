import { adminFetch } from "../lib/admin-fetch";
import { SUPABASE_CONFIGURED } from "../lib/supabase";
import type { AdminCharger, Json } from "./charger-editor-model";

export const CHARGER_EDITOR_CONFIGURED = SUPABASE_CONFIGURED;

async function request(path: string, init: RequestInit): Promise<AdminCharger> {
  if (!CHARGER_EDITOR_CONFIGURED) throw new Error("Admin API not configured");
  const res = await adminFetch(`admin-update-charger${path}`, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error =
      body && typeof body === "object" && "error" in body
        ? String(body.error)
        : `Request failed (HTTP ${res.status})`;
    throw new Error(error);
  }
  if (
    !body ||
    typeof body !== "object" ||
    !("id" in body) ||
    !("updated_at" in body) ||
    !("manual_overrides" in body)
  )
    throw new Error("Invalid charger response");
  return body as AdminCharger;
}
export const loadChargerForEdit = (id: string, signal?: AbortSignal) =>
  request(`?charger_id=${encodeURIComponent(id)}`, { method: "GET", signal });
export const saveCharger = (
  charger: AdminCharger,
  changes: Record<string, Json>,
) =>
  request("", {
    method: "POST",
    body: JSON.stringify({
      charger_id: charger.id,
      expected_updated_at: charger.updated_at,
      changes,
    }),
  });
