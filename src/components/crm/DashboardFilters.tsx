"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function DashboardFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentRange = searchParams.get("range") || "7d";

  const handleRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", e.target.value);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-3">
      <label htmlFor="range-filter" className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Período:
      </label>
      <select
        id="range-filter"
        value={currentRange}
        onChange={handleRangeChange}
        className="input py-2 px-3 min-w-[160px] text-sm"
      >
        <option value="7d">Últimos 7 días</option>
        <option value="30d">Últimos 30 días</option>
        <option value="thisMonth">Este mes</option>
        <option value="allTime">Todo el tiempo</option>
      </select>
    </div>
  );
}
