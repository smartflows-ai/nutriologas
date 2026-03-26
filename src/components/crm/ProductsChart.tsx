"use client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  data: { name: string; quantity: number }[];
}

export default function ProductsChart({ data }: Props) {
  if (data.length === 0) return <p className="text-sm text-gray-400 py-8 text-center">Sin ventas en este período</p>;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
        <XAxis type="number" hide />
        <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v: number) => [`${v} unidades`, "Vendidos"]} cursor={{ fill: "rgba(0,0,0,0.05)" }} />
        <Bar dataKey="quantity" fill="var(--color-primary)" radius={[0, 4, 4, 0]} barSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}
