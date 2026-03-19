// src/app/admin/calendario/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import CalendarView from "@/components/crm/CalendarView";
import ConnectCalendarButton from "@/components/admin/ConnectCalendarButton";

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
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendario</h1>
          <p className="text-gray-500 text-sm mt-0.5">Citas y agenda del negocio</p>
        </div>
        {!isConnected && <ConnectCalendarButton />}
      </div>

      {!isConnected ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-20 text-center shadow-sm">
          {/* Calendar icon */}
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-primary/20">
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none">
              <rect x="3" y="4" width="18" height="17" rx="3" fill="#16a34a" opacity="0.15" />
              <rect x="3" y="4" width="18" height="17" rx="3" stroke="#16a34a" strokeWidth="1.5" />
              <path d="M3 9h18" stroke="#16a34a" strokeWidth="1.5" />
              <path d="M8 2v4M16 2v4" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="8" cy="14" r="1.2" fill="#16a34a" />
              <circle cx="12" cy="14" r="1.2" fill="#16a34a" />
              <circle cx="16" cy="14" r="1.2" fill="#16a34a" />
            </svg>
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Conecta tu Google Calendar
          </h2>
          <p className="text-gray-500 text-sm max-w-sm mb-8 leading-relaxed">
            Visualiza tus citas, mide la asistencia y detecta patrones de cancelación directamente desde tu agenda de Google.
          </p>

          <ConnectCalendarButton label="Conectar Google Calendar" />

          <p className="mt-4 text-xs text-gray-400">
            Solo lectura • Sin modificaciones a tu agenda
          </p>
        </div>
      ) : (
        <CalendarView />
      )}
    </div>
  );
}
