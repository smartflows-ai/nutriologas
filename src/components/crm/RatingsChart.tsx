"use client";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface Props {
  data: { stars: string; count: number }[];
}

export default function RatingsChart({ data }: Props) {
  if (data.every(d => d.count === 0)) return <p className="text-sm text-gray-400 py-8 text-center">Sin reseñas en este período</p>;

  const colors = ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e"]; // Red to Green scale

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
        <XAxis dataKey="stars" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: "transparent" }} formatter={(v: number) => [v, "Reseñas"]} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={35}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
