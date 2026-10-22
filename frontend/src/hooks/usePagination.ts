import { useMemo, useState } from "react";

export const DEFAULT_PAGE_SIZE = 20;

interface UsePaginationResult<T> {
  paginatedItems: T[];
  currentPage: number;
  setCurrentPage: (page: number) => void;
  totalPages: number;
  totalItems: number;
}

/**
 * Client-side pagination over an already-fetched, already-filtered array.
 * Resets to page 1 whenever the input array's length changes (e.g. a new
 * search/filter narrows the result set) so the user never lands on a page
 * past the end with controls that look live but show nothing.
 *
 * The reset is adjusted during render by comparing against the previous
 * length held in state (not a ref — refs can't be read/written during
 * render under the React Compiler), per React's documented
 * "adjusting state when a prop changes" pattern: calling setState while
 * rendering bails out and re-renders immediately before anything commits,
 * so there's no extra effect pass and no flash of the stale page.
 */
export function usePagination<T>(
  items: T[],
  pageSize: number = DEFAULT_PAGE_SIZE
): UsePaginationResult<T> {
  const [currentPage, setCurrentPage] = useState(1);
  const [prevTotalItems, setPrevTotalItems] = useState(items.length);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (totalItems !== prevTotalItems) {
    setPrevTotalItems(totalItems);
    if (currentPage !== 1) setCurrentPage(1);
  }

  const safePage = Math.min(currentPage, totalPages);

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  return {
    paginatedItems,
    currentPage: safePage,
    setCurrentPage,
    totalPages,
    totalItems,
  };
}
