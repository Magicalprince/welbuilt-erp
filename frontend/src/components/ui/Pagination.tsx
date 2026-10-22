import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
}

const ELLIPSIS = "ellipsis" as const;

function getPageNumbers(currentPage: number, totalPages: number): (number | typeof ELLIPSIS)[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  const result: (number | typeof ELLIPSIS)[] = [];
  let prev: number | null = null;
  for (const page of sorted) {
    if (prev !== null && page - prev > 1) {
      result.push(ELLIPSIS);
    }
    result.push(page);
    prev = page;
  }
  return result;
}

export function Pagination({ currentPage, totalItems, pageSize, onPageChange, className }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalPages <= 1) return null;

  const rangeStart = (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 ${className || ""}`}>
      <p className="text-sm text-muted-foreground">
        Showing {rangeStart}–{rangeEnd} of {totalItems}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {getPageNumbers(currentPage, totalPages).map((page, i) =>
          page === ELLIPSIS ? (
            <span key={`ellipsis-${i}`} className="px-2 text-sm text-muted-foreground">
              …
            </span>
          ) : (
            <Button
              key={page}
              variant={page === currentPage ? "default" : "outline"}
              size="sm"
              className="h-9 min-w-9 px-0"
              onClick={() => onPageChange(page)}
              aria-current={page === currentPage ? "page" : undefined}
            >
              {page}
            </Button>
          )
        )}

        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
