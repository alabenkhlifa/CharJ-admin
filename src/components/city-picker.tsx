import { cloneElement, useId, useMemo, useState } from "react";
import type { CSSProperties, KeyboardEvent, ReactElement, ReactNode } from "react";
import { createCity, useLocations } from "../data/locations";
import {
  cityPlace,
  groupCities,
  slugify,
  validateNewCity,
  type City,
  type NewCityDraft,
} from "../data/locations-model";
import { Icons } from "../lib/icons";

// Searchable city picker grouped by governorate, shared by the Add-charger
// modal and the structured editor. Picking a city sets `chargers.city_id`;
// the database derives the legacy `city` text from it.
//
// The option list renders in the flow (not as a floating popover) so it
// never gets clipped by the scrolling drawer body and works at 375px.

type CityPickerProps = {
  id?: string;
  value: string | null;
  onChange: (cityId: string | null) => void;
  // Charger pin: seeds a new city's location.
  pin: { lat: number; lng: number } | null;
  // governorate_for_point(pin): seeds a new city's governorate and drives the
  // mismatch warning.
  pinGovernorate: string | null;
  // suggest_city(pin), offered while nothing is picked.
  suggestedCityId?: string | null;
  // Modal inputs are styled inline; the editor styles them through its CSS.
  inputStyle?: CSSProperties;
};

const ADD = "__add__";

export const CityPicker = ({
  id,
  value,
  onChange,
  pin,
  pinGovernorate,
  suggestedCityId,
  inputStyle,
}: CityPickerProps) => {
  const { governorates, cities, loading, error, reload } = useLocations();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [adding, setAdding] = useState<NewCityDraft | null>(null);
  const listId = useId();

  const selected = value ? cities.find((c) => c.id === value) : undefined;
  const suggested =
    !value && suggestedCityId ? cities.find((c) => c.id === suggestedCityId) : undefined;
  const govName = (code: string | null) =>
    governorates.find((g) => g.code === code)?.name_fr ?? code ?? "";
  const govNameAr = (code: string) => governorates.find((g) => g.code === code)?.name_ar ?? "";

  const groups = useMemo(
    () => groupCities(cities, governorates, open ? query : ""),
    [cities, governorates, open, query],
  );
  // Keyboard order: every visible city, then "Add city".
  const options = useMemo(
    () => [...groups.flatMap((g) => g.cities.map((c) => c.id)), ADD],
    [groups],
  );
  const activeId = options[Math.min(active, options.length - 1)];
  const optionId = (v: string) => `${listId}-${v}`;

  const openList = () => {
    setOpen(true);
    setQuery("");
    setActive(0);
  };

  const choose = (city: City) => {
    onChange(city.id);
    setOpen(false);
    setQuery("");
  };

  const startAdd = () => {
    const name = query.trim();
    setAdding({
      name_fr: name,
      name_ar: "",
      name_en: name,
      slug: slugify(name),
      governorate_code: pinGovernorate ?? "",
      lat: pin ? String(pin.lat) : "",
      lng: pin ? String(pin.lng) : "",
    });
    setOpen(false);
    setQuery("");
  };

  const pick = (v: string) => {
    if (v === ADD) startAdd();
    else {
      const city = cities.find((c) => c.id === v);
      if (city) choose(city);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (Math.min(i, options.length - 1) + step + options.length) % options.length);
    } else if (e.key === "Enter") {
      // Never let Enter submit the surrounding editor form.
      e.preventDefault();
      if (open && activeId) pick(activeId);
      else setOpen(true);
    } else if (e.key === "Escape" && open) {
      // Close the list, not the drawer around it.
      e.stopPropagation();
      setOpen(false);
      setQuery("");
    }
  };

  const mismatch = Boolean(
    selected && pinGovernorate && selected.governorate_code !== pinGovernorate,
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <div style={{ position: "relative" }}>
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && activeId ? optionId(activeId) : undefined}
          autoComplete="off"
          value={open ? query : selected ? cityPlace(selected, governorates) : value ? "Unknown city" : ""}
          placeholder={
            loading ? "Loading cities…" : open ? "Search city or governorate" : "Choose a city"
          }
          onFocus={openList}
          // Still focused after a pick: a click reopens the list.
          onClick={() => {
            if (!open) openList();
          }}
          onBlur={() => {
            setOpen(false);
            setQuery("");
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          style={{ width: "100%", ...inputStyle, paddingInlineEnd: 32 }}
        />
        {value && !open && (
          <button
            type="button"
            aria-label="Clear city"
            title="Clear city"
            onClick={() => onChange(null)}
            style={{
              position: "absolute",
              insetInlineEnd: 4,
              top: "50%",
              transform: "translateY(-50%)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 26,
              height: 26,
              padding: 0,
              background: "transparent",
              border: "none",
              color: "var(--ink-2)",
              cursor: "pointer",
            }}
          >
            <Icons.X size={12} />
          </button>
        )}
      </div>

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label="Cities"
          style={{
            maxHeight: 260,
            overflowY: "auto",
            padding: 4,
            background: "var(--card)",
            border: "0",
            borderRadius: 10,
          }}
        >
          {groups.length === 0 && (
            <div style={{ padding: "8px", fontSize: 15, color: "var(--ink-2)" }}>
              {loading
                ? "Loading cities…"
                : query.trim()
                  ? `No city matches “${query.trim()}”.`
                  : "No cities yet."}
            </div>
          )}
          {groups.map((g) => (
            <div key={g.governorate.code} role="group" aria-label={g.governorate.name_fr}>
              <div style={groupHeaderStyle}>
                <span>{g.governorate.name_fr}</span>
                {g.governorate.name_ar && <span dir="rtl">{g.governorate.name_ar}</span>}
              </div>
              {g.cities.map((c) => (
                <Option
                  key={c.id}
                  id={optionId(c.id)}
                  active={activeId === c.id}
                  selected={c.id === value}
                  onHover={() => setActive(options.indexOf(c.id))}
                  onPick={() => choose(c)}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    {c.id === value && <Icons.Check size={12} />}
                    {c.name_fr}
                  </span>
                  <span dir="rtl" style={{ color: "var(--ink-2)" }}>
                    {c.name_ar}
                  </span>
                </Option>
              ))}
            </div>
          ))}
          <Option
            id={optionId(ADD)}
            active={activeId === ADD}
            selected={false}
            onHover={() => setActive(options.length - 1)}
            onPick={startAdd}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--c-screens-text)" }}>
              <Icons.Plus size={12} stroke={2.4} />
              {query.trim() ? `Add city “${query.trim()}”` : "Add a city"}
            </span>
          </Option>
        </div>
      )}

      {selected && !open && (selected.name_ar || govNameAr(selected.governorate_code)) && (
        <div style={hintStyle}>
          <span dir="rtl">
            {[selected.name_ar, govNameAr(selected.governorate_code)].filter(Boolean).join(" · ")}
          </span>
        </div>
      )}

      {selected && mismatch && (
        <span role="status" style={warningChipStyle}>
          The pin is in {govName(pinGovernorate)}, but {selected.name_fr} is in{" "}
          {govName(selected.governorate_code)}.
        </span>
      )}

      {suggested && !open && (
        <div style={{ ...hintStyle, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span>Suggested from the pin: {cityPlace(suggested, governorates)}</span>
          <button type="button" onClick={() => onChange(suggested.id)} style={linkButtonStyle}>
            Use
          </button>
        </div>
      )}

      {error && (
        <div style={{ ...hintStyle, color: "var(--c-alarm-text)", display: "flex", gap: 8, alignItems: "center" }}>
          <span>Could not load cities: {error}</span>
          <button type="button" onClick={() => void reload()} style={linkButtonStyle}>
            Retry
          </button>
        </div>
      )}

      {adding && (
        <AddCityForm
          draft={adding}
          cities={cities}
          governorates={governorates}
          pinGovernorate={pinGovernorate}
          inputStyle={inputStyle}
          onChange={setAdding}
          onCancel={() => setAdding(null)}
          onCreated={(city) => {
            setAdding(null);
            onChange(city.id);
          }}
        />
      )}
    </div>
  );
};

const Option = ({
  id,
  active,
  selected,
  onHover,
  onPick,
  children,
}: {
  id: string;
  active: boolean;
  selected: boolean;
  onHover: () => void;
  onPick: () => void;
  children: ReactNode;
}) => (
  <div
    id={id}
    role="option"
    aria-selected={selected}
    // Keep focus in the input so blur doesn't close the list before the click lands.
    onMouseDown={(e) => e.preventDefault()}
    onMouseEnter={onHover}
    onClick={onPick}
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
      padding: "7px 8px",
      borderRadius: 10,
      fontSize: 15,
      cursor: "pointer",
      color: selected ? "var(--c-screens-text)" : "var(--ink)",
      background: active ? "var(--card-pressed)" : "transparent",
    }}
  >
    {children}
  </div>
);

// ── Inline "Add city" ─────────────────────────────────────────────────────

const AddCityForm = ({
  draft,
  cities,
  governorates,
  pinGovernorate,
  inputStyle,
  onChange,
  onCancel,
  onCreated,
}: {
  draft: NewCityDraft;
  cities: City[];
  governorates: { code: string; name_fr: string; name_ar: string }[];
  pinGovernorate: string | null;
  inputStyle?: CSSProperties;
  onChange: (draft: NewCityDraft) => void;
  onCancel: () => void;
  onCreated: (city: City) => void;
}) => {
  // The slug and English name follow the French name until edited by hand.
  const [slugTouched, setSlugTouched] = useState(false);
  const [enTouched, setEnTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<NewCityDraft>) => onChange({ ...draft, ...patch });

  const save = async () => {
    setError(null);
    const v = validateNewCity(draft, cities);
    if (!v.ok) {
      setError(v.error);
      return;
    }
    setSaving(true);
    try {
      onCreated(await createCity(v.payload));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the city");
    } finally {
      setSaving(false);
    }
  };

  // This form sits inside the editor's <form>: Enter saves the city instead.
  const onEnter = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
      e.preventDefault();
      if (!saving) void save();
    }
  };

  const sorted = [...governorates].sort((a, b) => a.name_fr.localeCompare(b.name_fr, "fr"));
  const input = { width: "100%", ...inputStyle };

  return (
    <div
      role="group"
      aria-label="New city"
      onKeyDown={onEnter}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 12,
        border: "0",
        borderRadius: 10,
        background: "var(--fill)",
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>New city</div>
      <div style={gridStyle}>
        <SmallField label="City name (French)">
          <input
            value={draft.name_fr}
            onChange={(e) =>
              set({
                name_fr: e.target.value,
                ...(slugTouched ? {} : { slug: slugify(e.target.value) }),
                ...(enTouched ? {} : { name_en: e.target.value }),
              })
            }
            placeholder="Hammamet"
            style={input}
          />
        </SmallField>
        <SmallField label="City name (Arabic)">
          <input
            dir="rtl"
            value={draft.name_ar}
            onChange={(e) => set({ name_ar: e.target.value })}
            placeholder="الحمامات"
            style={input}
          />
        </SmallField>
        <SmallField label="City name (English)">
          <input
            value={draft.name_en}
            onChange={(e) => {
              setEnTouched(true);
              set({ name_en: e.target.value });
            }}
            style={input}
          />
        </SmallField>
        <SmallField label="City slug">
          <input
            value={draft.slug}
            onChange={(e) => {
              setSlugTouched(true);
              set({ slug: e.target.value });
            }}
            placeholder="hammamet"
            style={input}
          />
        </SmallField>
        <SmallField
          label="City governorate"
          wide
          hint={
            pinGovernorate && draft.governorate_code === pinGovernorate
              ? "From the charger pin"
              : undefined
          }
        >
          <select
            value={draft.governorate_code}
            onChange={(e) => set({ governorate_code: e.target.value })}
            style={input}
          >
            <option value="">Choose…</option>
            {sorted.map((g) => (
              <option key={g.code} value={g.code}>
                {g.name_fr}
                {g.name_ar ? ` · ${g.name_ar}` : ""}
              </option>
            ))}
          </select>
        </SmallField>
        <SmallField label="City latitude" hint="City centre. Defaults to the charger pin.">
          <input
            inputMode="decimal"
            value={draft.lat}
            onChange={(e) => set({ lat: e.target.value })}
            style={input}
          />
        </SmallField>
        <SmallField label="City longitude">
          <input
            inputMode="decimal"
            value={draft.lng}
            onChange={(e) => set({ lng: e.target.value })}
            style={input}
          />
        </SmallField>
      </div>
      {error && (
        <div role="alert" style={{ fontSize: 13, color: "var(--c-alarm-text)" }}>
          {error}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button type="button" onClick={onCancel} disabled={saving} style={secondaryButtonStyle}>
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          style={{ ...secondaryButtonStyle, color: "var(--c-screens-text)", background: "color-mix(in srgb, var(--c-screens) 14%, transparent)" }}
        >
          {saving ? "Adding…" : "Add city"}
        </button>
      </div>
    </div>
  );
};

// Labelled by id, not by wrapping: a <select> inside its <label> takes the
// selected option's text into its accessible name.
const SmallField = ({
  label,
  hint,
  wide = false,
  children,
}: {
  label: string;
  hint?: string;
  wide?: boolean;
  children: ReactElement<{ id?: string }>;
}) => {
  const id = useId();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        minWidth: 0,
        gridColumn: wide ? "1 / -1" : undefined,
      }}
    >
      <label htmlFor={id} style={{ fontSize: 13, color: "var(--ink-2)" }}>
        {label}
      </label>
      {cloneElement(children, { id })}
      {hint && <span style={hintStyle}>{hint}</span>}
    </div>
  );
};

const gridStyle: CSSProperties = {
  display: "grid",
  // Two columns in the modal and the editor, one on a phone.
  gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))",
  gap: 10,
};

const groupHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  padding: "8px 8px 4px",
  fontSize: 13,
  color: "var(--ink-2)",
};

const hintStyle: CSSProperties = {
  fontSize: 13,
  color: "var(--ink-2)",
};

const warningChipStyle: CSSProperties = {
  alignSelf: "flex-start",
  fontSize: 13,
  lineHeight: 1.5,
  color: "var(--c-needs-you-text)",
  padding: "4px 8px",
  borderRadius: 10,
  background: "color-mix(in srgb, var(--c-needs-you) 12%, transparent)",
};

const linkButtonStyle: CSSProperties = {
  padding: 0,
  background: "transparent",
  border: "none",
  color: "var(--c-screens-text)",
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  minHeight: 34,
  padding: "6px 14px",
  background: "var(--fill)",
  color: "var(--ink)",
  border: "0",
  borderRadius: 10,
  fontFamily: "inherit",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
};
