// src/app/(public)/agendar/[slug]/page.tsx
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { getTenantSlug } from "@/lib/tenant";
import BookingFlow from "@/components/shop/BookingFlow";

export default async function AgendarPage({
  params,
}: {
  params: { slug: string };
}) {
  const tenantSlug = getTenantSlug();

  const tenant = await prisma.tenant.findFirst({
    where: { OR: [{ slug: tenantSlug }, { customDomain: tenantSlug }] },
    select: {
      id: true,
      name: true,
      whatsappNumber: true,
      logoUrl: true,
      isBookingEnabled: true,
    },
  });

  if (!tenant) notFound();

  const product = await prisma.product.findUnique({
    where: { tenantId_slug: { tenantId: tenant.id, slug: params.slug } },
  });

  if (!product || !product.isActive || product.deletedAt) notFound();

  return (
    <div className="min-h-[80vh] py-8">
      <BookingFlow
        product={{
          id: product.id,
          name: product.name,
          slug: product.slug,
          price: product.price,
          images: product.images,
          description: product.description,
          durationMinutes: product.durationMinutes,
          category: product.category,
        }}
        tenant={{
          name: tenant.name,
          whatsappNumber: tenant.whatsappNumber,
          logoUrl: tenant.logoUrl,
        }}
      />
    </div>
  );
}
