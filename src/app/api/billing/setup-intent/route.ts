// src/app/api/billing/setup-intent/route.ts
// Creates a Stripe SetupIntent for the in-app custom checkout
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const tenantId = (session.user as any).tenantId as string;
    let subscription = await prisma.subscription.findUnique({ where: { tenantId } });

    let stripeCustomerId = subscription?.stripeCustomerId;

    if (!stripeCustomerId) {
      // Find tenant details to populate Stripe customer
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, slug: true },
      });
      const customer = await stripe.customers.create({
        name: tenant?.name || "Tenant Admin",
        email: session.user.email || undefined,
        metadata: { tenantId, tenantSlug: tenant?.slug || "" },
      });
      stripeCustomerId = customer.id;

      if (!subscription) {
        subscription = await prisma.subscription.create({
          data: {
            tenantId,
            stripeCustomerId,
            plan: "STARTER",
            status: "TRIALING",
            trialEndsAt: new Date(Date.now() + 14 * 86400 * 1000),
          },
        });
      } else {
        await prisma.subscription.update({
          where: { tenantId },
          data: { stripeCustomerId },
        });
      }
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      metadata: { tenantId },
    });

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      customerId: stripeCustomerId,
      currentPlan: subscription?.plan || "STARTER",
      status: subscription?.status || "TRIALING",
    });
  } catch (error: any) {
    console.error("[setup-intent] error:", error);
    return NextResponse.json(
      { error: error?.message || "Error al inicializar el método de pago" },
      { status: 500 }
    );
  }
}
