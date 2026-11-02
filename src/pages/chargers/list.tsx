import { memo, type KeyboardEvent } from "react";
import type { Charger } from "../../data/chargers";
import { accessLabel, SORT_LABELS, sourceLabel, type SortKey } from "../../data/charger-catalog";
import type { Sort } from "../../lib/table-sort";
import { ChgIcon, ConnectorMarks, StatusMark } from "./bits";
import { fmtAgo, fullTime, nf } from "./format";

// The charger rows. One table at every width: from ~860px of page it is a
// table sorted by its headers; narrower, CSS lays each row out as a list row
// (name and power, place, then status, connectors, access, hours, source and
// when it changed), and the Sort picker in the filters replaces the headers.
// Rows are buttons (Enter or Space opens the drawer). Only one page of rows
// is in the DOM at a time (?page=, ?per=), so a big catalogue stays fast.

type Props = {
  rows: Charger[];
  sort: Sort<SortKey>;
  onSort: (key: SortKey) => void;
  onOpen: (c: Charger) => void;
  now: number;
};

const SortHead = ({ k, sort, onSort, end = false }: { k: SortKey; sort: Sort<SortKey>; onSort: (key: SortKey) => void; end?: boolean }) => {
  const on = sort.key === k;
  return (
    // aria-sort is what a screen reader announces; without it a sortable
    // column is indistinguishable from a static one.
    <th scope="col" aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={end ? "chg-th-end" : undefined}>
      <button
        type="button"
        data-on={on}
        onClick={() => onSort(k)}
        title={on ? `Sorted ${sort.dir === "asc" ? "ascending" : "descending"}: tap to reverse` : `Sort by ${SORT_LABELS[k].toLowerCase()}`}
      >
        {SORT_LABELS[k]}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" data-dir={on ? sort.dir : "none"}>
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      </button>
    </th>
  );
};

const Row = memo(({ c, onOpen, now }: { c: Charger; onOpen: (c: Charger) => void; now: number }) => {
  const open = () => onOpen(c);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  };
  return (
    <tr tabIndex={0} role="button" aria-label={`Open ${c.name}`} onClick={open} onKeyDown={onKey}>
      <td className="chg-c-name">
        <bdi>{c.name}</bdi>
        {c.verified && (
          <span className="chg-verified" title="Verified">
            <ChgIcon name="verify" />
            <span className="ui-sr">Verified</span>
          </span>
        )}
      </td>
      <td className="chg-c-city">
        <bdi>{c.place}</bdi>
        {!c.cityId && (
          <span className="ui-pill chg-pill" title="Not linked to a city yet">
            no city
          </span>
        )}
      </td>
      <td className="chg-c-conn">
        <ConnectorMarks keys={c.connectors} />
      </td>
      <td className="chg-c-power">
        {c.power > 0 ? (
          <>
            <b>{nf.format(c.power)}</b> <span>kW</span>
          </>
        ) : (
          <span title="No power listed">
            —<span className="ui-sr"> No power listed</span>
          </span>
        )}
      </td>
      <td className="chg-c-status">
        <StatusMark status={c.status} />
      </td>
      <td className="chg-c-access">
        <span className="ui-pill chg-pill">{accessLabel(c.access)}</span>
      </td>
      <td className={c.hours === "—" ? "chg-c-hours chg-c-none" : "chg-c-hours"}>
        <ChgIcon name="clock" />
        <span className="ui-sr">Hours </span>
        {c.hours}
      </td>
      <td className="chg-c-source">
        <span className="ui-pill chg-pill">{sourceLabel(c.source)}</span>
      </td>
      <td className="chg-c-updated" title={fullTime(c.updatedAt)}>
        <span className="chg-pre">Updated </span>
        {fmtAgo(c.updatedAt, now)}
      </td>
      <td className="chg-c-chev" aria-hidden="true">
        <ChgIcon name="chevron" />
      </td>
    </tr>
  );
});
Row.displayName = "ChargerRow";

export const ChargerTable = ({ rows, sort, onSort, onOpen, now }: Props) => (
  <table className="chg-table">
    <caption className="ui-sr">Chargers</caption>
    <thead>
      <tr>
        <SortHead k="name" sort={sort} onSort={onSort} />
        <SortHead k="city" sort={sort} onSort={onSort} />
        <th scope="col">Connectors</th>
        <SortHead k="power" sort={sort} onSort={onSort} end />
        <SortHead k="status" sort={sort} onSort={onSort} />
        <SortHead k="access" sort={sort} onSort={onSort} />
        <SortHead k="hours" sort={sort} onSort={onSort} />
        <SortHead k="source" sort={sort} onSort={onSort} />
        <SortHead k="updated" sort={sort} onSort={onSort} />
        <th scope="col">
          <span className="ui-sr">Open</span>
        </th>
      </tr>
    </thead>
    <tbody>
      {rows.map((c) => (
        <Row key={c.id} c={c} onOpen={onOpen} now={now} />
      ))}
    </tbody>
  </table>
);
