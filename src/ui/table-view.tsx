import type { ComponentProps, ReactNode } from "react";
import { DataTable } from "./data-table";
import "./ui.css";

type Props = ComponentProps<typeof DataTable> & {
  /** Beside "Show table" (e.g. a "Download CSV" text action); the table still opens below. */
  action?: ReactNode;
};

/** "Show table" disclosure in Screens Blue: the same data as the chart above it. */
export const TableView = ({ action, ...table }: Props) => {
  const details = (
    <details className="ui-details">
      <summary>Show table</summary>
      <DataTable {...table} />
    </details>
  );
  return action ? (
    <div className="ui-details-row">
      {details}
      <span className="ui-details-action">{action}</span>
    </div>
  ) : (
    details
  );
};
