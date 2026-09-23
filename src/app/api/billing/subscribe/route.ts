// src/app/api/billing/subscribe/route.ts
// Confirms and activates a subscription using an attached payment method (Amazon-style checkout)
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { PlanId } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const tenantId = (session.user as any).tenantId as string;
    const body = await req.json();
    const { paymentMethodId, plan = "STARTER", interval = "monthly" } = body as {
      paymentMethodId?: string;
      plan?: string;
      interval?: "monthly" | "annual";
    };

    if (!paymentMethodId) {
      return NextResponse.json({ error: "Se requiere un método de pago" }, { status: 400 });
    }

    const sub = await prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub?.stripeCustomerId) {
      return NextResponse.json({ error: "Cliente de facturación no encontrado" }, { status: 404 });
    }

    const customerId = sub.stripeCustomerId;

    // 1. Attach payment method to customer and set as default
    try {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    } catch (e: any) {
      // If already attached, ignore error
      if (!e?.message?.includes("already been attached")) {
        console.warn("[subscribe] payment method attach warning:", e?.message);
      }
    }

    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // 2. Resolve Price ID
    const planUpper = (plan.toUpperCase() === "PRO" ? "PRO" : "STARTER") as PlanId;
    let priceId = "";

    if (planUpper === "PRO") {
      priceId = interval === "annual"
        ? (process.env.STRIPE_PRICE_PRO_ANNUAL_DLLS || process.env.STRIPE_PRICE_PRO_ANNUAL || "")
        : (process.env.STRIPE_PRICE_PRO_MONTHLY_DLLS || process.env.STRIPE_PRICE_PRO_MONTHLY || "");
    } else {
      priceId = interval === "annual"
        ? (process.env.STRIPE_PRICE_STARTER_ANNUAL_DLLS || process.env.STRIPE_PRICE_STARTER_ANNUAL || "")
        : (process.env.STRIPE_PRICE_STARTER_MONTHLY_DLLS || process.env.STRIPE_PRICE_STARTER_MONTHLY || "");
    }

    if (!priceId) {
      return NextResponse.json({ error: "Precio de Stripe no configurado para este plan" }, { status: 500 });
    }

    // 3. Create or update Stripe subscription
    let stripeSub: any = null;

    if (sub.stripeSubscriptionId) {
      try {
        const existingStripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
        if (existingStripeSub && ["active", "trialing", "past_due"].includes(existingStripeSub.status)) {
          stripeSub = await stripe.subscriptions.update(sub.stripeSubscriptionId, {
            items: [{ id: existingStripeSub.items.data[0].id, price: priceId }],
            default_payment_method: paymentMethodId,
            proration_behavior: "create_prorations",
          });
        }
      } catch (err: any) {
        console.warn("[subscribe] could not update existing sub, creating new:", err?.message);
      }
    }

    if (!stripeSub) {
      stripeSub = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        default_payment_method: paymentMethodId,
        expand: ["latest_invoice.payment_intent"],
      });
    }

    // 4. Update Prisma Database
    const periodStart = stripeSub.current_period_start ? new Date(stripeSub.current_period_start * 1000) : new Date();
    const periodEnd = stripeSub.current_period_end ? new Date(stripeSub.current_period_end * 1000) : new Date(Date.now() + 30 * 86400 * 1000);

    const updatedDbSub = await prisma.subscription.update({
      where: { tenantId },
      data: {
        plan: planUpper,
        status: "ACTIVE",
        stripeSubscriptionId: stripeSub.id,
        stripePriceId: priceId,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      },
    });

    return NextResponse.json({
      success: true,
      subscription: updatedDbSub,
      redirectUrl: "/admin/dashboard?subscribed=true",
    });
  } catch (error: any) {
    console.error("[subscribe] error:", error);
    return NextResponse.json(
      { error: error?.message || "Error al procesar la suscripción" },
      { status: 500 }
    );
  }
}
