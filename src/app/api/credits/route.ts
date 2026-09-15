// src/app/api/credits/route.ts
// Credit status endpoint (GET) and recharge session creator (POST).

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCreditStatus, rechargeCredits } from "@/lib/credits";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";

// GET /api/credits — returns current credit status for the authed tenant admin
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const tenantId = (session.user as any).tenantId as string;

  const sub = await prisma.subscription.findUnique({
    where: { tenantId },
    select: { plan: true },
  });
  const planId = (sub?.plan as string) ?? "STARTER";

  const status = await getCreditStatus(tenantId, planId);

  return NextResponse.json({ creditStatus: status });
}

// POST /api/credits — creates a Stripe Checkout session for a $15 credit top-up.
// After successful payment, Stripe fires checkout.session.completed which calls
// rechargeCredits() via the billing webhook.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const tenantId = (session.user as any).tenantId as string;

  const body = await req.json().catch(() => ({}));
  // amountUsd: credit top-up amount in USD (default $15)
  const amountUsd: number = typeof body.amountUsd === "number" ? body.amountUsd : 15;

  // Find or create a Stripe customer for this tenant
  const sub = await prisma.subscription.findUnique({
    where: { tenantId },
    select: { stripeCustomerId: true },
  });

  if (!sub?.stripeCustomerId) {
    return NextResponse.json({ error: "No se encontró cuenta de facturación" }, { status: 404 });
  }

  const origin = req.headers.get("origin") ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: sub.stripeCustomerId,
    payment_method_types: ["card"],
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: Math.round(amountUsd * 100), // cents
          product_data: {
            name: `Créditos de IA — $${amountUsd} USD`,
            description: `Recarga de ${amountUsd} USD en créditos de IA para tu espacio de trabajo.`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      type: "ai_credit_recharge",
      tenantId,
      amountUsd: amountUsd.toString(),
    },
    success_url: `${origin}/admin/asistente?recharge=success`,
    cancel_url:  `${origin}/admin/asistente?recharge=cancelled`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
