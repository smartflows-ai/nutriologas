"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

interface SocialCampaign {
  id: string;
  platforms: string[];
  campaignGoal: string;
  isActive: boolean;
}

interface Props {
  campaigns: SocialCampaign[];
}

const COLORS = ["#3b82f6", "#ec4899", "#8b5cf6", "#10b981", "#f59e0b"];

export default function CampaignMetrics({ campaigns }: Props) {
  if (campaigns.length === 0) return null;

  // Aggregate platforms
  let fb = 0;
  let ig = 0;
  campaigns.forEach(c => {
    if (c.platforms.includes("FACEBOOK")) fb++;
    if (c.platforms.includes("INSTAGRAM")) ig++;
  });
  const platformData = [
    { name: "Facebook", value: fb },
    { name: "Instagram", value: ig }
  ].filter(d => d.value > 0);

  // Aggregate goals
  const goalsMap: Record<string, number> = {};
  campaigns.forEach(c => {
    goalsMap[c.campaignGoal] = (goalsMap[c.campaignGoal] || 0) + 1;
  });
  
  const goalLabels: Record<string, string> = {
    promocion: "Promoción", informativo: "Informativo", urgencia: "Urgencia", testimonio: "Testimonio", educativo: "Educativo",
  };
  
  const goalsData = Object.entries(goalsMap).map(([k, v]) => ({
    name: goalLabels[k] || k,
    value: v
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 pt-2 border-t border-gray-100 dark:border-gray-800">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Plataformas</h3>
        <p className="text-xs text-gray-500 mb-4">Distribución por red social</p>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={platformData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
              {platformData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Objetivos</h3>
        <p className="text-xs text-gray-500 mb-4">Rendimiento por propósito</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={goalsData} layout="vertical" margin={{ left: 10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
            <XAxis type="number" hide />
            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} width={80} />
            <Tooltip 
              cursor={{ fill: 'transparent' }} 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
              {goalsData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
