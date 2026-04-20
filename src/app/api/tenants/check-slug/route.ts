// src/app/api/tenants/check-slug/route.ts
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

const RESERVED = new Set([
  "www", "api", "admin", "billing", "app", "dashboard", "mail",
  "newaigent", "support", "help", "login", "signout", "webhook",
]);

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug")?.toLowerCase().trim() ?? "";

  if (!slug) return Response.json({ available: false, error: "slug required" }, { status: 400 });
  if (slug.length < 3 || slug.length > 30)
    return Response.json({ available: false, error: "Slug must be 3–30 characters" });
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug))
    return Response.json({ available: false, error: "Only lowercase letters, numbers and hyphens allowed" });
  if (RESERVED.has(slug))
    return Response.json({ available: false, error: "This subdomain is reserved" });

  const existing = await prisma.tenant.findUnique({ where: { slug } });
  return Response.json({ available: !existing });
}
