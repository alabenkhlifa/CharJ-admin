import type { ReactNode } from "react";
import "./ui.css";

type Props = {
  /** Body text: what the row is ("Open feedback"). */
  title: ReactNode;
  /** Footnote line under the title in Secondary Ink; kept to one line. */
  detail?: ReactNode;
  /** At the end edge, usually a count bubble. */
  trailing?: ReactNode;
  /** The whole row becomes the link (with a chevron); it must not hold other controls. */
  href?: string;
  /** Accessible name when the visible text alone is not enough. */
  label?: string;
};

const Chevron = () => (
  <svg className="ui-chev ui-row-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

/** A list row (DESIGN.md "List rows"): title and detail at the start, trailing at the end. */
export const ListRow = ({ title, detail, trailing, href, label }: Props) => {
  const body = (
    <>
      <span className="ui-row-main">
        <span className="ui-row-t">{title}</span>
        {detail != null && detail !== "" && <span className="ui-row-d">{detail}</span>}
      </span>
      {(trailing != null || href) && (
        <span className="ui-row-end">
          {trailing}
          {href && <Chevron />}
        </span>
      )}
    </>
  );
  return (
    <li>
      {href ? (
        <a className="ui-row ui-row-link" href={href} aria-label={label}>
          {body}
        </a>
      ) : (
        <div className="ui-row" aria-label={label} role={label ? "group" : undefined}>
          {body}
        </div>
      )}
    </li>
  );
};

/** Rows separated by 0.5px hairlines. */
export const ListRows = ({ children, label }: { children: ReactNode; label?: string }) => (
  <ul className="ui-rows" aria-label={label}>
    {children}
  </ul>
);
