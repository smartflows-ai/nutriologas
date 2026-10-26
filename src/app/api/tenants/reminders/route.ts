// src/app/api/tenants/reminders/route.ts
// GET/PATCH: appointment reminder and confirmation settings of the tenant (ADMIN only).
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-errors";
import { validateConfirmationTemplate, validateTemplateLength } from "@/lib/reminder-messages";

const SELECT = {
  remindersEnabled: true,
  reminderLeadMinutes: true,
  confirmationRequired: true,
  confirmationDeadlineMinutes: true,
  reminderTemplate: true,
  confirmationTemplate: true,
  cancellationTemplate: true,
  messageLanguage: true,
} as const;

const templateField = z.string().max(600).nullable().optional();

const reminderSettingsSchema = z.object({
  remindersEnabled: z.boolean().optional(),
  // Minutes in steps of 30: the reminder goes out 1 to 72 hours before the visit.
  reminderLeadMinutes: z.number().int().min(60).max(4320).refine((m) => m % 30 === 0).optional(),
  confirmationRequired: z.boolean().optional(),
  // Release 30 minutes to 48 hours before the visit, in steps of 30.
  confirmationDeadlineMinutes: z.number().int().min(30).max(2880).refine((m) => m % 30 === 0).optional(),
  messageLanguage: z.enum(["es", "en"]).optional(),
  reminderTemplate: templateField,
  confirmationTemplate: templateField,
  cancellationTemplate: templateField,
});

function normalizeTemplate(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === "") return null;
  return value.trim();
}

export async function GET() {
  const session = await getAppSession();
  if (!session?.user || session.user.role !== "ADMIN") return apiError("unauthorized", 401);

  const tenant = await prisma.tenant.findUnique({ where: { id: session.user.tenantId }, select: SELECT });
  if (!tenant) return apiError("tenant_not_found", 404);
  return NextResponse.json(tenant);
}

export async function PATCH(req: Request) {
  const session = await getAppSession();
  if (!session?.user || session.user.role !== "ADMIN") return apiError("unauthorized", 401);

  const parsed = reminderSettingsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError("reminder_settings_invalid", 400);

  const data = {
    ...parsed.data,
    reminderTemplate: normalizeTemplate(parsed.data.reminderTemplate),
    confirmationTemplate: normalizeTemplate(parsed.data.confirmationTemplate),
    cancellationTemplate: normalizeTemplate(parsed.data.cancellationTemplate),
  };

  for (const text of [data.reminderTemplate, data.confirmationTemplate, data.cancellationTemplate]) {
    if (text) {
      const tooLong = validateTemplateLength(text);
      if (tooLong) return apiError(tooLong as "template_too_long", 400);
    }
  }
  if (data.confirmationTemplate) {
    const problem = validateConfirmationTemplate(data.confirmationTemplate);
    if (problem) return apiError(problem as "confirmation_missing_si", 400);
  }

  // The answer window (lead minus deadline) must be wide enough to answer: check it against the stored values too.
  if (data.reminderLeadMinutes !== undefined || data.confirmationDeadlineMinutes !== undefined) {
    const current = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { reminderLeadMinutes: true, confirmationDeadlineMinutes: true },
    });
    if (!current) return apiError("tenant_not_found", 404);
    const lead = data.reminderLeadMinutes ?? current.reminderLeadMinutes;
    const deadline = data.confirmationDeadlineMinutes ?? current.confirmationDeadlineMinutes;
    if (deadline >= lead) return apiError("reminder_window_invalid", 400);
  }

  const updated = await prisma.tenant.update({
    where: { id: session.user.tenantId },
    data,
    select: SELECT,
  });
  return NextResponse.json(updated);
}
