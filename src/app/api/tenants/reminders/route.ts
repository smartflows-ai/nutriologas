// src/app/api/tenants/reminders/route.ts
// GET/PATCH: appointment reminder and confirmation settings of the tenant (ADMIN and STAFF: "whatsapp.settings").
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permission-guard";
import { apiError } from "@/lib/api-errors";
import { unfilledFields } from "@/lib/reminder-template-rules";
import { templateProblem, validateConfirmationTemplate, validateReminderNoConfirmation, validateKnownTags, validateNoDeadlineTag, validateNoLocationTag, validateTemplateLength } from "@/lib/reminder-messages";

const SELECT = {
  remindersEnabled: true,
  reminderLeadMinutes: true,
  confirmationRequired: true,
  confirmationDeadlineMinutes: true,
  reminderTemplate: true,
  confirmationTemplate: true,
  cancellationTemplate: true,
  messageLanguage: true,
  ownerName: true,
  hasPhysicalLocation: true,
  address: true,
} as const;

// Fields a text can use that the business must fill in before the text is saved.
const UNFILLED_CODE = { responsable: "template_needs_owner_name", ubicacion: "template_needs_location" } as const;

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
  const access = await requirePermission("whatsapp.settings");
  if (!access.ok) return access.response;

  const tenant = await prisma.tenant.findUnique({ where: { id: access.tenantId }, select: SELECT });
  if (!tenant) return apiError("tenant_not_found", 404);
  // Texts saved before the save-time checks existed: they are not sent as written (the default goes out instead),
  // so the owner is told which ones to rewrite. Only the kind is returned, never the reason.
  const invalidTemplates = (
    [
      ["reminder", tenant.reminderTemplate],
      ["confirmation", tenant.confirmationTemplate],
      ["cancellation", tenant.cancellationTemplate],
    ] as const
  )
    .filter(([kind, text]) => text && templateProblem(text, kind))
    .map(([kind]) => kind);
  const { ownerName, hasPhysicalLocation, address, ...rest } = tenant;
  return NextResponse.json({
    ...rest,
    invalidTemplates,
    ownerName,
    locationReady: Boolean(hasPhysicalLocation && address?.trim()),
  });
}

export async function PATCH(req: Request) {
  const access = await requirePermission("whatsapp.settings");
  if (!access.ok) return access.response;

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
  for (const text of [data.reminderTemplate, data.confirmationTemplate, data.cancellationTemplate]) {
    const unknown = text ? validateKnownTags(text) : null;
    if (unknown) return apiError(unknown as "template_unknown_tag", 400);
  }
  for (const text of [data.reminderTemplate, data.cancellationTemplate]) {
    const problem = text ? validateNoDeadlineTag(text) : null;
    if (problem) return apiError(problem as "template_deadline_not_allowed", 400);
  }
  const placeInCancellation = data.cancellationTemplate ? validateNoLocationTag(data.cancellationTemplate) : null;
  if (placeInCancellation) return apiError(placeInCancellation as "template_location_not_allowed", 400);
  const repeats = data.reminderTemplate ? validateReminderNoConfirmation(data.reminderTemplate) : null;
  if (repeats) return apiError(repeats as "template_repeats_confirmation", 400);
  if (data.confirmationTemplate) {
    const problem = validateConfirmationTemplate(data.confirmationTemplate);
    if (problem) return apiError(problem as "confirmation_missing_si", 400);
  }
  // A text that uses the owner's name or the location cannot be saved until the business fills that field in.
  const texts = [data.reminderTemplate, data.confirmationTemplate, data.cancellationTemplate].filter((t): t is string => Boolean(t));
  if (texts.length) {
    const business = await prisma.tenant.findUnique({ where: { id: access.tenantId }, select: { ownerName: true, hasPhysicalLocation: true, address: true } });
    if (!business) return apiError("tenant_not_found", 404);
    const fields = { ownerName: business.ownerName, hasLocation: Boolean(business.hasPhysicalLocation && business.address?.trim()) };
    for (const text of texts) {
      const missing = unfilledFields(text, fields)[0];
      if (missing) return apiError(UNFILLED_CODE[missing] as "template_needs_owner_name", 400);
    }
  }

  // The answer window (lead minus deadline) must be wide enough to answer: check it against the stored values too.
  if (data.reminderLeadMinutes !== undefined || data.confirmationDeadlineMinutes !== undefined) {
    const current = await prisma.tenant.findUnique({
      where: { id: access.tenantId },
      select: { reminderLeadMinutes: true, confirmationDeadlineMinutes: true },
    });
    if (!current) return apiError("tenant_not_found", 404);
    const lead = data.reminderLeadMinutes ?? current.reminderLeadMinutes;
    const deadline = data.confirmationDeadlineMinutes ?? current.confirmationDeadlineMinutes;
    if (deadline >= lead) return apiError("reminder_window_invalid", 400);
  }

  const updated = await prisma.tenant.update({
    where: { id: access.tenantId },
    data,
    select: SELECT,
  });
  return NextResponse.json(updated);
}
