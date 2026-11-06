// src/components/ui/RadioOption.tsx
// One radio choice with a flat, theme-aware look: thin gray ring, thick ring in the tenant's primary color when
// selected, no browser-native dark outline. The whole row is the tap target (44px high on phones).
import type { ReactNode } from "react";

interface RadioOptionProps {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: ReactNode;
}

export default function RadioOption({ name, value, checked, onChange, label }: RadioOptionProps) {
  return (
    <label className="flex items-center gap-3 min-h-11 sm:min-h-0 py-1 cursor-pointer">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 shrink-0 appearance-none rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 checked:border-[5px] checked:border-primary focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 cursor-pointer"
      />
      <span className="text-sm text-gray-900 dark:text-white">{label}</span>
    </label>
  );
}
