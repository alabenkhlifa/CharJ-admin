import type { CSSProperties, ReactNode } from "react";
import { CategorySquare, type SquareColor } from "./category-square";
import "./ui.css";

type Props = {
  title: ReactNode;
  /** Category token name (src/ui/category.ts), or 'rings' for the Today card. */
  color: SquareColor;
  icon: ReactNode;
  /** Header meta at the end edge ("30 days", "3 waiting"). */
  meta?: ReactNode;
  /** The whole card becomes the link; children must not hold other links or buttons. */
  href?: string;
  children?: ReactNode;
  id?: string;
  /** Order in the entry stagger (60ms each). */
  index?: number;
  /** Span both columns of a two-column grid. */
  wide?: boolean;
};

const Chevron = () => (
  <svg className="ui-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

/** Flat 16px card: colour square, bold title, meta; content below. */
export const HealthCard = ({ title, color, icon, meta, href, children, id, index = 0, wide = false }: Props) => {
  const className = wide ? "ui-card ui-card-wide" : "ui-card";
  const style = { "--i": index } as CSSProperties;
  const head = (
    <div className="ui-ch">
      <CategorySquare color={color} icon={icon} />
      <h2>{title}</h2>
      {(meta != null || href) && (
        <span className="ui-meta">
          {meta}
          {href && <Chevron />}
        </span>
      )}
    </div>
  );
  return href ? (
    <a className={className} href={href} id={id} style={style}>
      {head}
      {children}
    </a>
  ) : (
    <section className={className} id={id} style={style}>
      {head}
      {children}
    </section>
  );
};
