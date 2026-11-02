import { useEffect, useRef, useState, type ReactNode } from "react";
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
 * to the top of the scroll area. The bar is decorative: the h1 stays the page
 * heading.
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
      <div className="ui-lt-pin">
        <div className="ui-lt-bar" data-on={folded} aria-hidden="true">
          <span>{title}</span>
        </div>
      </div>
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
