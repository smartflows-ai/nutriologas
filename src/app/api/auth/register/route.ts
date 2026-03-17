// src/app/api/auth/register/route.ts
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json();

  if (!email || !password) return Response.json({ error: "Email y contraseña requeridos" }, { status: 400 });

  // Get default tenant
  const tenant = await prisma.tenant.findUnique({ where: { slug: "clinica-demo" } });
  if (!tenant) return Response.json({ error: "Configuración no encontrada" }, { status: 500 });

  const existing = await prisma.user.findFirst({ where: { tenantId: tenant.id, email } });
  if (existing) return Response.json({ error: "Ya existe una cuenta con ese email" }, { status: 409 });

  // In production: const hash = await bcrypt.hash(password, 10)
  const hash = `hashed_${password}`;

  const user = await prisma.user.create({
    data: { tenantId: tenant.id, email, name, passwordHash: hash, role: "CUSTOMER" },
  });

  return Response.json({ id: user.id, email: user.email }, { status: 201 });
}
