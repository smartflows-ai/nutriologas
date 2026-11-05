// src/lib/billing-currency-server.ts
// Server side of the currency rule: reads the business's Stripe subscriptions and WhatsApp number.
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { resolveBillingCurrency, priceEnvNames, type BillingCurrency, type BillingInterval, type BillingPlan } from "@/lib/billing-currency";

export async function billingCurrencyForTenant(tenantId: string): Promise<BillingCurrency> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { whatsappNumber: true, subscription: { select: { stripeCustomerId: true } } },
  });
  let existingSubscriptionCurrency: string | null = null;
  const customerId = tenant?.subscription?.stripeCustomerId;
  if (customerId) {
    const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 1 });
    existingSubscriptionCurrency = subs.data[0]?.currency ?? null;
  }
  return resolveBillingCurrency({ existingSubscriptionCurrency, whatsappNumber: tenant?.whatsappNumber });
}

// Monthly amount of a plan's Stripe price in the given currency (annual prices are divided by 12).
// Returns null when the price is not configured or cannot be read, so the checkout can show a fallback.
export async function priceAmountPerMonth(plan: BillingPlan, interval: BillingInterval, currency: BillingCurrency): Promise<number | null> {
  const id = priceEnvNames(plan, interval, currency).map((name) => process.env[name] || "").find((v) => v) || "";
  if (!id || id.includes("REPLACE_ME")) return null;
  try {
    const price = await stripe.prices.retrieve(id);
    const amount = (price.unit_amount ?? 0) / 100;
    return price.recurring?.interval === "year" ? Math.round(amount / 12) : amount;
  } catch {
    return null;
  }
}
