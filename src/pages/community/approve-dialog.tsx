import { useEffect, useRef, useState } from "react";
import { reviewSubmission } from "../../data/submissions";
import { connectorLine, mapsUrl, NEARBY_METERS, type NearbyCharger, type Submission } from "../../data/submissions-report";
import { buildHash } from "../../lib/use-route";
import { nf } from "./format";

// Approve one submission: a confirm step that shows what the new charger will
// be (name, where, connectors) and the chargers already within 100 m, so a
// duplicate is caught first. The Arabic name, Arabic address and operator are
// optional and never invented; left blank they stay '' and the charger
// editor opens right after, to finish it there. A native <dialog>: focus,
// Escape and the backdrop are the browser's.

export type NearbyState =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "unpinned" }
  | { state: "done"; chargers: NearbyCharger[] };

type Props = {
  submission: Submission;
  nearby: NearbyState;
  onCancel: () => void;
  /** 200: the new charger's id. */
  onApproved: (chargerId: string | null) => void;
  /** 409: someone else got there first. */
  onConflict: () => void;
};

const coordinates = (s: Submission) => (s.lat === null || s.lng === null ? null : `${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}`);

export const NearbyCheck = ({ nearby }: { nearby: NearbyState }) => {
  if (nearby.state === "loading") return <p className="com-meta">Checking for chargers within {NEARBY_METERS} m…</p>;
  if (nearby.state === "error")
    return <p className="com-meta">Couldn't check for chargers nearby ({nearby.message}). Look at the map before approving.</p>;
  if (nearby.state === "unpinned") return <p className="com-meta">No usable pin, so nothing nearby can be checked.</p>;
  if (!nearby.chargers.length) return <p className="com-near">No charger within {NEARBY_METERS} m.</p>;
  const n = nearby.chargers.length;
  return (
    <>
      <p className="com-near">
        <b>
          {n === 1 ? "1 charger" : `${nf.format(n)} chargers`} within {NEARBY_METERS} m.
        </b>{" "}
        It may be this one.
      </p>
      <ul className="com-near-list" aria-label={`Chargers within ${NEARBY_METERS} m`}>
        {nearby.chargers.map((c) => (
          <li key={c.id}>
            <a href={buildHash("chargers", { id: c.id })} target="_blank" rel="noopener" aria-label={`${c.name}, opens in a new tab`}>
              <bdi>{c.name || "Unnamed charger"}</bdi>
            </a>
            <span>{nf.format(c.meters)} m</span>
          </li>
        ))}
      </ul>
    </>
  );
};

export const ApproveDialog = ({ submission: s, nearby, onCancel, onApproved, onConflict }: Props) => {
  const ref = useRef<HTMLDialogElement>(null);
  const [nameAr, setNameAr] = useState("");
  const [addressAr, setAddressAr] = useState("");
  const [operator, setOperator] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Opened once mounted; unmounting removes it from the top layer, so there is
  // nothing to close (closing would fire onClose into a parent that moved on).
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const approve = async () => {
    setBusy(true);
    setError(null);
    const res = await reviewSubmission(s.id, "approve", undefined, { nameAr, addressAr, operator });
    setBusy(false);
    if (res.ok) return onApproved(res.result.chargerId);
    if (res.status === 409) return onConflict();
    setError(res.message);
  };

  const where = coordinates(s);
  return (
    <dialog
      ref={ref}
      className="com-dialog"
      aria-labelledby="com-approve-title"
      onCancel={(e) => {
        if (busy) e.preventDefault();
      }}
      onClose={onCancel}
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          void approve();
        }}
      >
        <h2 id="com-approve-title">Approve this charger?</h2>
        <section aria-label="Charger">
          <h3>
            <bdi>{s.name || "Unnamed charger"}</bdi>
          </h3>
          <p className="com-meta">
            {where ? (
              <a href={mapsUrl(s.lat as number, s.lng as number)} target="_blank" rel="noopener noreferrer" aria-label={`${where} on Google Maps, opens in a new tab`}>
                {where}
              </a>
            ) : (
              "No usable pin"
            )}
            {" · "}
            {s.address ? <bdi>{s.address}</bdi> : "no address given"}
          </p>
          {s.connectors.length ? (
            <ul className="com-conns" aria-label="Connectors">
              {s.connectors.map((c, i) => (
                <li key={i}>{connectorLine(c)}</li>
              ))}
            </ul>
          ) : (
            <p className="com-meta">
              {s.connectorsRaw ? (
                <>
                  Connectors couldn't be read: <bdi>{s.connectorsRaw}</bdi>
                </>
              ) : (
                "No connectors given."
              )}
            </p>
          )}
        </section>
        <section aria-label="Nearby check">
          <h3>Already on the map?</h3>
          <NearbyCheck nearby={nearby} />
        </section>
        <section aria-label="Charger details">
          <h3>Charger details (optional)</h3>
          <div className="com-form">
            <label className="com-field">
              Arabic name
              <input className="com-input" dir="rtl" lang="ar" maxLength={200} value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
            </label>
            <label className="com-field">
              Arabic address
              <input className="com-input" dir="rtl" lang="ar" maxLength={200} value={addressAr} onChange={(e) => setAddressAr(e.target.value)} />
            </label>
            <label className="com-field">
              Operator
              <input className="com-input" dir="auto" maxLength={200} value={operator} onChange={(e) => setOperator(e.target.value)} />
            </label>
          </div>
          <p className="com-meta">Left blank, they stay empty. The charger editor opens next, to finish the charger.</p>
        </section>
        {error && (
          <p className="com-error" role="alert">
            {error}
          </p>
        )}
        <div className="com-dialog-end">
          <button type="button" className="com-btn" onClick={() => ref.current?.close()} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="com-btn com-btn-primary" disabled={busy}>
            {busy ? "Approving…" : "Approve"}
          </button>
        </div>
      </form>
    </dialog>
  );
};
