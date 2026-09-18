export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Day = (typeof DAYS)[number];
export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json | undefined };
export type Connector = {
  type: string;
  power_kw: number;
  count: number;
  [key: string]: Json | undefined;
};
export type TimeRange = {
  from: string;
  to: string;
  [key: string]: Json | undefined;
};
export type Hours = {
  weekly?: Partial<Record<Day, TimeRange[]>>;
  always_open?: boolean;
  [key: string]: Json | undefined;
} | null;
export type AdminCharger = {
  id: string;
  name: string;
  name_ar: string;
  name_fr: string;
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  operator: string;
  status: string;
  access_type: string;
  source: string;
  ocm_id: number | null;
  connectors: Connector[];
  working_hours: Hours;
  exclusive_to: string[];
  amenities: string[];
  photos: string[];
  is_verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  contact_id: string | null;
  contact_phone: string | null;
  manual_overrides: Record<string, Json>;
  created_at: string;
  updated_at: string;
};
export type ConnectorDraft = {
  type: string;
  power: string;
  count: string;
  original: Connector;
};
export type DayDraft = {
  mode: "unknown" | "closed" | "open";
  ranges: TimeRange[];
};
export type ChargerDraft = {
  name: string;
  name_ar: string;
  name_fr: string;
  latitude: string;
  longitude: string;
  address: string;
  city: string;
  operator: string;
  status: string;
  access_type: string;
  source: string;
  ocm_id: string;
  connectors: ConnectorDraft[];
  hoursMode: "unknown" | "always" | "weekly";
  days: Record<Day, DayDraft>;
  exclusive_to: string[];
  amenities: string[];
  photos: string[];
  contact_phone: string;
  is_verified: boolean;
  verified_by: string;
  verified_at: string;
};
export const newConnector = (): ConnectorDraft => ({
  type: "Type 2",
  power: "",
  count: "1",
  original: { type: "Type 2", power_kw: 0, count: 1 },
});

const dateInput = (iso: string | null) => {
  if (!iso) return "";
  // UTC avoids silently shifting a verification timestamp with the browser zone.
  return new Date(iso).toISOString().slice(0, 16);
};
export function createDraft(c: AdminCharger): ChargerDraft {
  const weekly = c.working_hours?.weekly;
  const allDay =
    c.working_hours?.always_open === true ||
    DAYS.every(
      (d) =>
        weekly?.[d]?.length === 1 &&
        weekly[d]![0].from === "00:00" &&
        weekly[d]![0].to === "24:00",
    );
  return {
    name: c.name,
    name_ar: c.name_ar ?? "",
    name_fr: c.name_fr ?? "",
    latitude: String(c.latitude),
    longitude: String(c.longitude),
    address: c.address ?? "",
    city: c.city ?? "",
    operator: c.operator ?? "",
    status: c.status,
    access_type: c.access_type,
    source: c.source,
    ocm_id: c.ocm_id === null ? "" : String(c.ocm_id),
    connectors: (c.connectors ?? []).map((v) => ({
      type: v.type,
      power: String(v.power_kw),
      count: String(v.count),
      original: v,
    })),
    hoursMode: !c.working_hours ? "unknown" : allDay ? "always" : "weekly",
    days: Object.fromEntries(
      DAYS.map((d) => [
        d,
        {
          mode:
            weekly?.[d] === undefined
              ? "unknown"
              : weekly[d]!.length
                ? "open"
                : "closed",
          ranges: weekly?.[d]?.map((r) => ({ ...r })) ?? [],
        },
      ]),
    ) as Record<Day, DayDraft>,
    exclusive_to: [...(c.exclusive_to ?? [])],
    amenities: [...(c.amenities ?? [])],
    photos: [...(c.photos ?? [])],
    contact_phone: c.contact_phone ?? "",
    is_verified: c.is_verified,
    verified_by: c.verified_by ?? "",
    verified_at: dateInput(c.verified_at),
  };
}
export const isDirty = (a: ChargerDraft, b: ChargerDraft) =>
  JSON.stringify(a) !== JSON.stringify(b);

export function buildChanges(
  draft: ChargerDraft,
  original: AdminCharger,
): Record<string, Json> {
  const before = createDraft(original);
  const changes: Record<string, Json> = {};
  const changed = (key: keyof ChargerDraft) =>
    JSON.stringify(draft[key]) !== JSON.stringify(before[key]);
  for (const key of [
    "name",
    "name_ar",
    "name_fr",
    "address",
    "city",
    "operator",
    "status",
    "access_type",
    "source",
  ] as const) {
    if (changed(key)) changes[key] = draft[key].trim();
  }
  if (!draft.name.trim()) throw new Error("Name is required");
  if (changed("latitude") || changed("longitude")) {
    const lat = Number(draft.latitude),
      lng = Number(draft.longitude);
    if (
      !draft.latitude.trim() ||
      !draft.longitude.trim() ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    )
      throw new Error("Enter valid latitude and longitude");
    changes.location = { lat, lng };
  }
  if (changed("ocm_id")) {
    const id = draft.ocm_id.trim() ? Number(draft.ocm_id) : null;
    if (id !== null && (!Number.isInteger(id) || id <= 0 || id > 2147483647))
      throw new Error("OCM ID must be a positive integer or empty");
    changes.ocm_id = id;
  }
  if (changed("connectors")) {
    changes.connectors = draft.connectors.map((c, i) => {
      const power = Number(c.power),
        count = Number(c.count);
      if (
        !c.type.trim() ||
        !Number.isFinite(power) ||
        power <= 0 ||
        !Number.isInteger(count) ||
        count < 1
      )
        throw new Error(
          `Connector ${i + 1}: enter a type, positive power and whole-number count`,
        );
      return { ...c.original, type: c.type.trim(), power_kw: power, count };
    });
  }
  for (const key of ["photos", "exclusive_to", "amenities"] as const) {
    if (changed(key)) {
      if (draft[key].some((v) => !v.trim()))
        throw new Error(
          `Complete or remove empty ${key === "exclusive_to" ? "brand" : key} entries`,
        );
      changes[key] = [...new Set(draft[key].map((v) => v.trim()))];
    }
  }
  if (
    draft.access_type === "brand_exclusive" &&
    !draft.exclusive_to.some((v) => v.trim())
  )
    throw new Error("Brand-exclusive access needs at least one brand");
  if (changes.photos)
    for (const url of changes.photos as string[]) {
      try {
        if (!["http:", "https:"].includes(new URL(url).protocol))
          throw new Error();
      } catch {
        throw new Error("Each photo must have an HTTP or HTTPS URL");
      }
    }
  if (changed("hoursMode") || changed("days")) {
    if (draft.hoursMode === "unknown") changes.working_hours = null;
    else {
      const weekly: Partial<Record<Day, TimeRange[]>> = {};
      for (const day of DAYS) {
        const entry = draft.days[day];
        if (draft.hoursMode === "always")
          weekly[day] = [{ from: "00:00", to: "24:00" }];
        else if (entry.mode === "closed") weekly[day] = [];
        else if (entry.mode === "open") {
          if (!entry.ranges.length)
            throw new Error(`${day}: add an opening period`);
          for (const r of entry.ranges) {
            if (
              !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.from) ||
              !/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/.test(r.to) ||
              r.from >= r.to
            )
              throw new Error(
                `${day}: use HH:MM and an end after the start; split overnight hours across days`,
              );
          }
          const sorted = [...entry.ranges].sort((a, b) =>
            a.from.localeCompare(b.from),
          );
          if (sorted.some((r, i) => i > 0 && r.from < sorted[i - 1].to))
            throw new Error(`${day}: opening periods overlap`);
          weekly[day] = sorted;
        }
      }
      const extras = { ...original.working_hours };
      delete extras.always_open;
      changes.working_hours = { ...extras, weekly };
    }
  }
  if (changed("contact_phone"))
    changes.contact_phone = draft.contact_phone.trim() || null;
  if (changed("is_verified")) {
    changes.is_verified = draft.is_verified;
    changes.verified_by = draft.is_verified
      ? draft.verified_by.trim() || null
      : null;
    changes.verified_at = draft.is_verified
      ? draft.verified_at
        ? new Date(`${draft.verified_at}Z`).toISOString()
        : new Date().toISOString()
      : null;
  }
  if (draft.is_verified) {
    if (changed("verified_by"))
      changes.verified_by = draft.verified_by.trim() || null;
    if (changed("verified_at"))
      changes.verified_at = draft.verified_at
        ? new Date(`${draft.verified_at}Z`).toISOString()
        : null;
  }
  return changes;
}
