// src/lib/patients.ts
// Patient history: visits grouped by patientKey (normalized phone digits, see src/lib/patient-key.ts).
import { prisma } from "@/lib/db";

export interface PatientRow {
  patientKey: string;
  name: string | null;
  phone: string | null;
  visits: number;
  notes: number;
  lastVisit: Date | null;
  nextVisit: Date | null;
  // Pet names of this owner, comma separated. Only filled for pet verticals.
  pets: string | null;
}

/**
 * One row per patient of the tenant, newest activity first. `q` matches the name, or the phone digits.
 * Visits that were cancelled do not count as the last visit; only pending or confirmed ones count as the next.
 */
export async function listPatients(tenantId: string, q: string, page: number, pageSize: number, withPets = false) {
  const term = q.trim();
  const digits = term.replace(/\D/g, "");
  const offset = (page - 1) * pageSize;

  const rows = await prisma.$queryRaw<(PatientRow & { total: number })[]>`
    WITH visits AS (
      SELECT a."patientKey", a."customerName", a."customerPhone", a."appointmentDate", a."status"
      FROM "appointments" a
      WHERE a."tenantId" = ${tenantId} AND a."patientKey" IS NOT NULL
    ),
    agg AS (
      SELECT
        v."patientKey",
        (ARRAY_AGG(v."customerName" ORDER BY v."appointmentDate" DESC)
          FILTER (WHERE v."customerName" IS NOT NULL AND v."customerName" <> ''))[1] AS "name",
        (ARRAY_AGG(v."customerPhone" ORDER BY v."appointmentDate" DESC)
          FILTER (WHERE v."customerPhone" IS NOT NULL))[1] AS "phone",
        COUNT(*)::int AS "visits",
        MAX(v."appointmentDate") AS "lastActivity",
        MAX(CASE WHEN v."appointmentDate" <= now() AND v."status" <> 'CANCELLED' THEN v."appointmentDate" END) AS "lastVisit",
        MIN(CASE WHEN v."appointmentDate" > now() AND v."status" IN ('PENDING', 'CONFIRMED') THEN v."appointmentDate" END) AS "nextVisit"
      FROM visits v
      GROUP BY v."patientKey"
    )
    SELECT
      g."patientKey", g."name", g."phone", g."visits", g."lastVisit", g."nextVisit",
      (SELECT COUNT(*)::int FROM "appointment_notes" n WHERE n."tenantId" = ${tenantId} AND n."patientKey" = g."patientKey") AS "notes",
      CASE WHEN ${withPets} THEN (
        SELECT string_agg(p."name", ', ' ORDER BY p."name") FROM "pets" p
        WHERE p."tenantId" = ${tenantId} AND p."patientKey" = g."patientKey"
      ) END AS "pets",
      COUNT(*) OVER()::int AS "total"
    FROM agg g
    WHERE ${term} = ''
      OR g."name" ILIKE ${"%" + term + "%"}
      OR (${digits} <> '' AND g."patientKey" LIKE ${"%" + digits + "%"})
      OR (${withPets} AND EXISTS (
        SELECT 1 FROM "pets" p
        WHERE p."tenantId" = ${tenantId} AND p."patientKey" = g."patientKey" AND p."name" ILIKE ${"%" + term + "%"}
      ))
    ORDER BY g."lastActivity" DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  const total = rows[0]?.total ?? 0;
  const patients: PatientRow[] = rows.map(({ total: _total, ...row }) => row);
  return { patients, total };
}

/** Every visit of one patient (newest first), each with its note, plus notes whose visit was deleted. */
export async function getPatientTimeline(
  tenantId: string,
  patientKey: string,
  options: { withPets?: boolean; petId?: string | null } = {},
) {
  const withPets = options.withPets ?? false;
  // The pet filter applies only to pet verticals; other businesses never see pets.
  const petFilter = withPets && options.petId ? { petId: options.petId } : {};
  const [appointments, notes, pets] = await Promise.all([
    prisma.appointment.findMany({
      where: { tenantId, patientKey, ...petFilter },
      orderBy: { appointmentDate: "desc" },
      select: {
        id: true,
        appointmentDate: true,
        durationMinutes: true,
        status: true,
        notes: true,
        customerName: true,
        customerPhone: true,
        customerEmail: true,
        product: { select: { name: true } },
        petId: true,
        pet: { select: { name: true } },
      },
    }),
    prisma.appointmentNote.findMany({
      where: { tenantId, patientKey },
      orderBy: { createdAt: "desc" },
      select: { id: true, appointmentId: true, body: true, authorName: true, createdAt: true, updatedAt: true },
    }),
    withPets
      ? prisma.pet.findMany({
          where: { tenantId, patientKey },
          orderBy: { name: "asc" },
          select: { id: true, name: true, species: true },
        })
      : Promise.resolve([]),
  ]);

  const noteByVisit = new Map(notes.filter((n) => n.appointmentId).map((n) => [n.appointmentId as string, n]));
  const visits = appointments.map((a) => ({
    id: a.id,
    date: a.appointmentDate,
    durationMinutes: a.durationMinutes,
    status: a.status,
    service: a.product?.name ?? null,
    petId: a.petId,
    petName: a.pet?.name ?? null,
    reason: a.notes,
    note: noteByVisit.get(a.id) ?? null,
  }));
  const orphanNotes = notes.filter((n) => !n.appointmentId);

  const latest = appointments[0];
  const patient = {
    patientKey,
    name: appointments.find((a) => a.customerName)?.customerName ?? null,
    phone: appointments.find((a) => a.customerPhone)?.customerPhone ?? null,
    emails: Array.from(new Set(appointments.map((a) => a.customerEmail).filter((e): e is string => !!e))),
    lastSeenAt: latest?.appointmentDate ?? null,
  };

  return { patient, visits, orphanNotes, pets };
}
