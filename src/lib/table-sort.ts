// Sorting vocabulary shared by every table. Kept out of the component file so
// `components/table.tsx` exports components only — Vite's fast refresh bails
// on a module that mixes the two.

export type SortDir = "asc" | "desc";
export type Sort<K extends string> = { key: K; dir: SortDir };

// `numeric: true` so "Station 2" sorts before "Station 10", base sensitivity
// so Arabic and accented French names compare the way a reader expects.
export const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

// Toggles direction when the same column is clicked again, otherwise moves to
// the new column using that column's natural first direction — text reads
// A→Z, numbers and dates read biggest/newest first.
export function nextSort<K extends string>(
  current: Sort<K>,
  key: K,
  descFirst: ReadonlySet<K>,
): Sort<K> {
  if (current.key === key) {
    return { key, dir: current.dir === "asc" ? "desc" : "asc" };
  }
  return { key, dir: descFirst.has(key) ? "desc" : "asc" };
}

export const parseSort = <K extends string>(
  raw: string | null,
  valid: ReadonlySet<string>,
  fallback: Sort<K>,
): Sort<K> => {
  if (!raw) return fallback;
  const [key, dir] = raw.split(":");
  if (!valid.has(key)) return fallback;
  return { key: key as K, dir: dir === "desc" ? "desc" : "asc" };
};

export const serializeSort = <K extends string>(sort: Sort<K>): string =>
  `${sort.key}:${sort.dir}`;
