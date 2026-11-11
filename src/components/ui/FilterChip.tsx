// src/components/ui/FilterChip.tsx
// A pill that switches a filter on or off (date scope, status tabs). Selected: the tenant's primary color with text
// that stays readable on it (--on-primary, set with the theme). Taller on phones for easy tapping.
import type { ReactNode } from "react";

interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}

export default function FilterChip({ active, onClick, children }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center min-h-11 sm:min-h-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
        active
          ? "bg-primary text-white"
          : "bg-white dark:bg-gray-900 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-100 dark:border-gray-800"
      }`}
    >
      {children}
    </button>
  );
}
