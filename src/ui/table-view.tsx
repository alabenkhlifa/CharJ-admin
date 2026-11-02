import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { DataTable } from "./data-table";
import "./ui.css";

type Props = ComponentProps<typeof DataTable> & {
  /** Beside "Show table" (e.g. a "Download CSV" text action); the table still opens below. */
  action?: ReactNode;
};

/**
 * "Show table" disclosure in Screens Blue: the same data as the chart above it.
 * With an action, the summary and the action share one line in flow (a long
 * line wraps, the action never covers it) and the table opens below them at
 * the full width.
 */
export const TableView = ({ action, ...table }: Props) => {
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!action) {
    return (
      <details className="ui-details">
        <summary>Show table</summary>
        <DataTable {...table} />
      </details>
    );
  }
  return (
    <div className="ui-details-row">
      <details className="ui-details" onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary aria-controls={id}>Show table</summary>
      </details>
      <span className="ui-details-action">{action}</span>
      <div id={id} className="ui-details-table" hidden={!open}>
        <DataTable {...table} />
      </div>
    </div>
  );
};
