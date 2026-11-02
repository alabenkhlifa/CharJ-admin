import { useCallback, useState } from "react";

/**
 * How many row changes (resolve, hide, …) are still on their way. `track`
 * wraps one POST. A list read started meanwhile could land after the change
 * with the old row, so the list's Refresh waits while `saving`.
 */
export const useSaving = () => {
  const [count, setCount] = useState(0);
  const track = useCallback(async <T>(work: Promise<T>): Promise<T> => {
    setCount((n) => n + 1);
    try {
      return await work;
    } finally {
      setCount((n) => n - 1);
    }
  }, []);
  return { saving: count > 0, track };
};
