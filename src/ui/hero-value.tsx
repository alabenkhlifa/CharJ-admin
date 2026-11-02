import type { ReactNode } from "react";
import { TickNumber } from "./tick-number";
import "./ui.css";

type Props = {
  /** A number ticks up; a string ("—") is shown as is. */
  value: number | string;
  unit?: ReactNode;
  decimals?: number;
};

/** The one bold tabular number of a card, unit beside it in Secondary Ink. */
export const HeroValue = ({ value, unit, decimals = 0 }: Props) => (
  <div className="ui-val">
    <b>{typeof value === "number" ? <TickNumber value={value} decimals={decimals} /> : value}</b>
    {unit != null && unit !== "" && <span>{unit}</span>}
  </div>
);
