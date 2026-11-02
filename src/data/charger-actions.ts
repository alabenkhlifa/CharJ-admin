import { adminFetch } from "../lib/admin-fetch";
import type { ChargerStatus } from "./chargers";

// The charger drawer's two one-tap writes, through the admin Edge Functions
// (admin-verify-charger, admin-set-charger-status). A non-2xx answer throws
// the function's own `error` text, or "HTTP <status>".

type ErrorBody = { error?: string };

const post = async <T>(fn: string, payload: unknown): Promise<T> => {
  const res = await adminFetch(fn, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  let body: T | ErrorBody = {};
  try {
    body = (await res.json()) as T | ErrorBody;
  } catch {
    // a non-JSON answer
  }
  if (!res.ok) throw new Error((body as ErrorBody)?.error ?? `HTTP ${res.status}`);
  return body as T;
};

export type AdminVerifyResponse = {
  id: string;
  is_verified: boolean;
  verified_at: string | null;
  verified_by: string | null;
  name: string;
};

export const verifyCharger = (chargerId: string) =>
  post<AdminVerifyResponse>("admin-verify-charger", { charger_id: chargerId });

export type SettableStatus = Extract<ChargerStatus, "operational" | "under_repair">;
export type AdminStatusResponse = { id: string; status: ChargerStatus; name: string };

export const setChargerStatus = (chargerId: string, status: SettableStatus) =>
  post<AdminStatusResponse>("admin-set-charger-status", { charger_id: chargerId, status });
