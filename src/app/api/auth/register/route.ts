// src/app/api/auth/register/route.ts
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { createConektaCustomer } from "@/lib/conekta";
import { resolveTenantSlug } from "@/lib/tenant";
import { apiError } from "@/lib/api-errors";

export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json();

  if (!email || !password) return apiError("register_fields_required", 400);

  // Resolve tenant from the host header using the shared helper
  const host = req.headers.get("host") || "";
  const tenantSlug = resolveTenantSlug(host);

  let tenant = await prisma.tenant.findFirst({ 
    where: { OR: [{ slug: tenantSlug }, { customDomain: tenantSlug }] } 
  });
  
  if (!tenant) return apiError("tenant_not_found", 400);

  const existing = await prisma.user.findFirst({ where: { tenantId: tenant.id, email } });
  if (existing) return apiError("register_email_taken", 409);

  const hash = await bcrypt.hash(password, 10);

  // Create Conekta customer eagerly so customerId is ready at first checkout
  let conektaCustomerId: string | undefined;
  try {
    const customer = await createConektaCustomer({ name: name ?? email, email });
    conektaCustomerId = customer.id as string;
  } catch (err) {
    // Non-fatal: customer will be created lazily at checkout if this fails
    console.warn("Conekta createCustomer failed at signup:", err);
  }

  const user = await prisma.user.create({
    data: { tenantId: tenant.id, email, name, passwordHash: hash, role: "CUSTOMER", conektaCustomerId },
  });

  return Response.json({ id: user.id, email: user.email }, { status: 201 });
}
