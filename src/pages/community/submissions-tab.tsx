import { useMemo, useState, type ReactNode } from "react";
import { useChargers } from "../../data/chargers";
import { reviewSubmission, useSubmissions } from "../../data/submissions";
import {
  connectorLine,
  mapsUrl,
  nearbyChargers,
  otherPhotosLine,
  splitPhotos,
  SUBMISSIONS_PER_PAGE,
  type Submission,
  type SubmissionFilter,
  type SubmissionsPage,
} from "../../data/submissions-report";
import { SUPABASE_URL } from "../../lib/supabase";
import { buildHash, type RouteParams } from "../../lib/use-route";
import { Empty } from "../../ui/empty";
import { HealthCard } from "../../ui/health-card";
import { Pager } from "../../ui/pager";
import { Segmented } from "../../ui/segmented";
import { ApproveDialog, type NearbyState } from "./approve-dialog";
import { ComIcon, LOADING, Note, RefreshButton, RetryLine, Waiting, When } from "./bits";
import { ago, nf, reviewGoneMessage, shortId, useClampPage, useNow } from "./format";
import type { CommunityView } from "./params";

// Charger submissions: chargers drivers propose from the app (the old
// Submissions page). Approve goes through a confirm step and opens the new
// charger in the editor; reject takes an optional note. Both refresh the
// queue (badge, Needs you).

type Props = {
  view: CommunityView["submissions"];
  onParams: (patch: RouteParams) => void;
  onChanged: () => void;
  onOpenCharger: (id: string, edit: boolean) => void;
};

const STATUS_OPTIONS: { v: SubmissionFilter; l: string }[] = [
  { v: "pending", l: "Pending" },
  { v: "approved", l: "Approved" },
  { v: "rejected", l: "Rejected" },
  { v: "all", l: "All" },
];

type ItemProps = {
  s: Submission;
  nearby: NearbyState;
  onApprove: () => void;
  onRejected: (note: string) => void;
  onConflict: (message: string) => void;
};

const ReviewLine = ({ s }: { s: Submission }) => {
  const now = useNow();
  if (s.status === "pending") return null;
  const head = [s.status === "approved" ? "Approved" : "Rejected", s.reviewedBy && `by ${s.reviewedBy}`, ago(s.reviewedAt, now)]
    .filter(Boolean)
    .join(" · ");
  return (
    <>
      <p className="com-meta">
        {head}
        {s.status === "approved" && s.chargerId && (
          <>
            {" · "}
            <a href={buildHash("chargers", { id: s.chargerId })}>Open the charger</a>
          </>
        )}
      </p>
      {s.reviewNote && (
        <p className="com-meta">
          Note: <bdi>{s.reviewNote}</bdi>
        </p>
      )}
    </>
  );
};

const SubmissionItem = ({ s, nearby, onApprove, onRejected, onConflict }: ItemProps) => {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reject = async () => {
    setBusy(true);
    setError(null);
    const res = await reviewSubmission(s.id, "reject", note);
    setBusy(false);
    if (res.ok) return onRejected(note.trim());
    const gone = reviewGoneMessage(res.status);
    if (gone) return onConflict(gone);
    setError(res.message);
  };
  const where = s.lat !== null && s.lng !== null ? `${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}` : null;
  const dupes = s.status === "pending" && nearby.state === "done" ? nearby.chargers : [];
  // Only the app's own uploads load; any other URL is counted, never fetched or linked.
  const photos = splitPhotos(s.photos, SUPABASE_URL);
  const others = otherPhotosLine(photos.other);
  return (
    <li className="com-item">
      <div className="com-top">
        <h3 className="com-title">
          <bdi>{s.name || "Unnamed charger"}</bdi>
        </h3>
        <When iso={s.createdAt} />
      </div>
      <p className="com-meta">
        {where ? (
          <a href={mapsUrl(s.lat as number, s.lng as number)} target="_blank" rel="noopener noreferrer" aria-label={`${where} on Google Maps, opens in a new tab`}>
            {where}
          </a>
        ) : (
          "No usable pin"
        )}
        {s.address && (
          <>
            {" · "}
            <bdi>{s.address}</bdi>
          </>
        )}
      </p>
      {s.connectors.length > 0 ? (
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
      {s.notes.trim() && (
        <p className="com-text">
          <bdi>{s.notes}</bdi>
        </p>
      )}
      {photos.app.length > 0 && (
        <div className="com-photos">
          {photos.app.map((src, i) => (
            <a
              key={i}
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
              aria-label={`Photo ${i + 1} of ${photos.app.length}, opens in a new tab`}
            >
              <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" />
            </a>
          ))}
        </div>
      )}
      {others && <p className="com-meta">{others}</p>}
      <p className="com-meta">
        Sent by <bdi title={s.submittedBy}>{s.submittedBy ? shortId(s.submittedBy) : "anonymous"}</bdi>
        {s.appVersion && ` · app ${s.appVersion}`}
      </p>
      {dupes.length > 0 && (
        <p className="com-near">
          <b>Possible duplicate:</b> <bdi>{dupes[0].name || "Unnamed charger"}</bdi>, {nf.format(dupes[0].meters)} m away
          {dupes.length > 1 && ` (and ${nf.format(dupes.length - 1)} more within 100 m)`}.
        </p>
      )}
      <ReviewLine s={s} />
      {s.status === "pending" && !rejecting && (
        <div className="com-actions">
          <button type="button" className="ui-btn ui-btn-primary" onClick={onApprove}>
            Approve…
          </button>
          <button type="button" className="ui-btn" onClick={() => setRejecting(true)}>
            Reject…
          </button>
        </div>
      )}
      {s.status === "pending" && rejecting && (
        <form
          className="com-form"
          onSubmit={(e) => {
            e.preventDefault();
            void reject();
          }}
        >
          <label className="com-field">
            Note (optional, kept with the submission)
            <textarea className="com-input" dir="auto" maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="com-actions">
            <button type="submit" className="ui-btn" disabled={busy}>
              {busy ? "Rejecting…" : "Reject"}
            </button>
            <button type="button" className="ui-btn" onClick={() => setRejecting(false)} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {error && (
        <p className="ui-error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
};

/** A reject the server confirmed: the row flips in place, the counts follow. */
const rejected = (data: SubmissionsPage, id: string, note: string): SubmissionsPage => ({
  ...data,
  items: data.items.map((s) =>
    s.id === id ? { ...s, status: "rejected" as const, reviewedAt: new Date().toISOString(), reviewedBy: null, reviewNote: note || null } : s,
  ),
  counts: { ...data.counts, pending: Math.max(0, data.counts.pending - 1), rejected: data.counts.rejected + 1 },
});

export const SubmissionsTab = ({ view, onParams, onChanged, onOpenCharger }: Props) => {
  const { status, page } = view;
  const subs = useSubmissions(status, page);
  const chargers = useChargers();
  const [approving, setApproving] = useState<Submission | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const data = subs.data;
  const past = useClampPage(page, data?.total ?? null, SUBMISSIONS_PER_PAGE, (n) => onParams({ page: n > 1 ? String(n) : null }));

  // The nearby check runs over the chargers the dashboard loads anyway (search_chargers).
  const nearbyOf = useMemo(() => {
    const pins = chargers.data.map((c) => ({ id: c.id, name: c.name, lat: c.lat, lng: c.lng }));
    return (s: Submission): NearbyState => {
      if (s.lat === null || s.lng === null) return { state: "unpinned" };
      if (chargers.error) return { state: "error", message: chargers.error };
      if (chargers.loading) return { state: "loading" };
      return { state: "done", chargers: nearbyChargers(s.lat, s.lng, pins) };
    };
  }, [chargers.data, chargers.error, chargers.loading]);

  // 409 or 404: the list is out of date. Say so, and read it (and the queue) again.
  const conflict = (message: string) => {
    setApproving(null);
    setNotice(message);
    subs.refresh();
    onChanged();
  };

  let body: ReactNode;
  if (subs.error) body = <RetryLine onRetry={subs.refresh}>Couldn't load submissions. {subs.error}</RetryLine>;
  else if (!data || past) body = <Waiting>{LOADING}</Waiting>;
  else if (!data.items.length)
    body = (
      <Empty size="body">
        {status === "pending" ? "Nothing waiting." : status === "all" ? "No submissions yet." : `No ${status} submissions.`} When a driver
        adds a charger from the app, it lands here.
      </Empty>
    );
  else
    body = (
      <>
        <ul className="com-list" aria-label="Submissions">
          {data.items.map((s) => (
            <SubmissionItem
              key={s.id}
              s={s}
              nearby={nearbyOf(s)}
              onApprove={() => {
                setNotice(null);
                setApproving(s);
              }}
              onRejected={(note) => {
                subs.patch((d) => rejected(d, s.id, note));
                setNotice(null);
                onChanged();
              }}
              onConflict={conflict}
            />
          ))}
        </ul>
        {data.total > SUBMISSIONS_PER_PAGE && (
          <Pager
            label="Submissions"
            page={page}
            perPage={SUBMISSIONS_PER_PAGE}
            total={data.total}
            busy={subs.loading}
            onPage={(n) => onParams({ page: n > 1 ? String(n) : null })}
          />
        )}
      </>
    );

  const c = data?.counts;
  return (
    <div className="com-grid">
      <HealthCard
        title="Charger submissions"
        id="com-submissions"
        color="screens"
        icon={<ComIcon name="plus" />}
        meta={c ? `${nf.format(c.pending)} pending` : undefined}
        index={0}
      >
        {c && (
          <p className="com-meta">
            {nf.format(c.pending)} pending · {nf.format(c.approved)} approved · {nf.format(c.rejected)} rejected
          </p>
        )}
        <div className="com-bar">
          <Segmented label="Status" value={status} options={STATUS_OPTIONS} onChange={(v) => onParams({ status: v === "pending" ? null : v, page: null })} />
          <RefreshButton
            busy={subs.loading}
            onRefresh={() => {
              setNotice(null);
              subs.refresh();
              void chargers.refetch();
              onChanged();
            }}
          />
        </div>
        {notice && (
          <p className="com-notice" role="status">
            {notice}
          </p>
        )}
        {body}
        <Note>
          Approving creates the charger as operational, public and unverified, then opens it in the editor to check the rest. A charger
          already within 100 m is flagged first. Rejecting changes nothing on the map.
        </Note>
      </HealthCard>
      {approving && (
        <ApproveDialog
          submission={approving}
          nearby={nearbyOf(approving)}
          onCancel={() => setApproving(null)}
          onConflict={conflict}
          onApproved={(chargerId) => {
            setApproving(null);
            onChanged();
            if (chargerId) onOpenCharger(chargerId, true);
            else {
              setNotice("Approved.");
              subs.refresh();
            }
          }}
        />
      )}
    </div>
  );
};

