import { useEffect, useState } from "react";

const QUERY = "(max-width: 900px)";

const read = () => {
  if (typeof window === "undefined") return false;
  return window.matchMedia(QUERY).matches;
};

// Tracks whether the viewport is below the sidebar-drawer breakpoint.
// 900px keeps tablets-in-portrait on the drawer treatment, since the
// fixed 240px sidebar swallows too much canvas at that width.
export const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(read);

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return isMobile;
};
