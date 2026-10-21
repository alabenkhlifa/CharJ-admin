import { useEffect, useEffectEvent, useState, useSyncExternalStore } from "react";
import { adminFetch } from "../lib/admin-fetch";
import { SUPABASE_CONFIGURED, supabase } from "../lib/supabase";
import {
  GOVERNORATE_CODE,
  isUuid,
  parseCities,
  parseGovernorates,
  parseLatLng,
  type City,
  type Governorate,
  type NewCityPayload,
} from "./locations-model";

// Governorates + cities are small reference tables (24 + a few dozen rows),
// anon-readable, and only change when an admin adds a city. Load them once
// per page load and share the copy between the Add modal and the editor.

type LocationsState = {
  governorates: Governorate[];
  cities: City[];
  loading: boolean;
  error: string | null;
};

let state: LocationsState = { governorates: [], cities: [], loading: false, error: null };
let loaded = false;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

const setState = (patch: Partial<LocationsState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const loadLocations = (force = false): Promise<void> => {
  if (inflight) return inflight;
  if (loaded && !force) return Promise.resolve();
  if (!SUPABASE_CONFIGURED) {
    setState({ error: "Supabase not configured" });
    return Promise.resolve();
  }
  setState({ loading: true, error: null });
  inflight = (async () => {
    try {
      // `governorates.geom` is not granted to clients — name the columns.
      const [g, c] = await Promise.all([
        supabase.from("governorates").select("code, name_fr, name_ar, name_en"),
        supabase.from("cities").select("id, slug, governorate_code, name_fr, name_ar, name_en"),
      ]);
      if (g.error || c.error) {
        setState({ loading: false, error: (g.error ?? c.error)?.message ?? "Request failed" });
        return;
      }
      loaded = true;
      setState({
        governorates: parseGovernorates(g.data),
        cities: parseCities(c.data),
        loading: false,
        error: null,
      });
    } catch (err) {
      setState({ loading: false, error: err instanceof Error ? err.message : "Request failed" });
    } finally {
      inflight = null;
    }
  })();
  return inflight;
};

export const useLocations = () => {
  const snapshot = useSyncExternalStore(subscribe, () => state);
  useEffect(() => {
    void loadLocations();
  }, []);
  return { ...snapshot, reload: () => loadLocations(true) };
};

// ── Geo RPCs (anon-callable) ──────────────────────────────────────────────

// Point-in-polygon, else the nearest governorate within 25 km. Null offshore.
export const governorateForPoint = async (lat: number, lng: number): Promise<string | null> => {
  const { data, error } = await supabase.rpc("governorate_for_point", { p_lat: lat, p_lng: lng });
  if (error) throw new Error(error.message);
  return typeof data === "string" && GOVERNORATE_CODE.test(data) ? data : null;
};

// Nearest known city within 15 km, inside the pin's governorate.
export const suggestCity = async (lat: number, lng: number): Promise<string | null> => {
  const { data, error } = await supabase.rpc("suggest_city", { p_lat: lat, p_lng: lng });
  if (error) throw new Error(error.message);
  return isUuid(data) ? data : null;
};

export type PinPlace = {
  // "lat,lng" the lookup ran for, so callers can tell a fresh answer.
  key: string;
  governorateCode: string | null;
  suggestedCityId: string | null;
  error: boolean;
};

// Resolves the charger pin's governorate and nearest city, debounced while
// coordinates are being typed. `onResolved` fires once per fresh answer.
export const usePinPlace = (
  lat: string | number,
  lng: string | number,
  onResolved?: (place: PinPlace) => void,
) => {
  const point = parseLatLng(lat, lng);
  const pointLat = point?.lat ?? null;
  const pointLng = point?.lng ?? null;
  const key = point ? `${point.lat},${point.lng}` : "";
  const [result, setResult] = useState<PinPlace | null>(null);
  const resolved = useEffectEvent((place: PinPlace) => onResolved?.(place));

  useEffect(() => {
    if (pointLat === null || pointLng === null || !SUPABASE_CONFIGURED) return;
    const key = `${pointLat},${pointLng}`;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      let place: PinPlace;
      try {
        const [governorateCode, suggestedCityId] = await Promise.all([
          governorateForPoint(pointLat, pointLng),
          suggestCity(pointLat, pointLng),
        ]);
        place = { key, governorateCode, suggestedCityId, error: false };
      } catch {
        place = { key, governorateCode: null, suggestedCityId: null, error: true };
      }
      if (cancelled) return;
      setResult(place);
      resolved(place);
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pointLat, pointLng]);

  const current = result && result.key === key ? result : null;
  return {
    point,
    governorateCode: current?.governorateCode ?? null,
    suggestedCityId: current?.suggestedCityId ?? null,
    pending: Boolean(point) && !current && SUPABASE_CONFIGURED,
    error: current?.error ?? false,
  };
};

// ── Admin write ───────────────────────────────────────────────────────────

export const createCity = async (payload: NewCityPayload): Promise<City> => {
  const res = await adminFetch("admin-cities", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      body && typeof body === "object" && "error" in body
        ? String(body.error)
        : `Request failed (HTTP ${res.status})`,
    );
  }
  const [city] = parseCities([body]);
  if (!city) throw new Error("Invalid city response");
  setState({ cities: [...state.cities.filter((c) => c.id !== city.id), city] });
  return city;
};
