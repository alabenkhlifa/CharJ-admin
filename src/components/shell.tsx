import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { SearchPanel } from "./search-panel";
import { Icons } from "../lib/icons";
import { NAV, type RouteKey } from "../lib/routes";
import { useGlobalSearch } from "../lib/use-global-search";
import type { SearchHit } from "../lib/use-global-search";

type SidebarCountsInput = {
  chargers?: number;
  pendingSubmissions?: number;
  ratings?: number;
};

type SidebarProps = {
  active: RouteKey;
  onNav: (k: RouteKey) => void;
  density: "comfortable" | "compact";
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  isMobile?: boolean;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  counts?: SidebarCountsInput;
};

// Resolve which numeric badge value (if any) belongs next to a given nav key.
// Returning `undefined` means "render no badge" — used for nav items we
// don't track (overview/users/vehicles/map/settings) and for `feedback`,
// which would need service-role access we don't have here.
const countFor = (k: RouteKey, counts?: SidebarCountsInput): number | undefined => {
  if (!counts) return undefined;
  switch (k) {
    case "chargers":
      return counts.chargers;
    case "submissions":
      return counts.pendingSubmissions;
    case "reviews":
      return counts.ratings;
    default:
      return undefined;
  }
};

export const Sidebar = ({
  active,
  onNav,
  density,
  collapsed,
  setCollapsed,
  isMobile = false,
  mobileOpen = false,
  onCloseMobile,
  counts,
}: SidebarProps) => {
  // On mobile, the drawer always renders at full 240px width (collapsed mode
  // doesn't make sense in a slide-out panel). Desktop respects the user's
  // collapse toggle.
  const showCollapsed = !isMobile && collapsed;
  const w = isMobile ? 240 : showCollapsed ? 64 : density === "compact" ? 200 : 240;
  const padY = density === "compact" ? 6 : 8;

  const handleNav = (k: RouteKey) => {
    onNav(k);
    if (isMobile) onCloseMobile?.();
  };

  const positionStyle: CSSProperties = isMobile
    ? {
        position: "fixed",
        insetBlock: 0,
        insetInlineStart: 0,
        height: "100vh",
        zIndex: 60,
        transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform .25s cubic-bezier(0.32, 0.72, 0, 1)",
        boxShadow: mobileOpen ? "8px 0 32px rgba(0,0,0,0.4)" : "none",
      }
    : { position: "sticky", top: 0, height: "100vh", transition: "width .2s" };

  return (
    <>
      {isMobile && mobileOpen && (
        <div
          onClick={onCloseMobile}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 59,
            animation: "fadeIn 0.15s",
          }}
        />
      )}
      <aside
        style={{
          width: w,
          flexShrink: 0,
          background: "var(--bg)",
          borderInlineEnd: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          ...positionStyle,
        }}
      >
      <div
        style={{
          padding: showCollapsed ? "16px 0" : "18px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: showCollapsed ? "center" : "space-between",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              display: "grid",
              placeItems: "center",
              background: "linear-gradient(135deg, var(--accent) 0%, #06a085 100%)",
              color: "#0a0a0b",
              fontWeight: 700,
              fontSize: 15,
              boxShadow: "0 0 0 1px var(--accent-border)",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M13 2 4 14h7l-1 8 9-12h-7Z" />
            </svg>
          </div>
          {!showCollapsed && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.02em" }}>Charj</div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text-dim)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  marginTop: -1,
                }}
              >
                Admin
              </div>
            </div>
          )}
        </div>
        {!showCollapsed && (
          <button
            onClick={() => (isMobile ? onCloseMobile?.() : setCollapsed(true))}
            aria-label={isMobile ? "Close menu" : "Collapse sidebar"}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              width: 24,
              height: 24,
              borderRadius: 5,
              display: "grid",
              placeItems: "center",
              color: "var(--text-dim)",
            }}
          >
            {isMobile ? <Icons.X size={12} /> : <Icons.Sidebar size={12} />}
          </button>
        )}
      </div>

      {showCollapsed && (
        <button
          onClick={() => setCollapsed(false)}
          style={{
            margin: "0 auto 8px",
            width: 28,
            height: 28,
            borderRadius: 6,
            background: "transparent",
            border: "1px solid var(--border)",
            color: "var(--text-dim)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <Icons.Sidebar size={13} />
        </button>
      )}

      <nav
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 1,
          padding: showCollapsed ? "0 8px" : "0 10px",
          flex: 1,
        }}
      >
        {NAV.map((n) => {
          const Ic = Icons[n.ic];
          const isActive = active === n.k;
          const c = countFor(n.k, counts);
          const hasCount = typeof c === "number" && c >= 0;
          // `accent` only glows when the relevant count is actually > 0.
          // While loading (count undefined) keep it neutral so we don't
          // pre-glow before we know whether there's anything to act on.
          const glow = Boolean(n.accent) && typeof c === "number" && c > 0;
          return (
            <button
              key={n.k}
              onClick={() => handleNav(n.k)}
              title={showCollapsed ? n.l : ""}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: showCollapsed ? `${padY + 2}px 0` : `${padY}px 10px`,
                justifyContent: showCollapsed ? "center" : "flex-start",
                background: isActive ? "var(--surface-hover)" : "transparent",
                border: "none",
                borderRadius: 6,
                color: isActive ? "var(--text)" : "var(--text-muted)",
                fontSize: 13,
                fontWeight: isActive ? 500 : 400,
                position: "relative",
                cursor: "pointer",
                textAlign: "start",
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = "var(--surface-hover)";
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = "transparent";
              }}
            >
              {isActive && (
                <span
                  style={{
                    position: "absolute",
                    insetInlineStart: showCollapsed ? 0 : -10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 2,
                    height: 16,
                    background: "var(--accent)",
                    borderRadius: 2,
                  }}
                />
              )}
              <Ic size={15} />
              {!showCollapsed && (
                <>
                  <span style={{ flex: 1 }}>{n.l}</span>
                  {hasCount && (
                    <span
                      className="num"
                      style={{
                        fontSize: 10,
                        padding: "1px 6px",
                        borderRadius: 10,
                        background: glow ? "var(--accent-soft)" : "var(--bg-elev-2)",
                        color: glow ? "var(--accent)" : "var(--text-dim)",
                        fontWeight: 500,
                      }}
                    >
                      {c}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>

      {!showCollapsed && (
        <div style={{ padding: 14, borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "linear-gradient(135deg, var(--indigo), var(--accent))",
                display: "grid",
                placeItems: "center",
                color: "#fff",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              AB
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--text)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                Ala BEN KHALIFA
              </div>
              <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Super admin</div>
            </div>
            <Icons.More size={14} style={{ color: "var(--text-dim)" }} />
          </div>
        </div>
      )}
      </aside>
    </>
  );
};

const topIconStyle: CSSProperties = {
  width: 30,
  height: 30,
  display: "grid",
  placeItems: "center",
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 7,
  color: "var(--text-muted)",
};

type TopbarProps = {
  theme: "dark" | "light";
  setTheme: (v: "dark" | "light") => void;
  active: RouteKey;
  isMobile?: boolean;
  onOpenMenu?: () => void;
  onNavigate?: (k: RouteKey) => void;
  onOpenCharger?: (id: string) => void;
};

export const Topbar = ({
  theme,
  setTheme,
  active,
  isMobile = false,
  onOpenMenu,
  onNavigate,
  onOpenCharger,
}: TopbarProps) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const search = useGlobalSearch(query);

  // ⌘K / Ctrl+K opens + focuses the search anywhere in the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Click-outside the search wrapper closes the dropdown.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  // Reset cursor whenever the result set changes shape — otherwise the
  // highlighted index can land on nothing after a query refines.
  useEffect(() => {
    setActiveIndex(0);
  }, [query, search.routes.length, search.chargers.length]);

  const flatHits: SearchHit[] = [...search.routes, ...search.chargers];

  const pick = (hit: SearchHit) => {
    if (hit.kind === "route") {
      onNavigate?.(hit.k);
    } else {
      onOpenCharger?.(hit.id);
    }
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (flatHits.length === 0 ? 0 : (i + 1) % flatHits.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) =>
        flatHits.length === 0 ? 0 : (i - 1 + flatHits.length) % flatHits.length,
      );
    } else if (e.key === "Enter") {
      const hit = flatHits[activeIndex];
      if (hit) {
        e.preventDefault();
        pick(hit);
      }
    }
  };

  return (
    <header
      style={{
        height: "var(--topbar-h)",
        flexShrink: 0,
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        paddingInline: isMobile ? 14 : 28,
        gap: isMobile ? 10 : 20,
        background: "color-mix(in srgb, var(--bg) 85%, transparent)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      {isMobile && (
        <button
          onClick={onOpenMenu}
          aria-label="Open menu"
          style={{
            width: 34,
            height: 34,
            display: "grid",
            placeItems: "center",
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 8,
            color: "var(--text)",
            flexShrink: 0,
          }}
        >
          <Icons.Filter size={16} />
        </button>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          color: "var(--text-dim)",
          minWidth: 0,
        }}
      >
        {!isMobile && <span>Admin</span>}
        {!isMobile && <Icons.ChevronRight size={12} />}
        <span
          style={{
            color: "var(--text)",
            textTransform: "capitalize",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontWeight: isMobile ? 600 : 400,
            fontSize: isMobile ? 15 : 13,
          }}
        >
          {active}
        </span>
      </div>

      <div
        ref={wrapRef}
        className="topbar-search"
        style={{
          flex: 1,
          maxWidth: 520,
          marginInline: "auto",
          position: "relative",
          minWidth: 0,
        }}
      >
        <Icons.Search
          size={15}
          style={{
            position: "absolute",
            insetInlineStart: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-dim)",
            pointerEvents: "none",
          }}
        />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search chargers and pages…"
          aria-label="Search"
          style={{
            width: "100%",
            height: 38,
            background: "var(--bg-elev)",
            border: `1px solid ${open ? "var(--accent-border)" : "var(--border)"}`,
            borderRadius: 8,
            paddingInline: "38px 64px",
            color: "var(--text)",
            fontFamily: "inherit",
            fontSize: 13,
            outline: "none",
          }}
        />
        {query ? (
          <button
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            style={{
              position: "absolute",
              insetInlineEnd: 10,
              top: "50%",
              transform: "translateY(-50%)",
              width: 20,
              height: 20,
              display: "grid",
              placeItems: "center",
              background: "var(--bg-elev-2)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              color: "var(--text-dim)",
              cursor: "pointer",
            }}
          >
            <Icons.X size={11} />
          </button>
        ) : (
          <span
            className="num"
            style={{
              position: "absolute",
              insetInlineEnd: 10,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 10,
              color: "var(--text-dim)",
              padding: "2px 6px",
              background: "var(--bg-elev-2)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              pointerEvents: "none",
            }}
          >
            ⌘K
          </span>
        )}

        {open && (
          <SearchPanel
            state={search}
            activeIndex={activeIndex}
            setActiveIndex={setActiveIndex}
            onPick={pick}
          />
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title="Toggle theme"
          style={{ ...topIconStyle, color: "var(--accent)" }}
        >
          {theme === "dark" ? <Icons.Sun size={14} /> : <Icons.Moon size={14} />}
        </button>
        {!isMobile && (
          <div style={{ width: 1, height: 20, background: "var(--border)", marginInline: 4 }} />
        )}
        <button
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "transparent",
            border: isMobile ? "none" : "1px solid var(--border)",
            borderRadius: 7,
            padding: isMobile ? 0 : "4px 8px 4px 4px",
          }}
        >
          <span
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--indigo), var(--accent))",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            AB
          </span>
          {!isMobile && (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Ala</span>
          )}
          {!isMobile && (
            <span
              style={{
                fontSize: 9,
                padding: "1px 5px",
                borderRadius: 3,
                background: "var(--accent-soft)",
                color: "var(--accent)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                fontWeight: 600,
              }}
            >
              Super
            </span>
          )}
        </button>
      </div>
    </header>
  );
};
