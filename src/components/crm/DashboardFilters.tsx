"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "@/i18n";
import { Calendar, ChevronDown } from "lucide-react";

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
    <div className="inline-flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-xl px-3.5 py-2 shadow-xs hover:border-primary/50 transition-all">
      <Calendar size={15} className="text-primary shrink-0" />
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">
        {t.crm.dashboard.period}
      </span>
      <div className="relative inline-flex items-center">
        <select
          id="range-filter"
          value={currentRange}
          onChange={handleRangeChange}
          className="appearance-none bg-transparent pr-5 text-xs sm:text-sm font-semibold text-gray-900 dark:text-white cursor-pointer focus:outline-none"
        >
          <option value="7d" className="dark:bg-gray-900 dark:text-white">{t.crm.dashboard.last7d}</option>
          <option value="30d" className="dark:bg-gray-900 dark:text-white">{t.crm.dashboard.last30d}</option>
          <option value="thisMonth" className="dark:bg-gray-900 dark:text-white">{t.crm.dashboard.thisMonth}</option>
          <option value="allTime" className="dark:bg-gray-900 dark:text-white">{t.crm.dashboard.allTime}</option>
        </select>
        <ChevronDown size={13} className="text-gray-400 absolute right-0 pointer-events-none" />
      </div>
    </div>
  );
}
