import { useEffect, useRef, useState } from "react";
import { SearchPanel } from "../components/search-panel";
import { useAdminSession } from "../lib/admin-session";
import { Icons } from "../lib/icons";
import { NAV, type RouteKey } from "../lib/routes";
import { useGlobalSearch, type SearchHit } from "../lib/use-global-search";
import { buildHash } from "../lib/use-route";
import "./shell.css";

type SidebarProps = {
  active: RouteKey;
  /** Open items in Community. No badge while undefined or 0. */
  queueTotal?: number;
  onNavigate: (k: RouteKey) => void;
  onOpenCharger: (id: string) => void;
};

/**
 * Tablet and desktop navigation (768px and up): nav, search (⌘K), account.
 * The theme lives in every page's large title and in Settings.
 */
export const Sidebar = ({
  active,
  queueTotal,
  onNavigate,
  onOpenCharger,
}: SidebarProps) => {
  const session = useAdminSession();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const search = useGlobalSearch(query);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

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

  // Click-outside the search wrapper closes the results.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const flatHits: SearchHit[] = [...search.routes, ...search.chargers];
  // Typing resets the cursor; clamp it when results shrink under it.
  const cursor = Math.min(activeIndex, Math.max(flatHits.length - 1, 0));

  // Like Settings: a sign-out the server can't take leaves the session, and says why.
  const signOut = async () => {
    if (!session) return;
    setSigningOut(true);
    setSignOutError(null);
    const failed = await session.signOut();
    setSigningOut(false);
    if (failed) setSignOutError(`Couldn't sign out: ${failed}`);
  };

  const pick = (hit: SearchHit) => {
    if (hit.kind === "route") onNavigate(hit.k);
    else onOpenCharger(hit.id);
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
    const n = flatHits.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (n === 0 ? 0 : (i + 1) % n));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (n === 0 ? 0 : (i - 1 + n) % n));
    } else if (e.key === "Enter") {
      const hit = flatHits[cursor];
      if (hit) {
        e.preventDefault();
        pick(hit);
      }
    }
  };

  return (
    <aside className="ui-side">
      <div className="ui-side-brand">Charj</div>

      <div ref={wrapRef} className="ui-side-search">
        <Icons.Search size={16} />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search"
          aria-label="Search chargers and pages"
        />
        {query ? (
          <button
            type="button"
            className="ui-side-clear"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
          >
            <Icons.X size={12} />
          </button>
        ) : (
          <span className="ui-side-key">⌘K</span>
        )}
        {open && (
          <div className="ui-side-pop">
            <SearchPanel
              state={search}
              activeIndex={cursor}
              setActiveIndex={setActiveIndex}
              onPick={pick}
            />
          </div>
        )}
      </div>

      <nav aria-label="Main">
        {NAV.map((n) => {
          const Ic = Icons[n.ic];
          const badge = n.k === "community" && queueTotal ? queueTotal : 0;
          return (
            <a key={n.k} href={buildHash(n.k)} aria-current={active === n.k ? "page" : undefined}>
              <Ic size={22} />
              <span>{n.l}</span>
              {badge > 0 && (
                <span className="ui-nav-badge" aria-label={`${badge} waiting`}>
                  {badge}
                </span>
              )}
            </a>
          );
        })}
      </nav>

      <div className="ui-side-foot">
        <span className="ui-side-mail" title={session?.email}>
          {session?.email ?? "Signed in"}
        </span>
        {session && (
          <button type="button" onClick={() => void signOut()} disabled={signingOut} title="Sign out" aria-label={signingOut ? "Signing out…" : "Sign out"}>
            <Icons.SignOut size={16} />
          </button>
        )}
      </div>
      {signOutError && (
        <p className="ui-error ui-side-error" role="alert">
          {signOutError}
        </p>
      )}
    </aside>
  );
};
