import { tone as baseTone, type Category } from "./category";
import { plural } from "../lib/health-format";
import "./ui.css";

const nf = new Intl.NumberFormat("en-US");

export type LadderStep = {
  name: string;
  value: number;
  /** A sub-step: indented name, Idle Grey bar. */
  sub?: boolean;
  /** Small text after the value ("2 went"); wins over `users`. */
  note?: string;
  /** Distinct people behind the value, shown as "N users". */
  users?: number;
};

type Props = {
  steps: LadderStep[];
  tone: Category;
  /** Plural noun for `users` ("users", "phones"). */
  unit?: string;
};

/** Funnel progress rows: step name, bold count, a 6px track in the funnel colour. */
export const Ladder = ({ steps, tone, unit = "users" }: Props) => {
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <ul className="ui-lad">
      {steps.map((s, i) => {
        const small = s.note ?? (s.users != null ? plural(s.users, unit) : null);
        return (
          <li key={`${i}-${s.name}`} className={s.sub ? "ui-lad-sub" : undefined}>
            <div className="ui-lad-top">
              <span className="ui-lad-name">{s.name}</span>
              <span className="ui-lad-v">
                {nf.format(s.value)}
                {small && <small>{small}</small>}
              </span>
            </div>
            <div className="ui-lad-tr" aria-hidden="true">
              <i
                style={{
                  inlineSize: `${(Math.max(0, s.value) / max) * 100}%`,
                  background: baseTone(s.sub ? "idle" : tone),
                  animationDelay: `calc(.1s + ${i} * var(--stagger-funnel))`,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
};
