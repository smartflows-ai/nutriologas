// src/app/(public)/mis-citas/page.tsx
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import CustomerAppointmentsList from "@/components/shop/CustomerAppointmentsList";
import { Calendar } from "lucide-react";

export default async function MisCitasPage() {
  const session = await getAppSession();
  if (!session?.user) redirect("/login?callbackUrl=/mis-citas");

  const tenantId = session.user.tenantId;

  const appointments = await prisma.appointment.findMany({
    where: { userId: session.user.id, tenantId },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          price: true,
          images: true,
          slug: true,
        },
      },
    },
    orderBy: { appointmentDate: "desc" },
  });

  const serialized = appointments.map((a) => ({
    id: a.id,
    appointmentDate: a.appointmentDate.toISOString(),
    durationMinutes: a.durationMinutes,
    status: a.status,
    notes: a.notes,
    product: a.product,
  }));

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
          <Calendar className="text-violet-600" size={28} />
          Mis Citas y Consultas
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Historial y seguimiento de tus citas médicas y consultas agendadas
        </p>
      </div>

      <CustomerAppointmentsList initialAppointments={serialized} />
    </div>
  );
}
