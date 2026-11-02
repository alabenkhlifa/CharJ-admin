import { Fragment, type CSSProperties, type ReactNode } from "react";
import type { Category } from "../../ui/category";
import { When } from "./bits";

// One item of a Community list, as an inbox row (Apple Mail, Linear's inbox):
// a tile at the start that says what kind of item it is and whether it still
// waits, the title with its time at the end, one status line, the driver's
// own words, and a last line with who / where at the start and the row's
// buttons at the end. Every tab's list uses it, so the rows read alike.

type Props = {
  /** The tile's glyph: a ComIcon or a Thumb. */
  glyph: ReactNode;
  /**
   * The category colour (its base at 14% behind its text tone) while the item
   * waits for the admin or informs; null once it is done (resolved, hidden,
   * reviewed): Fill and Secondary Ink, like a zero.
   */
  tone: Category | null;
  title: ReactNode;
  /** ISO time, shown as "3h ago" at the end of the title line. */
  when?: string;
  /** One line under the title: what happened, as words and pills. */
  status?: ReactNode;
  /** The driver's words, photos, a quoted review. */
  children?: ReactNode;
  /** Who and where, at the start of the last line. */
  meta?: ReactNode;
  /** The row's buttons, at the end of the last line (they wrap under a long meta). */
  actions?: ReactNode;
  /** What opens under the row: a form, an error line. */
  after?: ReactNode;
};

export const Row = ({ glyph, tone, title, when, status, children, meta, actions, after }: Props) => (
  <li className="com-item">
    <span
      className={tone ? "com-tile" : "com-tile com-tile-done"}
      style={tone ? ({ "--tile": `var(--c-${tone})`, "--tile-ink": `var(--c-${tone}-text)` } as CSSProperties) : undefined}
      aria-hidden="true"
    >
      {glyph}
    </span>
    <div className="com-body">
      <div className="com-top">
        <h3 className="com-title">{title}</h3>
        {when && <When iso={when} />}
      </div>
      {status && <div className="com-status">{status}</div>}
      {children}
      {(meta || actions) && (
        <div className="com-foot">
          {meta && <p className="com-meta">{meta}</p>}
          {actions && <div className="com-actions">{actions}</div>}
        </div>
      )}
      {after}
    </div>
  </li>
);

/**
 * Parts with a " · " between them; empty parts are left out. The space before
 * the dot doesn't break, so a wrapped line never starts with "·".
 */
export const Dots = ({ parts }: { parts: ReactNode[] }) => {
  const shown = parts.filter((p) => p !== null && p !== undefined && p !== false && p !== "");
  return (
    <>
      {shown.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && " · "}
          {p}
        </Fragment>
      ))}
    </>
  );
};
