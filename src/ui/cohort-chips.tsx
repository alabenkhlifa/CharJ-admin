import type { ReactNode } from "react";
import { countOrPercentParts, type WindowState } from "../lib/health-format";
import { DataTable } from "./data-table";
import { Pill } from "./pill";
import "./ui.css";

export type CohortCell = {
  /** "Within 1 day" */
  label: string;
  /** From windowState(): not tracked, still open, or final. */
  state: WindowState;
  n: number;
  of: number;
};

export type CohortRow = {
  id: string;
  /** "Week of 19 Oct" */
  title: string;
  /** Who: platform, phone, "tracked from 1 Nov". */
  detail?: ReactNode;
  cells: CohortCell[];
};

type Props = {
  rows: CohortRow[];
  titleHeader?: string;
  /** Adds a table column for `detail`. */
  detailHeader?: string;
};

const Cell = ({ cell }: { cell: CohortCell }) => {
  if (cell.state === "not_tracked") return <span className="ui-na">not tracked</span>;
  const { percent, counts } = countOrPercentParts(cell.n, cell.of);
  // Wraps between "60%" and "(12 of 20)" in a narrow chip, never inside either.
  return (
    <span>
      {percent && (
        <>
          <span className="ui-nw">{percent}</span>{" "}
        </>
      )}
      <span className="ui-nw">{percent ? `(${counts})` : counts}</span>
      {cell.state === "open" && <Pill>open</Pill>}
    </span>
  );
};

/**
 * Return windows per install week: chip rows (three across) under 768px, a
 * table from 768px. Counts under 10, "not tracked" for a window that closed
 * before tracking began.
 */
export const CohortChips = ({ rows, titleHeader = "Install week", detailHeader }: Props) => {
  const labels = rows[0]?.cells.map((c) => c.label) ?? [];
  const first = detailHeader ? 2 : 1;
  return (
    <>
      <ul className="ui-coh">
        {rows.map((r) => (
          <li key={r.id}>
            <div className="ui-coh-who">
              <b>{r.title}</b>
              {r.detail != null && <span className="ui-na">{r.detail}</span>}
            </div>
            <div className="ui-chips">
              {r.cells.map((c) => (
                <span key={c.label} className="ui-chip">
                  <small>{c.label}</small>
                  <Cell cell={c} />
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <div className="ui-coh-table">
        <DataTable
          head={[titleHeader, ...(detailHeader ? [detailHeader] : []), ...labels]}
          numeric={labels.map((_, i) => i + first)}
          rows={rows.map((r) => ({
            key: r.id,
            cells: [r.title, ...(detailHeader ? [r.detail ?? ""] : []), ...r.cells.map((c) => <Cell key={c.label} cell={c} />)],
          }))}
        />
      </div>
    </>
  );
};
