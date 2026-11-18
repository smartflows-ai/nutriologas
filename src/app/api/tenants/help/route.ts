// src/app/api/tenants/help/route.ts
// GET/PATCH: how long an assistant has to take a chat that needs help before the owner is told. Owner only
// ("users.manage"): an assistant never changes who gets told and when.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permission-guard";
import { apiError } from "@/lib/api-errors";
import { isValidEscalationMinutes } from "@/lib/help-routing";

export async function GET() {
  const access = await requirePermission("users.manage");
  if (!access.ok) return access.response;
  const [tenant, assistantCount] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: access.tenantId }, select: { helpEscalationMinutes: true } }),
    // Assistants that can receive a notice: active staff with a WhatsApp number.
    prisma.user.count({ where: { tenantId: access.tenantId, role: "STAFF", isActive: true, whatsappNumber: { not: null } } }),
  ]);
  if (!tenant) return apiError("tenant_not_found", 404);
  return NextResponse.json({ ...tenant, assistantCount });
}

export async function PATCH(req: Request) {
  const access = await requirePermission("users.manage");
  if (!access.ok) return access.response;
  const body = await req.json().catch(() => null);
  if (!isValidEscalationMinutes(body?.helpEscalationMinutes)) return apiError("help_settings_invalid", 400);
  const tenant = await prisma.tenant.update({
    where: { id: access.tenantId },
    data: { helpEscalationMinutes: body.helpEscalationMinutes },
    select: { helpEscalationMinutes: true },
  });
  return NextResponse.json(tenant);
}
