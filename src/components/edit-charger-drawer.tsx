import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { ReactElement, ReactNode } from "react";
import {
  CHARGER_EDITOR_CONFIGURED,
  loadChargerForEdit,
  saveCharger,
} from "../data/charger-editor";
import {
  buildChanges,
  createDraft,
  DAYS,
  isDirty,
  newConnector,
} from "../data/charger-editor-model";
import type {
  AdminCharger,
  ChargerDraft,
  Day,
  DayDraft,
} from "../data/charger-editor-model";
import {
  AMENITY_SLUGS,
  AmenityIcon,
  labelForAmenity,
} from "../lib/amenity-icons";
import { Icons } from "../lib/icons";
import "./edit-charger-drawer.css";

type Props = {
  chargerId: string;
  onClose: () => void;
  onSaved: (charger: AdminCharger) => void;
};
const sections = [
  "Identity",
  "Location",
  "Connectors",
  "Access",
  "Hours",
  "Amenities",
  "Photos",
  "Contact",
  "Verification",
  "Source",
];

export function EditChargerDrawer({ chargerId, onClose, onSaved }: Props) {
  const [charger, setCharger] = useState<AdminCharger | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    loadChargerForEdit(chargerId, controller.signal)
      .then(setCharger)
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(
            err instanceof Error ? err.message : "Unable to load charger",
          );
      });
    return () => controller.abort();
  }, [chargerId, attempt]);

  return charger ? (
    <Editor
      key={charger.updated_at}
      charger={charger}
      onClose={onClose}
      onSaved={onSaved}
    />
  ) : (
    <Drawer onClose={onClose}>
      <header className="charger-editor-header">
        <div>
          <div className="charger-editor-eyebrow">Charger editor</div>
          <h2 id="charger-editor-title">Load charger details</h2>
        </div>
        <Close onClick={onClose} />
      </header>
      <div className="charger-editor-body">
        {error ? (
          <>
            <p role="alert" className="charger-editor-error">
              {error}
            </p>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setAttempt((v) => v + 1);
              }}
            >
              Retry
            </button>
          </>
        ) : (
          <p role="status">Loading the latest charger details…</p>
        )}
      </div>
    </Drawer>
  );
}

function Editor({
  charger,
  onClose,
  onSaved,
}: {
  charger: AdminCharger;
  onClose: () => void;
  onSaved: Props["onSaved"];
}) {
  const [original, setOriginal] = useState(charger);
  const [draft, setDraft] = useState(() => createDraft(charger));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discard, setDiscard] = useState(false);
  const dirty = isDirty(draft, createDraft(original));
  const close = useCallback(() => {
    if (!busy) {
      if (dirty) setDiscard(true);
      else onClose();
    }
  }, [busy, dirty, onClose]);
  const update = <K extends keyof ChargerDraft>(
    key: K,
    value: ChargerDraft[K],
  ) => setDraft((d) => ({ ...d, [key]: value }));
  const updateDay = (day: Day, patch: Partial<DayDraft>) =>
    setDraft((d) => ({
      ...d,
      days: { ...d.days, [day]: { ...d.days[day], ...patch } },
    }));

  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);

  const submit = async () => {
    setError(null);
    try {
      const changes = buildChanges(draft, original);
      if (!Object.keys(changes).length) {
        onClose();
        return;
      }
      setBusy(true);
      const saved = await saveCharger(original, changes);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save charger");
    } finally {
      setBusy(false);
    }
  };
  const reload = async () => {
    setBusy(true);
    try {
      const latest = await loadChargerForEdit(original.id);
      setOriginal(latest);
      setDraft(createDraft(latest));
      setError(null);
      setDiscard(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reload");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer onClose={close}>
      <header className="charger-editor-header">
        <div>
          <div className="charger-editor-eyebrow">
            Edit charger · {original.id.slice(0, 8)}
          </div>
          <h2 id="charger-editor-title">{original.name}</h2>
          <p>
            Update station details. Edited fields stay protected during OCM
            sync.
          </p>
        </div>
        <Close onClick={close} disabled={busy} />
      </header>
      <nav className="charger-editor-nav" aria-label="Editor sections">
        {sections.map((s) => (
          <a
            key={s}
            href={`#edit-${s.toLowerCase()}`}
            onClick={(e) => {
              e.preventDefault();
              document
                .getElementById(`edit-${s.toLowerCase()}`)
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            {s}
          </a>
        ))}
      </nav>
      <form
        className="charger-editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <fieldset className="charger-editor-body" disabled={busy}>
          <Section
            title="Identity"
            description="Display name, translations, and operator."
          >
            <Field label="Display name">
              <input
                value={draft.name}
                required
                maxLength={2000}
                onChange={(e) => update("name", e.target.value)}
              />
            </Field>
            <div className="charger-editor-grid">
              <Field label="French name">
                <input
                  value={draft.name_fr}
                  onChange={(e) => update("name_fr", e.target.value)}
                />
              </Field>
              <Field label="Arabic name">
                <input
                  dir="rtl"
                  value={draft.name_ar}
                  onChange={(e) => update("name_ar", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Operator">
              <input
                value={draft.operator}
                onChange={(e) => update("operator", e.target.value)}
                placeholder="Business or charging network"
              />
            </Field>
            <Field label="Status">
              <select
                value={draft.status}
                onChange={(e) => update("status", e.target.value)}
              >
                {["operational", "under_repair", "planned", "unknown"].map(
                  (v) => (
                    <option key={v} value={v}>
                      {label(v)}
                    </option>
                  ),
                )}
              </select>
            </Field>
          </Section>
          <Section
            title="Location"
            description="Coordinates identify the exact charging point."
          >
            <div className="charger-editor-grid">
              <Field label="Latitude">
                <input
                  inputMode="decimal"
                  value={draft.latitude}
                  required
                  onChange={(e) => update("latitude", e.target.value)}
                />
              </Field>
              <Field label="Longitude">
                <input
                  inputMode="decimal"
                  value={draft.longitude}
                  required
                  onChange={(e) => update("longitude", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Address">
              <textarea
                rows={2}
                value={draft.address}
                onChange={(e) => update("address", e.target.value)}
              />
            </Field>
            <Field label="City / governorate">
              <input
                value={draft.city}
                onChange={(e) => update("city", e.target.value)}
              />
            </Field>
          </Section>
          <Section
            title="Connectors"
            description="Add a row for each connector type and power rating. Count is the number of matching sockets."
            count={draft.connectors.length}
          >
            <datalist id="charger-connector-types">
              {[
                "Type 2",
                "CCS",
                "CHAdeMO",
                "Type 1",
                "Tesla (Model S/X)",
                "GB/T",
                "NACS",
              ].map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
            {draft.connectors.length === 0 && (
              <p className="charger-editor-hint">
                No connector information recorded.
              </p>
            )}
            {draft.connectors.map((c, i) => (
              <div className="charger-editor-item" key={i}>
                <div className="charger-editor-item-heading">
                  <strong>Connector {i + 1}</strong>
                  <Remove
                    label={`Remove connector ${i + 1}`}
                    onClick={() =>
                      update(
                        "connectors",
                        draft.connectors.filter((_, index) => i !== index),
                      )
                    }
                  />
                </div>
                <Field label={`Connector ${i + 1} type`}>
                  <input
                    list="charger-connector-types"
                    value={c.type}
                    required
                    onChange={(e) =>
                      update(
                        "connectors",
                        draft.connectors.map((v, index) =>
                          i === index ? { ...v, type: e.target.value } : v,
                        ),
                      )
                    }
                  />
                </Field>
                <div className="charger-editor-grid">
                  <Field label={`Connector ${i + 1} power (kW)`}>
                    <input
                      inputMode="decimal"
                      value={c.power}
                      required
                      onChange={(e) =>
                        update(
                          "connectors",
                          draft.connectors.map((v, index) =>
                            i === index ? { ...v, power: e.target.value } : v,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label={`Connector ${i + 1} count`}>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={c.count}
                      required
                      onChange={(e) =>
                        update(
                          "connectors",
                          draft.connectors.map((v, index) =>
                            i === index ? { ...v, count: e.target.value } : v,
                          ),
                        )
                      }
                    />
                  </Field>
                </div>
              </div>
            ))}
            <Add
              onClick={() =>
                update("connectors", [...draft.connectors, newConnector()])
              }
            >
              Add connector
            </Add>
          </Section>
          <Section title="Access" description="Set who can use this station.">
            <Field label="Access type">
              <select
                value={draft.access_type}
                onChange={(e) => update("access_type", e.target.value)}
              >
                {[
                  "public",
                  "customers_only",
                  "employees_only",
                  "brand_exclusive",
                  "private_emergency",
                ].map((v) => (
                  <option key={v} value={v}>
                    {label(v)}
                  </option>
                ))}
              </select>
            </Field>
            {draft.access_type !== "public" && (
              <p className="charger-editor-hint">
                {draft.access_type === "brand_exclusive"
                  ? "Trip planning only includes this station for the matching vehicle brands."
                  : "Restricted access. This station is excluded from public trip planning."}
              </p>
            )}
            <StringList
              label="Allowed brand"
              values={draft.exclusive_to}
              onChange={(v) => update("exclusive_to", v)}
              addLabel="Add brand"
            />
            {draft.access_type !== "brand_exclusive" &&
              draft.exclusive_to.length > 0 && (
                <p className="charger-editor-hint">
                  These brands are recorded but only restrict access when Brand
                  exclusive is selected.
                </p>
              )}
          </Section>
          <Section
            title="Hours"
            description="Set each day independently. Use multiple periods for lunch breaks; 24:00 means midnight at the end of the day."
          >
            <Field label="Working hours mode">
              <select
                value={draft.hoursMode}
                onChange={(e) =>
                  update(
                    "hoursMode",
                    e.target.value as ChargerDraft["hoursMode"],
                  )
                }
              >
                <option value="unknown">Unknown / not recorded</option>
                <option value="always">Open 24/7</option>
                <option value="weekly">Weekly schedule</option>
              </select>
            </Field>
            {draft.hoursMode === "weekly" && (
              <>
                <div className="charger-editor-actions">
                  <button
                    type="button"
                    onClick={() =>
                      update("days", {
                        ...draft.days,
                        ...Object.fromEntries(
                          DAYS.slice(1, 5).map((d) => [
                            d,
                            structuredClone(draft.days.mon),
                          ]),
                        ),
                      })
                    }
                  >
                    Copy Monday to weekdays
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      update(
                        "days",
                        Object.fromEntries(
                          DAYS.map((d) => [d, structuredClone(draft.days.mon)]),
                        ) as Record<Day, DayDraft>,
                      )
                    }
                  >
                    Copy Monday to all days
                  </button>
                </div>
                {DAYS.map((day) => (
                  <div className="charger-editor-item" key={day}>
                    <div className="charger-editor-day-heading">
                      <strong>{label(day)}</strong>
                      <select
                        aria-label={`${day} availability`}
                        value={draft.days[day].mode}
                        onChange={(e) =>
                          updateDay(day, {
                            mode: e.target.value as DayDraft["mode"],
                            ranges:
                              e.target.value === "open" &&
                              !draft.days[day].ranges.length
                                ? [{ from: "08:00", to: "17:00" }]
                                : draft.days[day].ranges,
                          })
                        }
                      >
                        <option value="unknown">Unknown</option>
                        <option value="closed">Closed</option>
                        <option value="open">Open</option>
                      </select>
                    </div>
                    {draft.days[day].mode === "open" && (
                      <>
                        {draft.days[day].ranges.map((range, i) => (
                          <div className="charger-editor-time-row" key={i}>
                            <Field label={`${day} start ${i + 1}`}>
                              <input
                                value={range.from}
                                inputMode="numeric"
                                placeholder="08:00"
                                required
                                onChange={(e) =>
                                  updateDay(day, {
                                    ranges: draft.days[day].ranges.map(
                                      (r, index) =>
                                        i === index
                                          ? { ...r, from: e.target.value }
                                          : r,
                                    ),
                                  })
                                }
                              />
                            </Field>
                            <Field label={`${day} end ${i + 1}`}>
                              <input
                                value={range.to}
                                inputMode="numeric"
                                placeholder="24:00"
                                required
                                onChange={(e) =>
                                  updateDay(day, {
                                    ranges: draft.days[day].ranges.map(
                                      (r, index) =>
                                        i === index
                                          ? { ...r, to: e.target.value }
                                          : r,
                                    ),
                                  })
                                }
                              />
                            </Field>
                            <Remove
                              label={`Remove ${day} period ${i + 1}`}
                              onClick={() =>
                                updateDay(day, {
                                  ranges: draft.days[day].ranges.filter(
                                    (_, index) => index !== i,
                                  ),
                                })
                              }
                            />
                          </div>
                        ))}
                        <Add
                          onClick={() =>
                            updateDay(day, {
                              ranges: [
                                ...draft.days[day].ranges,
                                { from: "", to: "" },
                              ],
                            })
                          }
                        >
                          Add {day} period
                        </Add>
                      </>
                    )}
                  </div>
                ))}
              </>
            )}
          </Section>
          <Section
            title="Amenities"
            description="Select the services available on site."
            count={draft.amenities.length}
          >
            <div className="charger-editor-amenities">
              {AMENITY_SLUGS.map((slug) => (
                <label key={slug}>
                  <input
                    type="checkbox"
                    checked={draft.amenities.includes(slug)}
                    onChange={(e) =>
                      update(
                        "amenities",
                        e.target.checked
                          ? [...draft.amenities, slug]
                          : draft.amenities.filter((v) => v !== slug),
                      )
                    }
                  />
                  <AmenityIcon slug={slug} size={15} />
                  {labelForAmenity(slug)}
                </label>
              ))}
            </div>
          </Section>
          <Section
            title="Photos"
            description="Add image URLs in display order. Remove a row to remove its photo."
            count={draft.photos.length}
          >
            <StringList
              label="Photo URL"
              type="url"
              values={draft.photos}
              onChange={(v) => update("photos", v)}
              addLabel="Add photo"
            />
          </Section>
          <Section
            title="Contact"
            description="Changing the phone here only affects this charger, even if its current contact is shared."
          >
            <Field label="Contact phone">
              <input
                type="tel"
                value={draft.contact_phone}
                onChange={(e) => update("contact_phone", e.target.value)}
                placeholder="+216 …"
              />
            </Field>
            <p className="charger-editor-hint">
              Leave empty to remove the contact from this station.
            </p>
          </Section>
          <Section
            title="Verification"
            description="Record who confirmed the station and when."
          >
            <label className="charger-editor-check">
              <input
                type="checkbox"
                checked={draft.is_verified}
                onChange={(e) => update("is_verified", e.target.checked)}
              />
              Station is verified
            </label>
            {draft.is_verified && (
              <div className="charger-editor-grid">
                <Field label="Verified by">
                  <input
                    value={draft.verified_by}
                    onChange={(e) => update("verified_by", e.target.value)}
                  />
                </Field>
                <Field label="Verified at (UTC)">
                  <input
                    type="datetime-local"
                    value={draft.verified_at}
                    onChange={(e) => update("verified_at", e.target.value)}
                  />
                </Field>
              </div>
            )}
            {!draft.is_verified && original.is_verified && (
              <p className="charger-editor-hint">
                Saving will clear the verification name and date.
              </p>
            )}
          </Section>
          <Section
            title="Source"
            description="Changing the OCM link changes which imported record is associated with this station."
          >
            <div className="charger-editor-grid">
              <Field label="Data source">
                <select
                  value={draft.source}
                  onChange={(e) => update("source", e.target.value)}
                >
                  <option value="ocm">Open Charge Map</option>
                  <option value="community">Community / admin</option>
                </select>
              </Field>
              <Field label="OCM ID">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={draft.ocm_id}
                  onChange={(e) => update("ocm_id", e.target.value)}
                />
              </Field>
            </div>
            <details className="charger-editor-metadata">
              <summary>Record details & protected fields</summary>
              <dl>
                <dt>Charger ID</dt>
                <dd>{original.id}</dd>
                <dt>Contact ID</dt>
                <dd>{original.contact_id ?? "None"}</dd>
                <dt>Created</dt>
                <dd>{original.created_at}</dd>
                <dt>Last updated</dt>
                <dd>{original.updated_at}</dd>
              </dl>
              <p>IDs and audit timestamps are managed automatically.</p>
              <div className="charger-editor-tags">
                {Object.keys(original.manual_overrides).map((field) => (
                  <span key={field}>{label(field)}</span>
                ))}
              </div>
              {!Object.keys(original.manual_overrides).length && (
                <p>No fields have manual overrides yet.</p>
              )}
            </details>
          </Section>
        </fieldset>
        <footer className="charger-editor-footer">
          {error && (
            <div role="alert" className="charger-editor-error">
              {error}
              <button
                type="button"
                disabled={busy}
                onClick={() => setDiscard(true)}
              >
                Reload latest details…
              </button>
            </div>
          )}
          {discard ? (
            <div className="charger-editor-discard" role="alert">
              <strong>Discard unsaved changes?</strong>
              <p>Your edits have not been saved.</p>
              <div className="charger-editor-actions">
                <button type="button" onClick={() => setDiscard(false)}>
                  Keep editing
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void reload()}
                >
                  Discard & reload
                </button>
                <button type="button" disabled={busy} onClick={onClose}>
                  Discard & close
                </button>
              </div>
            </div>
          ) : (
            <div className="charger-editor-save-row">
              <span role="status">
                {busy
                  ? "Saving changes…"
                  : dirty
                    ? "Unsaved changes"
                    : "No changes yet"}
              </span>
              <button type="button" disabled={busy} onClick={close}>
                Cancel
              </button>
              <button
                className="charger-editor-primary"
                type="submit"
                disabled={busy || !dirty || !CHARGER_EDITOR_CONFIGURED}
              >
                {busy ? "Saving…" : "Save changes"}
              </button>
            </div>
          )}
        </footer>
      </form>
    </Drawer>
  );
}

function Drawer({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return (
    <>
      <div className="charger-editor-backdrop" onClick={onClose} />
      <div
        ref={ref}
        className="charger-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="charger-editor-title"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
          if (e.key !== "Tab") return;
          const elements = Array.from(
            ref.current?.querySelectorAll<HTMLElement>(
              "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a, summary",
            ) ?? [],
          ).filter(
            (el) => el.getClientRects().length > 0 && !el.matches(":disabled"),
          );
          const first = elements[0],
            last = elements.at(-1);
          if (
            e.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === ref.current)
          ) {
            e.preventDefault();
            last?.focus();
          } else if (
            !e.shiftKey &&
            (document.activeElement === last ||
              document.activeElement === ref.current)
          ) {
            e.preventDefault();
            first?.focus();
          }
        }}
      >
        {children}
      </div>
    </>
  );
}
const label = (value: string) =>
  value.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
const Close = ({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    className="charger-editor-icon"
    aria-label="Close charger editor"
    onClick={onClick}
    disabled={disabled}
  >
    <Icons.X size={16} />
  </button>
);
const Remove = ({
  label: name,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    className="charger-editor-icon"
    aria-label={name}
    onClick={onClick}
  >
    <Icons.X size={14} />
  </button>
);
const Add = ({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) => (
  <button type="button" className="charger-editor-add" onClick={onClick}>
    <Icons.Plus size={13} />
    {children}
  </button>
);
const Field = ({
  label: name,
  children,
}: {
  label: string;
  children: ReactElement<{ id?: string }>;
}) => {
  const id = useId();
  return (
    <div className="charger-editor-field">
      <label htmlFor={id}>{name}</label>
      {cloneElement(children, { id })}
    </div>
  );
};
const Section = ({
  title,
  description,
  count,
  children,
}: {
  title: string;
  description: string;
  count?: number;
  children: ReactNode;
}) => (
  <section
    id={`edit-${title.toLowerCase()}`}
    className="charger-editor-section"
  >
    <div>
      <h3>
        {title}
        {count !== undefined && <span>{count}</span>}
      </h3>
      <p>{description}</p>
    </div>
    {children}
  </section>
);
function StringList({
  label: name,
  values,
  onChange,
  addLabel,
  type = "text",
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  addLabel: string;
  type?: string;
}) {
  return (
    <>
      {values.map((v, i) => (
        <div className="charger-editor-list-row" key={i}>
          <Field label={`${name} ${i + 1}`}>
            <input
              type={type}
              value={v}
              required
              onChange={(e) =>
                onChange(
                  values.map((old, index) =>
                    i === index ? e.target.value : old,
                  ),
                )
              }
            />
          </Field>
          <Remove
            label={`Remove ${name.toLowerCase()} ${i + 1}`}
            onClick={() => onChange(values.filter((_, index) => i !== index))}
          />
        </div>
      ))}
      <Add onClick={() => onChange([...values, ""])}>{addLabel}</Add>
    </>
  );
}
