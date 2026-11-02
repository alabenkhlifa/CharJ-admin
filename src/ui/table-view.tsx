import type { ComponentProps } from "react";
import { DataTable } from "./data-table";
import "./ui.css";

/** "Show table" disclosure in Screens Blue: the same data as the chart above it. */
export const TableView = (props: ComponentProps<typeof DataTable>) => (
  <details className="ui-details">
    <summary>Show table</summary>
    <DataTable {...props} />
  </details>
);
