import { toneText, type Category } from "./category";
import "./ui.css";

const nf = new Intl.NumberFormat("en-US");

type Props = {
  n: number;
  tone: Category;
  /** Accessible text when the bubble stands alone. */
  label?: string;
};

/**
 * Count bubble, filled with the category's text tone so the digits (glyph ink:
 * white on light, black on dark) reach 4.5:1. A zero is never coloured: Fill
 * and Secondary Ink.
 */
export const Bubble = ({ n, tone, label }: Props) => (
  <span
    className={n ? "ui-bub" : "ui-bub ui-bub-zero"}
    style={n ? { background: toneText(tone) } : undefined}
    // A span only takes a name with a role; without a label the digits are the text.
    role={label ? "img" : undefined}
    aria-label={label}
  >
    {nf.format(n)}
  </span>
);
