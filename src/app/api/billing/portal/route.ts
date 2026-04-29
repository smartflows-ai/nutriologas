// src/app/api/billing/portal/route.ts
// Returns a Stripe Billing Portal URL for the authenticated tenant admin.
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "ADMIN")
      return Response.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = (session.user as any).tenantId as string;
    const subscription = await prisma.subscription.findUnique({ where: { tenantId } });
    if (!subscription)
      return Response.json({ error: "No subscription found" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const returnUrl = body.returnUrl ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";

    const portalSession = await stripe.billingPortal.sessions.create({
      customer:   subscription.stripeCustomerId,
      return_url: `${returnUrl}/admin`,
    });

    return Response.json({ url: portalSession.url });
  } catch (e: any) {
    console.error("[billing/portal]", e);
    return Response.json({ error: e?.message ?? "Unexpected error" }, { status: 500 });
  }
}
