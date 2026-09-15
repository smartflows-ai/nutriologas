// src/app/api/billing/prices/route.ts
// Dynamically fetches actual plan pricing and currencies directly from Stripe
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const priceIds = {
      es: {
        starter: {
          monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY,
          annual: process.env.STRIPE_PRICE_STARTER_ANNUAL,
        },
        pro: {
          monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
          annual: process.env.STRIPE_PRICE_PRO_ANNUAL,
        },
      },
      en: {
        starter: {
          monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY_DLLS,
          annual: process.env.STRIPE_PRICE_STARTER_ANNUAL_DLLS,
        },
        pro: {
          monthly: process.env.STRIPE_PRICE_PRO_MONTHLY_DLLS,
          annual: process.env.STRIPE_PRICE_PRO_ANNUAL_DLLS,
        },
      },
    };

    const getPriceInfo = async (priceId?: string) => {
      if (!priceId || priceId.includes("REPLACE_ME")) return null;
      try {
        const p = await stripe.prices.retrieve(priceId);
        const amount = (p.unit_amount ?? 0) / 100;
        const interval = p.recurring?.interval ?? "month";
        const monthlyEquivalent = interval === "year" ? Math.round(amount / 12) : amount;
        return {
          amount,
          monthlyEquivalent,
          currency: p.currency.toUpperCase(),
        };
      } catch (e) {
        return null;
      }
    };

    const [
      esStarterMonthly,
      esStarterAnnual,
      esProMonthly,
      esProAnnual,
      enStarterMonthly,
      enStarterAnnual,
      enProMonthly,
      enProAnnual,
    ] = await Promise.all([
      getPriceInfo(priceIds.es.starter.monthly),
      getPriceInfo(priceIds.es.starter.annual),
      getPriceInfo(priceIds.es.pro.monthly),
      getPriceInfo(priceIds.es.pro.annual),
      getPriceInfo(priceIds.en.starter.monthly),
      getPriceInfo(priceIds.en.starter.annual),
      getPriceInfo(priceIds.en.pro.monthly),
      getPriceInfo(priceIds.en.pro.annual),
    ]);

    const computePlanPricing = (
      monthlyInfo: { monthlyEquivalent: number; currency: string } | null,
      annualInfo: { monthlyEquivalent: number; currency: string } | null,
      defaultMonthly: number,
      defaultAnnual: number,
      defaultCurrency: string
    ) => {
      const monthlyPrice = monthlyInfo?.monthlyEquivalent ?? defaultMonthly;
      let annualPrice = annualInfo?.monthlyEquivalent ?? defaultAnnual;
      // Safeguard: If annual price is missing, equal to, or higher than monthly price, apply 25% discount
      if (!annualPrice || annualPrice >= monthlyPrice) {
        annualPrice = defaultAnnual < monthlyPrice ? defaultAnnual : Math.round(monthlyPrice * 0.75);
      }
      const currency = monthlyInfo?.currency || annualInfo?.currency || defaultCurrency;
      return { monthlyPrice, annualPrice, currency };
    };

    const result = {
      es: {
        starter: computePlanPricing(esStarterMonthly, esStarterAnnual, 500, 375, "MXN"),
        pro: computePlanPricing(esProMonthly, esProAnnual, 1500, 1000, "MXN"),
        enterprise: {
          monthlyPrice: 3999,
          annualPrice: 2999,
          currency: "MXN",
        },
      },
      en: {
        starter: computePlanPricing(enStarterMonthly, enStarterAnnual, 29, 19, "USD"),
        pro: computePlanPricing(enProMonthly, enProAnnual, 79, 59, "USD"),
        enterprise: {
          monthlyPrice: 199,
          annualPrice: 149,
          currency: "USD",
        },
      },
    };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[billing/prices] Error fetching prices:", error);
    return NextResponse.json({ error: "Failed to fetch prices" }, { status: 500 });
  }
}
