// src/lib/billing-currency.ts
// Which currency a business pays in, and which Stripe price variable to use.
// Stripe allows one currency per customer, so an existing subscription decides; otherwise the business's
// WhatsApp country code decides (+52 is Mexico, MXN). Everything else is USD.
// Pure functions only: the database and Stripe lookups live in billing-currency-server.ts.

export type BillingCurrency = "mxn" | "usd";
export type BillingPlan = "STARTER" | "PLUS" | "PRO";
export type BillingInterval = "monthly" | "annual";

export function resolveBillingCurrency(input: {
  existingSubscriptionCurrency?: string | null;
  whatsappNumber?: string | null;
}): BillingCurrency {
  const existing = input.existingSubscriptionCurrency?.toLowerCase();
  if (existing === "mxn" || existing === "usd") return existing;
  if (input.whatsappNumber?.trim().startsWith("+52")) return "mxn";
  return "usd";
}

// Environment variables that can hold the Stripe price, in the order they are tried.
// MXN prices have no "_DLLS" variant; USD prices try the "_DLLS" variant first.
// Plus is monthly only, and MXN is monthly only (the Mexico pricing has no annual plan).
export function priceEnvNames(plan: BillingPlan, interval: BillingInterval, currency: BillingCurrency): string[] {
  const base = plan === "PLUS" ? "PLUS" : plan === "PRO" ? "PRO" : "STARTER";
  const period = interval === "annual" ? "ANNUAL" : "MONTHLY";
  if (currency === "mxn") return [`STRIPE_PRICE_${base}_${period}`];
  return [`STRIPE_PRICE_${base}_${period}_DLLS`, `STRIPE_PRICE_${base}_${period}`];
}

// Whether a plan and billing period exist in a currency at all.
export function isOfferedIn(plan: BillingPlan, interval: BillingInterval, currency: BillingCurrency): boolean {
  if (plan === "PLUS" && interval === "annual") return false;
  if (currency === "mxn" && interval === "annual") return false;
  return true;
}
