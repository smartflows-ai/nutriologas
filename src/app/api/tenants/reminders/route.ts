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
  reminderMode: true,
  reminderSendTime: true,
  confirmationRequired: true,
  confirmationDeadlineHours: true,
  reminderTemplate: true,
  confirmationTemplate: true,
  cancellationTemplate: true,
  messageLanguage: true,
} as const;

const templateField = z.string().max(600).nullable().optional();

const reminderSettingsSchema = z.object({
  remindersEnabled: z.boolean().optional(),
  reminderMode: z.enum(["DAY_BEFORE", "SAME_DAY"]).optional(),
  reminderSendTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  confirmationRequired: z.boolean().optional(),
  confirmationDeadlineHours: z.number().int().min(1).max(24).optional(),
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

  const updated = await prisma.tenant.update({
    where: { id: session.user.tenantId },
    data,
    select: SELECT,
  });
  return NextResponse.json(updated);
}
