import type { CSSProperties } from "react";
import "./ui.css";

type Props<T extends string | number> = {
  value: T;
  options: { v: T; l: string }[];
  onChange: (v: T) => void;
  /** Group label for assistive tech ("Data", "Platform"). */
  label: string;
};

/** Fill track with a sliding thumb. It only switches data. */
export const Segmented = <T extends string | number>({ value, options, onChange, label }: Props<T>) => {
  const at = Math.max(0, options.findIndex((o) => o.v === value));
  return (
    <div className="ui-seg" role="group" aria-label={label} style={{ "--n": options.length, "--at": at } as CSSProperties}>
      <span className="ui-seg-thumb" aria-hidden="true" />
      {options.map((o) => (
        <button key={String(o.v)} type="button" aria-pressed={o.v === value} onClick={() => onChange(o.v)}>
          {o.l}
        </button>
      ))}
    </div>
  );
};
