// src/components/admin/Pagination.tsx
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange?: (page: number) => void;
  baseUrl?: string;
  searchParams?: Record<string, string>;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  baseUrl,
  searchParams = {},
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const renderButtons = () => {
    const buttons = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      const isActive = i === currentPage;
      
      if (baseUrl) {
        const params = new URLSearchParams(searchParams);
        params.set("page", i.toString());
        buttons.push(
          <Link
            key={i}
            href={`${baseUrl}?${params.toString()}`}
            className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary text-white shadow-sm shadow-primary/20"
                : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-primary/50 hover:text-primary"
            }`}
          >
            {i}
          </Link>
        );
      } else {
        buttons.push(
          <button
            key={i}
            onClick={() => onPageChange?.(i)}
            className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary text-white shadow-sm shadow-primary/20"
                : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-primary/50 hover:text-primary"
            }`}
          >
            {i}
          </button>
        );
      }
    }
    return buttons;
  };

  const getPrevHref = () => {
    if (!baseUrl || currentPage <= 1) return "#";
    const params = new URLSearchParams(searchParams);
    params.set("page", (currentPage - 1).toString());
    return `${baseUrl}?${params.toString()}`;
  };

  const getNextHref = () => {
    if (!baseUrl || currentPage >= totalPages) return "#";
    const params = new URLSearchParams(searchParams);
    params.set("page", (currentPage + 1).toString());
    return `${baseUrl}?${params.toString()}`;
  };

  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      {baseUrl ? (
        <Link
          href={getPrevHref()}
          className={`p-2 rounded-lg border border-gray-200 dark:border-gray-800 transition-colors ${
            currentPage <= 1 
              ? "opacity-50 cursor-not-allowed pointer-events-none" 
              : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:border-primary/50 hover:text-primary"
          }`}
        >
          <ChevronLeft size={18} />
        </Link>
      ) : (
        <button
          onClick={() => onPageChange?.(currentPage - 1)}
          disabled={currentPage <= 1}
          className="p-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-primary/50 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
      )}

      <div className="flex items-center gap-1.5">
        {renderButtons()}
      </div>

      {baseUrl ? (
        <Link
          href={getNextHref()}
          className={`p-2 rounded-lg border border-gray-200 dark:border-gray-800 transition-colors ${
            currentPage >= totalPages 
              ? "opacity-50 cursor-not-allowed pointer-events-none" 
              : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:border-primary/50 hover:text-primary"
          }`}
        >
          <ChevronRight size={18} />
        </Link>
      ) : (
        <button
          onClick={() => onPageChange?.(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="p-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-primary/50 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      )}
    </div>
  );
}
