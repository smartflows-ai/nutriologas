// src/app/api/tenants/register/route.ts
import { prisma } from "@/lib/db";
import { stripe, getStripePriceId, PlanKey, BillingInterval } from "@/lib/stripe";
import { trialEndsAtDate } from "@/lib/trial";
import bcrypt from "bcryptjs";
import { apiError, type ApiErrorCode } from "@/lib/api-errors";

export const runtime = "nodejs";

const RESERVED = new Set([
  "www", "api", "admin", "billing", "app", "dashboard", "mail",
  "newaigent", "support", "help", "login", "signout", "webhook",
]);

function slugValid(slug: string): ApiErrorCode | null {
  if (slug.length < 3 || slug.length > 30) return "register_slug_invalid";
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) return "register_slug_invalid";
  if (RESERVED.has(slug)) return "register_subdomain_reserved";
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      email, password, name, slug, businessInfo, whatsappNumber,
      location, logoUrl, plan = "STARTER", billingInterval = "monthly", lang = "es",
      vertical = "ECOMMERCE", isBookingEnabled
    } = body;

    // ── Validation ────────────────────────────────────────────────
    if (!email || !password || !name || !slug)
      return apiError("register_fields_required", 400);

    const cleanSlug = slug.toLowerCase().trim();
    const slugError = slugValid(cleanSlug);
    if (slugError) return apiError(slugError, 400);

    if (password.length < 8)
      return apiError("register_password_short", 400);

    // ── Check slug uniqueness ─────────────────────────────────────
    const existing = await prisma.tenant.findUnique({ where: { slug: cleanSlug } });
    if (existing) return apiError("register_subdomain_taken", 409);

    const passwordHash = await bcrypt.hash(password, 12);
    const trialEndsAt  = trialEndsAtDate();

    const validatedPlan: PlanKey = plan === "PRO" ? "PRO" : "STARTER";
    const validatedInterval: BillingInterval = billingInterval === "annual" ? "annual" : "monthly";
    const priceId = getStripePriceId(validatedPlan, validatedInterval, lang);

    // ── Create Stripe customer ────────────────────────────────────
    let stripeCustomerId = `local_${Date.now()}`;
    let stripeSubscriptionId: string | undefined;

    const stripeEnabled = !!process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes("REPLACE_ME");

    if (stripeEnabled) {
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: { slug: cleanSlug, plan: validatedPlan, billingInterval: validatedInterval, lang, vertical },
      });
      stripeCustomerId = customer.id;

      // Create trial subscription (no card required)
      const sub = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        trial_period_days: 14,
        trial_settings: { end_behavior: { missing_payment_method: "pause" } },
        items: priceId ? [{ price: priceId }] : [{ price: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? "" }],
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.payment_intent"],
      });
      stripeSubscriptionId = sub.id;
    }

    // ── Create all DB records in a transaction ────────────────────
    const shouldEnableBooking = isBookingEnabled !== undefined 
      ? Boolean(isBookingEnabled) 
      : ["HEALTH", "VETERINARY", "PET_CARE", "TOURISM", "TRAVEL", "SERVICES"].includes(vertical);

    const tenant = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name,
          slug: cleanSlug,
          businessInfo: businessInfo ?? "",
          whatsappNumber: whatsappNumber ?? null,
          logoUrl: logoUrl ?? null,
          vertical: (vertical as any) || "ECOMMERCE",
          isBookingEnabled: shouldEnableBooking,
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
          stripePriceId:       priceId || null,
          plan:                validatedPlan,
          status:              "TRIALING",
          trialEndsAt,
        },
      });

      return tenant;
    });

    return Response.json({ success: true, slug: tenant.slug, tenantId: tenant.id });
  } catch (e: any) {
    console.error("[register]", e);
    return apiError("internal_error", 500);
  }
}
