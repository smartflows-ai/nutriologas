// src/app/api/tenants/reminders/route.ts
// GET/PATCH: appointment reminder and confirmation settings of the tenant (ADMIN and STAFF: "whatsapp.settings").
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permission-guard";
import { apiError } from "@/lib/api-errors";
import { unfilledFields } from "@/lib/reminder-template-rules";
import { parseBusinessHours } from "@/lib/business-hours";
import { reminderQuietConflict } from "@/lib/reminder-quiet-hours";
import { DEFAULT_QUIET_END_MIN, DEFAULT_QUIET_START_MIN } from "@/lib/wa-pacing";
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
  // Ban prevention: consent-gate mode and quiet hours (feat/whatsapp-ban-prevention).
  messagingPolicyMode: true,
  messagingEnforcedAt: true,
  quietHoursStartMin: true,
  quietHoursEndMin: true,
  ownerName: true,
  hasPhysicalLocation: true,
  address: true,
  // Read to check that no reminder lands inside the quiet hours (QA 2026-11-20); edited in /admin/negocio.
  businessHours: true,
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
  // SHADOW only measures; ENFORCE blocks reminders without consent (src/lib/wa-consent.ts).
  messagingPolicyMode: z.enum(["SHADOW", "ENFORCE"]).optional(),
  // Quiet-hours window, minutes from local midnight. start === end disables it. null = the default (21:00/08:00).
  quietHoursStartMin: z.number().int().min(0).max(1439).nullable().optional(),
  quietHoursEndMin: z.number().int().min(0).max(1439).nullable().optional(),
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
  const { ownerName, hasPhysicalLocation, address, businessHours, ...rest } = tenant;
  return NextResponse.json({
    ...rest,
    businessHours: parseBusinessHours(businessHours),
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

  // No reminder may go out inside the quiet hours (QA 2026-11-20): with the weekly hours, the lead and the quiet
  // window that will be stored after this save, every visit time maps to one reminder time. The card runs the same
  // rule (src/lib/reminder-quiet-hours.ts) and disables Save; this is the server's copy of that check. It runs only
  // when this save touches the timing, so the "Mensajes al cliente" card (same route, texts only) is never blocked.
  const touchesTiming =
    data.remindersEnabled !== undefined ||
    data.reminderLeadMinutes !== undefined ||
    data.quietHoursStartMin !== undefined ||
    data.quietHoursEndMin !== undefined;
  if (touchesTiming) {
    const current = await prisma.tenant.findUnique({
      where: { id: access.tenantId },
      select: { remindersEnabled: true, reminderLeadMinutes: true, quietHoursStartMin: true, quietHoursEndMin: true, businessHours: true },
    });
    if (!current) return apiError("tenant_not_found", 404);
    const enabled = data.remindersEnabled ?? current.remindersEnabled;
    const lead = data.reminderLeadMinutes ?? current.reminderLeadMinutes;
    const quietStart = (data.quietHoursStartMin !== undefined ? data.quietHoursStartMin : current.quietHoursStartMin) ?? DEFAULT_QUIET_START_MIN;
    const quietEnd = (data.quietHoursEndMin !== undefined ? data.quietHoursEndMin : current.quietHoursEndMin) ?? DEFAULT_QUIET_END_MIN;
    if (enabled && reminderQuietConflict(parseBusinessHours(current.businessHours), lead, quietStart, quietEnd)) {
      return apiError("reminder_in_quiet_hours", 400);
    }
  }

  // Turning ENFORCE on stamps the cutover: visits created before now are grandfathered (keep today's behavior).
  let enforcedAt: Date | undefined;
  if (data.messagingPolicyMode === "ENFORCE") {
    const current = await prisma.tenant.findUnique({ where: { id: access.tenantId }, select: { messagingPolicyMode: true } });
    if (current && current.messagingPolicyMode !== "ENFORCE") enforcedAt = new Date();
  }

  const updated = await prisma.tenant.update({
    where: { id: access.tenantId },
    data: { ...data, ...(enforcedAt ? { messagingEnforcedAt: enforcedAt } : {}) },
    select: SELECT,
  });
  const { businessHours: savedHours, ...saved } = updated;
  return NextResponse.json({ ...saved, businessHours: parseBusinessHours(savedHours) });
}
