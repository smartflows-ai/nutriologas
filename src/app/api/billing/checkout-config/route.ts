// src/app/api/billing/checkout-config/route.ts
// GET: the currency this business pays in, and the monthly price of each plan in that currency (admin only).
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { billingCurrencyForTenant, priceAmountPerMonth } from "@/lib/billing-currency-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const tenantId = (session.user as any).tenantId as string;
  const currency = await billingCurrencyForTenant(tenantId);

  const [starterMonthly, plusMonthly, proMonthly, starterAnnual, proAnnual] = await Promise.all([
    priceAmountPerMonth("STARTER", "monthly", currency),
    priceAmountPerMonth("PLUS", "monthly", currency),
    priceAmountPerMonth("PRO", "monthly", currency),
    priceAmountPerMonth("STARTER", "annual", currency),
    priceAmountPerMonth("PRO", "annual", currency),
  ]);

  return NextResponse.json({
    currency,
    prices: {
      starter: { monthly: starterMonthly, annualPerMonth: starterAnnual },
      plus: { monthly: plusMonthly },
      pro: { monthly: proMonthly, annualPerMonth: proAnnual },
    },
  });
}
