// src/app/api/apps/tools/[id]/route.ts
// POST: the owner turns a plan tool on or off from the App Store (ADMIN only).
// Only tools marked activatable can be switched, and only when the plan includes them.
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-errors";
import { CAPABILITIES, isAvailable, isPlanIncluded } from "@/lib/capabilities";
import { capabilityContextForTenant } from "@/lib/capability-guard";

const bodySchema = z.object({ enabled: z.boolean() });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getAppSession();
  if (!session?.user || session.user.role !== "ADMIN") return apiError("unauthorized", 401);

  const capability = CAPABILITIES.find((c) => c.id === params.id);
  if (!capability || !capability.activatable) return apiError("validation_failed", 400);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError("reminder_settings_invalid", 400);

  const tenantId = session.user.tenantId;
  const ctx = await capabilityContextForTenant(tenantId);
  if (!ctx) return apiError("tenant_not_found", 404);
  if (!isAvailable(capability, ctx)) return apiError("validation_failed", 400);
  if (parsed.data.enabled && !isPlanIncluded(capability, ctx)) {
    return NextResponse.json({ error: "plan_required", capability: capability.id }, { status: 403 });
  }

  const current = ctx.enabledTools.filter((id) => id !== capability.id);
  const enabledTools = parsed.data.enabled ? [...current, capability.id] : current;
  await prisma.tenant.update({ where: { id: tenantId }, data: { enabledTools } });

  return NextResponse.json({ ok: true, enabledTools });
}
