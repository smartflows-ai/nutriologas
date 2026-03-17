// src/app/admin/calendario/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import CalendarView from "@/components/crm/CalendarView";

export default async function CalendarioPage() {
  const session = await getServerSession(authOptions);
  const tenantId = (session!.user as any).tenantId as string;

  const admin = await prisma.user.findFirst({
    where: { tenantId, role: "ADMIN" },
    select: { googleCalendarToken: true },
  });

  const isConnected = !!admin?.googleCalendarToken;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendario</h1>
          <p className="text-gray-500 text-sm">Citas y agenda</p>
        </div>
        {!isConnected && (
          <a href="/api/auth/google-calendar" className="btn-primary flex items-center gap-2 text-sm">
            Conectar Google Calendar
          </a>
        )}
      </div>

      {!isConnected ? (
        <div className="card text-center py-12">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" width="32" height="32"><rect width="18" height="18" x="3" y="4" rx="2" fill="#4285F4" /><path fill="white" d="M3 9h18v2H3z" /><path fill="white" d="M8 2v4M16 2v4" stroke="white" strokeWidth="2" /><text x="6" y="18" fontSize="7" fill="white" fontWeight="bold">CAL</text></svg>
          </div>
          <h2 className="font-semibold text-gray-900 mb-2">Google Calendar no conectado</h2>
          <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">Conecta tu Google Calendar para ver tus citas, estadísticas de asistencia y cancelaciones.</p>
          <a href="/api/auth/google-calendar" className="btn-primary inline-flex items-center gap-2">
            Conectar ahora
          </a>
        </div>
      ) : (
        <CalendarView />
      )}
    </div>
  );
}
