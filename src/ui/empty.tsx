import type { ReactNode } from "react";
import "./ui.css";

type Props = {
  /** Plain sentence: "Nothing waiting", "not tracked", "No car events yet. They arrive with the next native build." */
  children: ReactNode;
  /** small: 13px note (default). body: 15px, for a card whose whole content is the empty state. */
  size?: "small" | "body";
};

/** An honest empty or "not tracked" state, in Secondary Ink. Never a drawn 0. */
export const Empty = ({ children, size = "small" }: Props) => (
  <p className={size === "body" ? "ui-empty ui-empty-body" : "ui-empty"}>{children}</p>
);
