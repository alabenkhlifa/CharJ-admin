import "./ui.css";

const nf = new Intl.NumberFormat("en-US");

type Props = {
  /** 1-based. */
  page: number;
  perPage: number;
  total: number;
  onPage: (page: number) => void;
  /** With `sizes`, a "Rows" picker; left out otherwise. */
  onPerPage?: (perPage: number) => void;
  sizes?: readonly number[];
  /** Disables the buttons while a page loads. */
  busy?: boolean;
  /** What the rows are ("users", "models"), for assistive tech. */
  label: string;
};

/** A list's page footer: "26–50 of 312", rows per page, Previous and Next. */
export const Pager = ({ page, perPage, total, onPage, onPerPage, sizes, busy = false, label }: Props) => {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const at = Math.min(Math.max(1, page), pages);
  const from = total === 0 ? 0 : (at - 1) * perPage + 1;
  const to = Math.min(total, at * perPage);
  return (
    <nav className="ui-pager" aria-label={`${label} pages`}>
      <span className="ui-pager-range">
        {nf.format(from)}–{nf.format(to)} of {nf.format(total)}
      </span>
      {onPerPage && sizes && (
        <label className="ui-pager-size">
          Rows
          <select value={perPage} disabled={busy} onChange={(e) => onPerPage(Number(e.target.value))}>
            {sizes.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}
      <span className="ui-pager-steps">
        <button type="button" disabled={busy || at <= 1} onClick={() => onPage(at - 1)}>
          Previous
        </button>
        <button type="button" disabled={busy || at >= pages} onClick={() => onPage(at + 1)}>
          Next
        </button>
      </span>
    </nav>
  );
};
