// src/components/ui/StatusBadge.tsx
// A status word with an optional icon. Neutral tones on purpose: a tenant color can be very light or very dark and
// would vanish on one of the themes. The word always shows; color is never the only signal.
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface StatusBadgeProps {
  icon?: LucideIcon;
  children: ReactNode;
}

export default function StatusBadge({ icon: Icon, children }: StatusBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white whitespace-nowrap">
      {Icon && <Icon size={12} aria-hidden="true" />}
      {children}
    </span>
  );
}
