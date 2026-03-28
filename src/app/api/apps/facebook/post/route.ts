// src/app/api/apps/facebook/post/route.ts
// POST — Triggers the n8n AI agent to generate and publish a promotional Facebook post.
// Falls back to direct Graph API if N8N_FACEBOOK_WEBHOOK_URL is not set.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId as string;

  // ── 1. Load Facebook ConnectedApp ───────────────────────────────
  const fbApp = await prisma.connectedApp.findUnique({
    where: { tenantId_provider: { tenantId, provider: "FACEBOOK" } },
  });

  if (!fbApp) {
    return NextResponse.json({ error: "Facebook no está conectado. Ve a Apps y conecta tu página." }, { status: 400 });
  }

  const meta = fbApp.metadata as { pageId: string; pageName: string } | null;
  if (!meta?.pageId) {
    return NextResponse.json({ error: "No se encontró el ID de la página de Facebook." }, { status: 400 });
  }

  // ── 2. Parse body ────────────────────────────────────────────────
  const body = await req.json();
  const {
    productId,
    campaignGoal = "promocion",
    tone = "cercano",
    extraContext,
    pageId: overridePage,
  } = body as {
    productId?: string;
    campaignGoal?: string;
    tone?: string;
    extraContext?: string;
    pageId?: string;
  };

  const targetPageId = overridePage ?? meta.pageId;

  // ── 3. Load product data (optional) ─────────────────────────────
  let product: { name: string; description: string | null; price: number; images: string[] } | null = null;
  if (productId) {
    product = await prisma.product.findFirst({
      where: { id: productId, tenantId, isActive: true, deletedAt: null },
      select: { name: true, description: true, price: true, images: true },
    });
  }

  // ── 4. Load tenant data ──────────────────────────────────────────
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { whatsappNumber: true, name: true },
  });
  const waPhone = (tenant?.whatsappNumber ?? "").replace(/\D/g, "");

  // ── 5. Try n8n first ─────────────────────────────────────────────
  const n8nWebhookUrl = process.env.N8N_FACEBOOK_WEBHOOK_URL;

  if (n8nWebhookUrl) {
    const payload = {
      tenantId,
      tenantName: tenant?.name ?? "",
      fbAccessToken: fbApp.accessToken,
      fbPageId: targetPageId,
      productName: product?.name,
      productDescription: product?.description,
      productPrice: product?.price,
      imageUrl: product?.images?.[0] ?? null,
      waPhone,
      campaignGoal,
      tone,
      extraContext,
    };

    try {
      const n8nRes = await fetch(n8nWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const n8nData = await n8nRes.json();

      if (!n8nRes.ok) {
        return NextResponse.json({ error: n8nData.error ?? "Error en el agente n8n" }, { status: 500 });
      }

      return NextResponse.json({ ok: true, postId: n8nData.postId, message: n8nData.message ?? "El agente publicó el post" });
    } catch (err) {
      console.error("[Facebook Post] n8n error, falling back to direct API:", err);
      // fall through to direct API
    }
  }

  // ── 6. Fallback: build message + publish directly ─────────────────
  const lines: string[] = [];

  if (product) {
    lines.push(`🌟 ${product.name}`);
    lines.push("");
    if (product.description) { lines.push(product.description); lines.push(""); }
    const formattedPrice = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(product.price);
    lines.push(`💰 Precio: ${formattedPrice}`);
  }

  if (extraContext?.trim()) { lines.push(""); lines.push(extraContext.trim()); }

  if (waPhone) {
    lines.push("");
    lines.push(`👉 Escríbenos por WhatsApp: https://wa.me/${waPhone}`);
  }

  const message = lines.join("\n");
  const imageUrl = product?.images?.[0];

  const graphBase = `https://graph.facebook.com/v19.0/${targetPageId}`;
  const response = await fetch(imageUrl ? `${graphBase}/photos` : `${graphBase}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      imageUrl
        ? { url: imageUrl, caption: message, access_token: fbApp.accessToken }
        : { message, access_token: fbApp.accessToken }
    ),
  });

  const result = await response.json();
  if (result.error) {
    console.error("[Facebook Post Error]", result.error);
    return NextResponse.json({ error: result.error.message ?? "Error al publicar en Facebook" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, postId: result.id ?? result.post_id, message });
}
