"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "@/i18n";

export default function DashboardFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const currentRange = searchParams.get("range") || "7d";

  const handleRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", e.target.value);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-3">
      <label htmlFor="range-filter" className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {t.crm.dashboard.period}
      </label>
      <select
        id="range-filter"
        value={currentRange}
        onChange={handleRangeChange}
        className="input py-2 px-3 min-w-[160px] text-sm"
      >
        <option value="7d">{t.crm.dashboard.last7d}</option>
        <option value="30d">{t.crm.dashboard.last30d}</option>
        <option value="thisMonth">{t.crm.dashboard.thisMonth}</option>
        <option value="allTime">{t.crm.dashboard.allTime}</option>
      </select>
    </div>
  );
}
