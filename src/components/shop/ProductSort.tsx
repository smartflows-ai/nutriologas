"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function ProductSort() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get("sort") || "latest";

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    
    if (value === "latest") {
      params.delete("sort");
    } else {
      params.set("sort", value);
    }

    router.push(`/productos?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
      <span className="hidden sm:inline">Ordenar por:</span>
      <select 
        value={currentSort}
        onChange={handleSortChange}
        className="bg-transparent border-none text-gray-900 dark:text-white font-bold cursor-pointer focus:ring-0 outline-none"
      >
        <option value="latest">Más recientes</option>
        <option value="price_desc">Precio: Mayor a Menor</option>
        <option value="price_asc">Precio: Menor a Mayor</option>
      </select>
    </div>
  );
}
