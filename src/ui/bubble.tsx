import { toneFill, type Category } from "./category";
import "./ui.css";

const nf = new Intl.NumberFormat("en-US");

type Props = {
  n: number;
  tone: Category;
  /** Accessible text when the bubble stands alone. */
  label?: string;
};

/** Count bubble. A zero is never coloured: Fill and Secondary Ink. */
export const Bubble = ({ n, tone, label }: Props) => (
  <span
    className={n ? "ui-bub" : "ui-bub ui-bub-zero"}
    style={n ? { background: toneFill(tone) } : undefined}
    aria-label={label}
  >
    {nf.format(n)}
  </span>
);
