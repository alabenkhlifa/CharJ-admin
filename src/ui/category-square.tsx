import type { ReactNode } from "react";
import { toneFill, type Category } from "./category";
import "./ui.css";

/**
 * 'rings' is the Today card's square: it holds all three rings. 'funnels' is
 * the Usage card that holds the four funnels, by the same rule.
 */
export type SquareColor = Category | "rings" | "funnels";

const GRADIENT: Record<"rings" | "funnels", Category[]> = {
  rings: ["active", "queue"],
  funnels: ["onboarding", "trip", "navigate", "contributions"],
};

type Props = {
  color: SquareColor;
  /** Any 24×24 stroke icon; it is drawn at 14px, stroke 2.4, in glyph ink. */
  icon: ReactNode;
};

/** A category's 22px colour square. It names a category; never an ornament. */
export const CategorySquare = ({ color, icon }: Props) => (
  <span
    className="ui-sq"
    aria-hidden="true"
    style={{
      background:
        color === "rings" || color === "funnels"
          ? `linear-gradient(135deg, ${GRADIENT[color].map(toneFill).join(", ")})`
          : toneFill(color),
    }}
  >
    {icon}
  </span>
);
