"use client";
// src/components/crm/SalesChart.tsx
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Props { data: { date: string; total: number }[]; }

export default function SalesChart({ data }: Props) {
  // Aggregate by date
  const grouped = data.reduce<Record<string, number>>((acc, item) => {
    acc[item.date] = (acc[item.date] ?? 0) + item.total;
    return acc;
  }, {});

  const chartData = Object.entries(grouped).map(([date, total]) => ({
    date: new Date(date + "T12:00:00").toLocaleDateString("es-MX", { month: "short", day: "numeric" }),
    total: Math.round(total),
  }));

  if (chartData.length === 0) return <p className="text-sm text-gray-400 py-8 text-center">Sin datos de ventas aún</p>;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2} />
            <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
        <Tooltip formatter={(v: number) => [`$${v.toLocaleString("es-MX")}`, "Ventas"]} />
        <Area type="monotone" dataKey="total" stroke="var(--color-primary)" strokeWidth={2} fill="url(#colorTotal)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
