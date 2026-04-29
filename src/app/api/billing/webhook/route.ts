// src/app/api/billing/webhook/route.ts
// Handles Stripe webhook events to keep subscription status in sync.
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { headers } from "next/headers";
import type Stripe from "stripe";

export const runtime = "nodejs";

// Stripe sends raw body — must NOT use bodyParser
export async function POST(req: Request) {
  const sig = headers().get("stripe-signature") ?? "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

  let event: Stripe.Event;
  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error("[webhook] Invalid signature:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        await syncSubscription(sub);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data:  { status: "CANCELED", cancelAtPeriodEnd: false },
        });
        break;
      }
      case "invoice.paid": {
        const inv = event.data.object as any;
        if (inv.subscription) {
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: inv.subscription as string },
            data:  { status: "ACTIVE" },
          });
        }
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as any;
        if (inv.subscription) {
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: inv.subscription as string },
            data:  { status: "PAST_DUE" },
          });
        }
        break;
      }
    }
    return Response.json({ received: true });
  } catch (err: any) {
    console.error("[webhook] Handler error:", err);
    return new Response("Handler error", { status: 500 });
  }
}

async function syncSubscription(sub: Stripe.Subscription) {
  const statusMap: Record<string, string> = {
    trialing:        "TRIALING",
    active:          "ACTIVE",
    past_due:        "PAST_DUE",
    canceled:        "CANCELED",
    unpaid:          "UNPAID",
    paused:          "PAST_DUE",
    incomplete:      "PAST_DUE",
    incomplete_expired: "CANCELED",
  };

  const status = statusMap[sub.status] ?? "PAST_DUE";
  const period = sub.items.data[0]?.current_period_start
    ? { currentPeriodStart: new Date(sub.items.data[0].current_period_start * 1000),
        currentPeriodEnd:   new Date(sub.items.data[0].current_period_end   * 1000) }
    : {};

  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: sub.id },
    data: {
      status:             status as any,
      stripePriceId:      sub.items.data[0]?.price.id ?? null,
      cancelAtPeriodEnd:  sub.cancel_at_period_end,
      trialEndsAt:        sub.trial_end ? new Date(sub.trial_end * 1000) : undefined,
      ...period,
    },
  });
}
