"use client";
import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useSearchParams } from "next/navigation";

// days is an array of "YYYY-MM-DD" chronologically ordered
export default function AppointmentsChart({ days }: { days: string[] }) {
  const [data, setData] = useState<{ date: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const range = searchParams.get("range") || "7d";

  useEffect(() => {
    async function fetchEvents() {
      if (!days || days.length === 0) return;
      try {
        setLoading(true);
        setError(null);
        
        const start = days[0] + "T00:00:00.000Z";
        const end = days[days.length - 1] + "T23:59:59.999Z";
        
        const res = await fetch(`/api/calendar/events?start=${start}&end=${end}`);
        if (!res.ok) {
           const err = await res.json();
           throw new Error(err.error || "Error cargando citas");
        }
        const json = await res.json();
        
        const counts: Record<string, number> = {};
        (json.events || []).forEach((ev: any) => {
          const dateStr = ev.start.split("T")[0];
          counts[dateStr] = (counts[dateStr] || 0) + 1;
        });

        const chartData = days.map(d => ({
          date: new Date(d + "T12:00:00").toLocaleDateString("es-MX", { month: "short", day: "numeric" }),
          count: counts[d] || 0,
        }));
        
        setData(chartData);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchEvents();
  }, [range, days]);

  if (loading) return <p className="text-sm text-gray-400 py-8 text-center animate-pulse">Cargando calendario...</p>;
  if (error) return <p className="text-sm text-gray-400 py-8 text-center">{error}</p>;
  if (data.every(d => d.count === 0)) return <p className="text-sm text-gray-400 py-8 text-center">Sin citas programadas</p>;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
        <Tooltip formatter={(v: number) => [v, "Citas"]} />
        <Area type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} fill="url(#colorCount)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
