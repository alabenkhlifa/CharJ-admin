import type { ReactNode } from "react";
import "./ui.css";

/** Label pill: tags such as lune / classic / no label, or an "open" window. */
export const Pill = ({ children }: { children: ReactNode }) => <span className="ui-pill">{children}</span>;
