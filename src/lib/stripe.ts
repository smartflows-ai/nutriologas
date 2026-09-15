// src/lib/stripe.ts
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("[Stripe] STRIPE_SECRET_KEY is not set. Billing features will be disabled.");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder", {
  apiVersion: "2026-03-25.dahlia" as any,
  typescript: true,
});

export type PlanKey = "STARTER" | "PRO";
export type BillingInterval = "monthly" | "annual";

// Plan → Stripe Price ID mapping
export const PLAN_PRICES = {
  // Spanish / default (no _DLLS)
  es: {
    STARTER: {
      monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? "",
      annual:  process.env.STRIPE_PRICE_STARTER_ANNUAL ?? "",
    },
    PRO: {
      monthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? "",
      annual:  process.env.STRIPE_PRICE_PRO_ANNUAL ?? "",
    },
  },
  // English (_DLLS)
  en: {
    STARTER: {
      monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY_DLLS ?? "",
      annual:  process.env.STRIPE_PRICE_STARTER_ANNUAL_DLLS ?? "",
    },
    PRO: {
      monthly: process.env.STRIPE_PRICE_PRO_MONTHLY_DLLS ?? "",
      annual:  process.env.STRIPE_PRICE_PRO_ANNUAL_DLLS ?? "",
    },
  },
  // Direct access fallback for backward compatibility
  STARTER: {
    monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? "",
    annual:  process.env.STRIPE_PRICE_STARTER_ANNUAL ?? "",
  },
  PRO: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? "",
    annual:  process.env.STRIPE_PRICE_PRO_ANNUAL ?? "",
  },
} as const;

export function getStripePriceId(
  plan: PlanKey = "STARTER",
  interval: BillingInterval = "monthly",
  lang: string = "es"
): string {
  const isEn = lang?.toLowerCase().startsWith("en");

  if (isEn) {
    if (plan === "PRO") {
      return (
        (interval === "annual"
          ? process.env.STRIPE_PRICE_PRO_ANNUAL_DLLS
          : process.env.STRIPE_PRICE_PRO_MONTHLY_DLLS) ||
        (interval === "annual"
          ? process.env.STRIPE_PRICE_PRO_ANNUAL
          : process.env.STRIPE_PRICE_PRO_MONTHLY) ||
        ""
      );
    }
    return (
      (interval === "annual"
        ? process.env.STRIPE_PRICE_STARTER_ANNUAL_DLLS
        : process.env.STRIPE_PRICE_STARTER_MONTHLY_DLLS) ||
      (interval === "annual"
        ? process.env.STRIPE_PRICE_STARTER_ANNUAL
        : process.env.STRIPE_PRICE_STARTER_MONTHLY) ||
      ""
    );
  }

  // Spanish / Default (no _DLLS)
  if (plan === "PRO") {
    return (
      (interval === "annual"
        ? process.env.STRIPE_PRICE_PRO_ANNUAL
        : process.env.STRIPE_PRICE_PRO_MONTHLY) || ""
    );
  }
  return (
    (interval === "annual"
      ? process.env.STRIPE_PRICE_STARTER_ANNUAL
      : process.env.STRIPE_PRICE_STARTER_MONTHLY) || ""
  );
}
