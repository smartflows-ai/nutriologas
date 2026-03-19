// src/app/api/auth/register/route.ts
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json();

  if (!email || !password) return Response.json({ error: "Email y contraseña requeridos" }, { status: 400 });

  // Resolve tenant from the host header (reliable across all Next.js 14 contexts)
  const host = req.headers.get("host") || "";
  let tenantSlug = "clinica-demo";
  if (host.includes(".localhost")) tenantSlug = host.split(".")[0];
  else if (!host.includes("localhost")) tenantSlug = host.split(":")[0];

  const tenant = await prisma.tenant.findFirst({ 
    where: { OR: [{ slug: tenantSlug }, { customDomain: tenantSlug }] } 
  });
  if (!tenant) return Response.json({ error: "Configuración no encontrada" }, { status: 500 });

  const existing = await prisma.user.findFirst({ where: { tenantId: tenant.id, email } });
  if (existing) return Response.json({ error: "Ya existe una cuenta con ese email" }, { status: 409 });

  const hash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { tenantId: tenant.id, email, name, passwordHash: hash, role: "CUSTOMER" },
  });

  return Response.json({ id: user.id, email: user.email }, { status: 201 });
}
