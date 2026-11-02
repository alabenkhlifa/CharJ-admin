import { Icons } from "../lib/icons";
import { NAV, type RouteKey } from "../lib/routes";
import { buildHash } from "../lib/use-route";
import "./shell.css";

type TabBarProps = {
  active: RouteKey;
  /** Open items in Community. No badge while undefined or 0. */
  queueTotal?: number;
};

/** Phone navigation (under 768px). Notifications is reached from Settings. */
export const TabBar = ({ active, queueTotal }: TabBarProps) => (
  <nav className="ui-tabs" aria-label="Main">
    {NAV.filter((n) => n.tab).map((n) => {
      const Ic = Icons[n.ic];
      const badge = n.k === "community" && queueTotal ? queueTotal : 0;
      return (
        <a key={n.k} href={buildHash(n.k)} aria-current={active === n.k ? "page" : undefined}>
          <Ic size={24} />
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
);
