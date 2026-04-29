// src/app/api/tenants/register/route.ts
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { trialEndsAtDate } from "@/lib/trial";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

const RESERVED = new Set([
  "www", "api", "admin", "billing", "app", "dashboard", "mail",
  "newaigent", "support", "help", "login", "signout", "webhook",
]);

function slugValid(slug: string): string | null {
  if (slug.length < 3 || slug.length > 30) return "Slug must be 3–30 characters";
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) return "Invalid slug format";
  if (RESERVED.has(slug)) return "This subdomain is reserved";
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, name, slug, businessInfo, whatsappNumber, location, logoUrl, plan = "STARTER" } = body;

    // ── Validation ────────────────────────────────────────────────
    if (!email || !password || !name || !slug)
      return Response.json({ error: "email, password, name, and slug are required" }, { status: 400 });

    const cleanSlug = slug.toLowerCase().trim();
    const slugError = slugValid(cleanSlug);
    if (slugError) return Response.json({ error: slugError }, { status: 400 });

    if (password.length < 8)
      return Response.json({ error: "Password must be at least 8 characters" }, { status: 400 });

    // ── Check slug uniqueness ─────────────────────────────────────
    const existing = await prisma.tenant.findUnique({ where: { slug: cleanSlug } });
    if (existing) return Response.json({ error: "This subdomain is already taken" }, { status: 409 });

    const passwordHash = await bcrypt.hash(password, 12);
    const trialEndsAt  = trialEndsAtDate();

    // ── Create Stripe customer ────────────────────────────────────
    let stripeCustomerId = `local_${Date.now()}`;
    let stripeSubscriptionId: string | undefined;

    const stripeEnabled = !!process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes("REPLACE_ME");

    if (stripeEnabled) {
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: { slug: cleanSlug, plan },
      });
      stripeCustomerId = customer.id;

      // Create trial subscription (no card required)
      const sub = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        trial_period_days: 14,
        trial_settings: { end_behavior: { missing_payment_method: "pause" } },
        items: [{ price: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? "" }],
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.payment_intent"],
      });
      stripeSubscriptionId = sub.id;
    }

    // ── Create all DB records in a transaction ────────────────────
    const tenant = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name,
          slug: cleanSlug,
          businessInfo: businessInfo ?? "",
          whatsappNumber: whatsappNumber ?? null,
          logoUrl: logoUrl ?? null,
        },
      });

      await tx.themeConfig.create({
        data: {
          tenantId: tenant.id,
          primaryColor:   "#7C3AED",
          secondaryColor: "#4F46E5",
          accentColor:    "#A78BFA",
        },
      });

      await tx.user.create({
        data: {
          tenantId:     tenant.id,
          email:        email.toLowerCase().trim(),
          name,
          role:         "ADMIN",
          passwordHash,
        },
      });

      await tx.subscription.create({
        data: {
          tenantId:            tenant.id,
          stripeCustomerId,
          stripeSubscriptionId: stripeSubscriptionId ?? null,
          plan:                (["STARTER","PRO","ENTERPRISE"].includes(plan) ? plan : "STARTER") as any,
          status:              "TRIALING",
          trialEndsAt,
        },
      });

      return tenant;
    });

    return Response.json({ success: true, slug: tenant.slug, tenantId: tenant.id });
  } catch (e: any) {
    console.error("[register]", e);
    return Response.json({ error: e?.message ?? "Unexpected error" }, { status: 500 });
  }
}
