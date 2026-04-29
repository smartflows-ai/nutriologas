// src/lib/stripe.ts
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("[Stripe] STRIPE_SECRET_KEY is not set. Billing features will be disabled.");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder", {
  apiVersion: "2026-03-25.dahlia" as any,
  typescript: true,
});

// Plan → Stripe Price ID mapping
export const PLAN_PRICES = {
  STARTER: {
    monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? "",
    annual:  process.env.STRIPE_PRICE_STARTER_ANNUAL ?? "",
  },
  PRO: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? "",
    annual:  process.env.STRIPE_PRICE_PRO_ANNUAL ?? "",
  },
} as const;

export type PlanKey = keyof typeof PLAN_PRICES;
export type BillingInterval = "monthly" | "annual";
