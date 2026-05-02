import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { iconBtnStyle } from "./charts";
import { AMENITY_SLUGS, AmenityIcon, labelForAmenity } from "../lib/amenity-icons";
import { Icons } from "../lib/icons";
import type {
  AccessType,
  ChargerStatus,
  ConnectorTypeRaw,
  RawConnector,
} from "../data/chargers";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const ADMIN_API_SECRET = import.meta.env.VITE_ADMIN_API_SECRET ?? "";
const ADMIN_API_CONFIGURED = Boolean(ADMIN_API_SECRET && SUPABASE_URL);

const CONNECTOR_TYPES: ConnectorTypeRaw[] = ["Type 2", "CCS", "CHAdeMO"];

const STATUS_OPTIONS: { v: ChargerStatus; l: string }[] = [
  { v: "operational", l: "Operational" },
  { v: "under_repair", l: "Under repair" },
  { v: "planned", l: "Planned" },
  { v: "unknown", l: "Unknown" },
];

const ACCESS_OPTIONS: { v: AccessType; l: string }[] = [
  { v: "public", l: "Public" },
  { v: "customers_only", l: "Customers only" },
  { v: "brand_exclusive", l: "Brand exclusive" },
];

type AddChargerPayload = {
  name: string;
  name_ar: string;
  name_fr: string;
  latitude: number;
  longitude: number;
  address: string | null;
  city: string;
  connectors: RawConnector[];
  operator: string | null;
  status: ChargerStatus;
  access_type: AccessType;
  exclusive_to: string[] | null;
  amenities: string[];
  is_verified: boolean;
};

type ConnectorDraft = {
  type: ConnectorTypeRaw;
  power_kw: string;
  count: string;
};

type FormState = {
  name: string;
  nameAr: string;
  nameFr: string;
  lat: string;
  lng: string;
  address: string;
  city: string;
  operator: string;
  status: ChargerStatus;
  access: AccessType;
  exclusiveTo: string;
  amenities: string[];
  verified: boolean;
  connectors: ConnectorDraft[];
};

const EMPTY_CONNECTOR = (): ConnectorDraft => ({
  type: "Type 2",
  power_kw: "22",
  count: "1",
});

const INITIAL: FormState = {
  name: "",
  nameAr: "",
  nameFr: "",
  lat: "",
  lng: "",
  address: "",
  city: "Tunis",
  operator: "",
  status: "operational",
  access: "public",
  exclusiveTo: "",
  amenities: [],
  verified: true,
  connectors: [EMPTY_CONNECTOR()],
};

type AddChargerModalProps = {
  onClose: () => void;
  onCreated: () => void;
};

const parseCoord = (s: string): number | null => {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
};

// Accepts either "lat, lng" pairs (raw paste) or a Google Maps URL — pulling
// the place pin coords from `!3d<lat>!4d<lng>` first and falling back to
// `@<lat>,<lng>` (map center). This mirrors the agent's extraction order.
const parsePastedCoords = (raw: string): { lat: string; lng: string } | null => {
  const txt = raw.trim();
  if (!txt) return null;
  const pin = txt.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (pin) return { lat: pin[1], lng: pin[2] };
  const at = txt.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return { lat: at[1], lng: at[2] };
  const pair = txt.match(/^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/);
  if (pair) return { lat: pair[1], lng: pair[2] };
  return null;
};

const validate = (s: FormState): { ok: true; payload: AddChargerPayload } | { ok: false; error: string } => {
  if (!s.name.trim()) return { ok: false, error: "Name is required" };
  if (!s.nameAr.trim()) return { ok: false, error: "Arabic name is required" };
  if (!s.city.trim()) return { ok: false, error: "City is required" };
  const lat = parseCoord(s.lat);
  const lng = parseCoord(s.lng);
  if (lat === null || lat < -90 || lat > 90) return { ok: false, error: "Latitude must be between -90 and 90" };
  if (lng === null || lng < -180 || lng > 180) return { ok: false, error: "Longitude must be between -180 and 180" };
  if (s.connectors.length === 0) return { ok: false, error: "Add at least one connector" };

  const connectors: RawConnector[] = [];
  for (const [i, c] of s.connectors.entries()) {
    const power_kw = Number(c.power_kw);
    const count = Number(c.count);
    if (!Number.isFinite(power_kw) || power_kw <= 0)
      return { ok: false, error: `Connector ${i + 1}: power (kW) must be positive` };
    if (!Number.isFinite(count) || count < 1 || !Number.isInteger(count))
      return { ok: false, error: `Connector ${i + 1}: count must be a positive integer` };
    connectors.push({ type: c.type, power_kw, count });
  }

  let exclusive_to: string[] | null = null;
  if (s.access === "brand_exclusive") {
    const brands = s.exclusiveTo
      .split(",")
      .map((b) => b.trim())
      .filter(Boolean);
    if (brands.length === 0)
      return { ok: false, error: "Brand-exclusive needs at least one brand in `exclusive_to`" };
    exclusive_to = brands;
  }

  return {
    ok: true,
    payload: {
      name: s.name.trim(),
      name_ar: s.nameAr.trim(),
      name_fr: (s.nameFr.trim() || s.name.trim()),
      latitude: lat,
      longitude: lng,
      address: s.address.trim() || null,
      city: s.city.trim(),
      connectors,
      operator: s.operator.trim() || null,
      status: s.status,
      access_type: s.access,
      exclusive_to,
      amenities: s.amenities,
      is_verified: s.verified,
    },
  };
};

const submit = async (payload: AddChargerPayload): Promise<{ id: string; name: string }> => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-add-charger`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ADMIN_API_SECRET}`,
    },
    body: JSON.stringify(payload),
  });
  let body: { id?: string; name?: string; error?: string } = {};
  try {
    body = (await res.json()) as { id?: string; name?: string; error?: string };
  } catch {
    // non-JSON response; fall through to status-based error
  }
  if (!res.ok) {
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return { id: body.id ?? "", name: body.name ?? payload.name };
};

export const AddChargerModal = ({ onClose, onCreated }: AddChargerModalProps) => {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const updateConnector = (i: number, patch: Partial<ConnectorDraft>) =>
    setForm((prev) => ({
      ...prev,
      connectors: prev.connectors.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
    }));

  const addConnector = () =>
    setForm((prev) => ({ ...prev, connectors: [...prev.connectors, EMPTY_CONNECTOR()] }));

  const removeConnector = (i: number) =>
    setForm((prev) => ({
      ...prev,
      connectors: prev.connectors.filter((_, idx) => idx !== i),
    }));

  const toggleAmenity = (slug: string) =>
    setForm((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(slug)
        ? prev.amenities.filter((a) => a !== slug)
        : [...prev.amenities, slug],
    }));

  const handlePasteCoords = (raw: string) => {
    const parsed = parsePastedCoords(raw);
    if (parsed) setForm((prev) => ({ ...prev, lat: parsed.lat, lng: parsed.lng }));
  };

  const handleSubmit = async () => {
    setError(null);
    const v = validate(form);
    if (!v.ok) {
      setError(v.error);
      return;
    }
    if (!ADMIN_API_CONFIGURED) {
      setError("Admin API not configured");
      return;
    }
    setSubmitting(true);
    try {
      await submit(v.payload);
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create charger");
    } finally {
      setSubmitting(false);
    }
  };

  const accessIsBrandExclusive = form.access === "brand_exclusive";

  const peakPower = useMemo(
    () =>
      form.connectors.reduce((max, c) => {
        const n = Number(c.power_kw);
        return Number.isFinite(n) ? Math.max(max, n) : max;
      }, 0),
    [form.connectors],
  );

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,.5)",
          zIndex: 60,
          animation: "fadeIn .15s",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed",
          insetBlock: 0,
          insetInlineEnd: 0,
          width: "min(560px, 96vw)",
          background: "var(--bg-elev)",
          borderInlineStart: "1px solid var(--border-strong)",
          zIndex: 61,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-12px 0 40px rgba(0,0,0,.35)",
          animation: "slideIn .25s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={smallLbl}>New charger</div>
            <h2 style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 600 }}>
              Add a charging station
            </h2>
          </div>
          <button onClick={onClose} aria-label="Close" style={iconBtnStyle}>
            <Icons.X size={14} />
          </button>
        </div>

        <div
          style={{
            overflow: "auto",
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 18,
            flex: 1,
          }}
        >
          <Section title="Names">
            <Field label="Name (display)">
              <input
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="e.g. Hotel Le Corail"
                style={inputStyle}
              />
            </Field>
            <Row>
              <Field label="Name (Arabic)">
                <input
                  value={form.nameAr}
                  onChange={(e) => update("nameAr", e.target.value)}
                  dir="rtl"
                  placeholder="فندق لو كوراي"
                  style={{ ...inputStyle, fontFamily: "inherit" }}
                />
              </Field>
              <Field label="Name (French — optional)">
                <input
                  value={form.nameFr}
                  onChange={(e) => update("nameFr", e.target.value)}
                  placeholder="Defaults to Name"
                  style={inputStyle}
                />
              </Field>
            </Row>
          </Section>

          <Section title="Location">
            <Field label="Paste coordinates or Google Maps link">
              <input
                onChange={(e) => handlePasteCoords(e.target.value)}
                placeholder="36.84, 10.27 — or paste a maps URL"
                style={inputStyle}
              />
              <div style={hintStyle}>
                Auto-extracts <code>!3d!4d</code> (place pin) then <code>@lat,lng</code>.
              </div>
            </Field>
            <Row>
              <Field label="Latitude">
                <input
                  inputMode="decimal"
                  value={form.lat}
                  onChange={(e) => update("lat", e.target.value)}
                  placeholder="36.840000"
                  style={{ ...inputStyle, fontVariantNumeric: "tabular-nums" }}
                />
              </Field>
              <Field label="Longitude">
                <input
                  inputMode="decimal"
                  value={form.lng}
                  onChange={(e) => update("lng", e.target.value)}
                  placeholder="10.270000"
                  style={{ ...inputStyle, fontVariantNumeric: "tabular-nums" }}
                />
              </Field>
            </Row>
            <Row>
              <Field label="City (governorate)">
                <input
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                  placeholder="Tunis, Ariana, Sfax…"
                  style={inputStyle}
                />
              </Field>
              <Field label="Address (optional)">
                <input
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                  placeholder="Street, neighborhood, city"
                  style={inputStyle}
                />
              </Field>
            </Row>
          </Section>

          <Section title={`Connectors · peak ${peakPower || "—"} kW`}>
            {form.connectors.map((c, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.2fr 1fr 0.7fr 28px",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <select
                  value={c.type}
                  onChange={(e) => updateConnector(i, { type: e.target.value as ConnectorTypeRaw })}
                  style={inputStyle}
                >
                  {CONNECTOR_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <input
                  inputMode="numeric"
                  value={c.power_kw}
                  onChange={(e) => updateConnector(i, { power_kw: e.target.value })}
                  placeholder="kW"
                  style={inputStyle}
                />
                <input
                  inputMode="numeric"
                  value={c.count}
                  onChange={(e) => updateConnector(i, { count: e.target.value })}
                  placeholder="count"
                  style={inputStyle}
                />
                <button
                  onClick={() => removeConnector(i)}
                  disabled={form.connectors.length === 1}
                  aria-label={`Remove connector ${i + 1}`}
                  title="Remove connector"
                  style={{
                    ...iconBtnStyle,
                    opacity: form.connectors.length === 1 ? 0.4 : 1,
                    cursor: form.connectors.length === 1 ? "not-allowed" : "pointer",
                  }}
                >
                  <Icons.X size={12} />
                </button>
              </div>
            ))}
            <button
              onClick={addConnector}
              style={{
                alignSelf: "flex-start",
                fontSize: 12,
                color: "var(--accent)",
                background: "var(--accent-soft)",
                border: "1px solid var(--accent-border)",
                padding: "6px 10px",
                borderRadius: 6,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
              }}
            >
              <Icons.Plus size={11} stroke={2.4} /> Add connector
            </button>
          </Section>

          <Section title="Operator & status">
            <Row>
              <Field label="Operator (optional)">
                <input
                  value={form.operator}
                  onChange={(e) => update("operator", e.target.value)}
                  placeholder="TotalEnergies, BNA, Le Moteur…"
                  style={inputStyle}
                />
              </Field>
              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(e) => update("status", e.target.value as ChargerStatus)}
                  style={inputStyle}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.v} value={o.v}>
                      {o.l}
                    </option>
                  ))}
                </select>
              </Field>
            </Row>
          </Section>

          <Section title="Access">
            <Field label="Access type">
              <select
                value={form.access}
                onChange={(e) => update("access", e.target.value as AccessType)}
                style={inputStyle}
              >
                {ACCESS_OPTIONS.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.l}
                  </option>
                ))}
              </select>
            </Field>
            {accessIsBrandExclusive && (
              <Field label="Exclusive to (comma-separated brands)">
                <input
                  value={form.exclusiveTo}
                  onChange={(e) => update("exclusiveTo", e.target.value)}
                  placeholder="Audi, Volkswagen, Porsche, Škoda"
                  style={inputStyle}
                />
              </Field>
            )}
          </Section>

          <Section title="Amenities (optional)">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {AMENITY_SLUGS.map((slug) => {
                const on = form.amenities.includes(slug);
                return (
                  <button
                    key={slug}
                    onClick={() => toggleAmenity(slug)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 11,
                      padding: "5px 10px",
                      borderRadius: 14,
                      border: `1px solid ${on ? "var(--accent-border)" : "var(--border)"}`,
                      background: on ? "var(--accent-soft)" : "var(--bg-elev-2)",
                      color: on ? "var(--accent)" : "var(--text-muted)",
                      cursor: "pointer",
                    }}
                  >
                    <AmenityIcon slug={slug} size={12} />
                    {labelForAmenity(slug)}
                  </button>
                );
              })}
            </div>
          </Section>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              background: "var(--bg-elev-2)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              fontSize: 12,
              color: "var(--text)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={form.verified}
              onChange={(e) => update("verified", e.target.checked)}
            />
            Mark as verified by Ala on creation
          </label>
        </div>

        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {error && (
            <div
              style={{
                fontSize: 11,
                color: "var(--red)",
                padding: "6px 10px",
                background: "color-mix(in srgb, var(--red) 10%, transparent)",
                border: "1px solid color-mix(in srgb, var(--red) 30%, transparent)",
                borderRadius: 6,
              }}
            >
              {error}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              onClick={onClose}
              style={{
                padding: "8px 14px",
                background: "transparent",
                color: "var(--text-muted)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !ADMIN_API_CONFIGURED}
              title={ADMIN_API_CONFIGURED ? undefined : "Admin API not configured"}
              style={{
                padding: "8px 14px",
                background: "var(--accent)",
                color: "#0a0a0b",
                border: "none",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                cursor: submitting || !ADMIN_API_CONFIGURED ? "not-allowed" : "pointer",
                opacity: submitting || !ADMIN_API_CONFIGURED ? 0.6 : 1,
              }}
            >
              <Icons.Plus size={12} stroke={2.4} />
              {submitting ? "Creating…" : "Create charger"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    <div style={smallLbl}>{title}</div>
    {children}
  </div>
);

const Row = ({ children }: { children: ReactNode }) => (
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{children}</div>
);

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{label}</span>
    {children}
  </label>
);

const inputStyle: CSSProperties = {
  width: "100%",
  height: 34,
  background: "var(--bg-elev-2)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  paddingInline: 10,
  color: "var(--text)",
  fontFamily: "inherit",
  fontSize: 12,
  outline: "none",
};

const hintStyle: CSSProperties = {
  fontSize: 10,
  color: "var(--text-dim)",
  marginTop: 2,
};

const smallLbl: CSSProperties = {
  fontSize: 10,
  color: "var(--text-dim)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};
