// src/app/api/tenants/register/route.ts
import { prisma } from "@/lib/db";
import { stripe, getStripePriceId, PlanKey, BillingInterval } from "@/lib/stripe";
import { trialEndsAtDate } from "@/lib/trial";
import bcrypt from "bcryptjs";
import { apiError, type ApiErrorCode } from "@/lib/api-errors";
import { z } from "zod";
import { locationSchema } from "@/lib/location";
import { uploadLogoForTenant } from "@/lib/cloudinary";

export const runtime = "nodejs";

const LOGO_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);
const LOGO_MAX_BYTES = 5 * 1024 * 1024;

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
    // JSON, or multipart with the form in `payload` and the logo file in `logo`.
    let body: any;
    let logoFile: File | null = null;
    if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const form = await req.formData();
      body = JSON.parse(String(form.get("payload") ?? "{}"));
      const file = form.get("logo");
      logoFile = file instanceof File && file.size > 0 ? file : null;
    } else {
      body = await req.json();
    }
    if (logoFile && (!LOGO_TYPES.has(logoFile.type) || logoFile.size > LOGO_MAX_BYTES)) {
      return apiError("upload_invalid_type", 400);
    }
    const {
      email, password, name, slug, businessInfo, whatsappNumber,
      ownerName, hasPhysicalLocation, address, placeId, latitude, longitude,
      plan = "STARTER", billingInterval = "monthly", lang = "es",
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

    // Address is required only when the business has a physical location.
    const hasLocation = Boolean(hasPhysicalLocation);
    let location: z.infer<typeof locationSchema> | null = null;
    if (hasLocation) {
      const parsedLocation = locationSchema.safeParse({ address, placeId, latitude, longitude });
      if (!parsedLocation.success) return apiError("address_required", 400);
      location = parsedLocation.data;
    }
    const cleanOwnerName = typeof ownerName === "string" ? ownerName.trim().slice(0, 80) : "";

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
          ownerName: cleanOwnerName || null,
          hasPhysicalLocation: hasLocation,
          address: location?.address ?? null,
          placeId: location?.placeId ?? null,
          latitude: location?.latitude ?? null,
          longitude: location?.longitude ?? null,
          logoUrl: null,
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
          name:         cleanOwnerName || name,
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

    // The logo goes straight into the tenant's own folder. If the upload fails, sign-up still succeeds without a logo.
    if (logoFile) {
      try {
        const logoUrl = await uploadLogoForTenant(logoFile, tenant.id);
        await prisma.tenant.update({ where: { id: tenant.id }, data: { logoUrl } });
      } catch (err) {
        console.error("[register] logo upload failed:", err);
      }
    }

    return Response.json({ success: true, slug: tenant.slug, tenantId: tenant.id });
  } catch (e: any) {
    console.error("[register]", e);
    return apiError("internal_error", 500);
  }
}
