import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ThemeToggle } from "./theme-toggle";
import "./ui.css";

type Props = {
  title: string;
  subtitle?: ReactNode;
  /** At the end edge, before the theme toggle (e.g. "Add charger"). */
  trailing?: ReactNode;
};

/**
 * The page's large title, with the light/dark toggle at its end edge on every
 * page. Once it scrolls away, a blurred inline bar with the same title pins
 * to the top of the window across the whole main area (the shell's padding,
 * however wide, and the full-width map view too). The bar is decorative: the
 * h1 stays the page heading. It lives in <body>, fixed, so no page container
 * can box it in.
 */
export const LargeTitle = ({ title, subtitle, trailing }: Props) => {
  const heading = useRef<HTMLHeadingElement>(null);
  const [folded, setFolded] = useState(false);

  useEffect(() => {
    const el = heading.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => {
      // Folded only when the title left through the top, not the bottom.
      setFolded(!e.isIntersecting && e.boundingClientRect.top < (e.rootBounds?.top ?? 0));
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      {createPortal(
        <div className="ui-lt-bar" data-on={folded} aria-hidden="true">
          <span>{title}</span>
        </div>,
        document.body,
      )}
      <header className="ui-lt">
        <div>
          <h1 ref={heading}>{title}</h1>
          {subtitle != null && <p>{subtitle}</p>}
        </div>
        <div className="ui-lt-trailing">
          {trailing}
          <ThemeToggle />
        </div>
      </header>
    </>
  );
};
