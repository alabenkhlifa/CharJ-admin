import type { ReactNode } from "react";
import "./ui.css";

type Props = {
  head: ReactNode[];
  rows: { key: string; cells: ReactNode[] }[];
  /** Column indexes that hold numbers: end-aligned, tabular. */
  numeric?: number[];
  caption?: string;
};

/** 15px table, 0.5px separators, 13px Secondary Ink headers. Scrolls inside itself if too wide. */
export const DataTable = ({ head, rows, numeric = [], caption }: Props) => {
  const end = (i: number) => (numeric.includes(i) ? "ui-end" : undefined);
  return (
    <div className="ui-table-wrap">
      <table className="ui-table">
        {caption && <caption className="ui-sr">{caption}</caption>}
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className={end(i)}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              {r.cells.map((c, i) => (
                <td key={i} className={end(i)}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
