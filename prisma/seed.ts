// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Crear tenant inicial
  const tenant = await prisma.tenant.upsert({
    where: { slug: "doctor" },
    update: {},
    create: {
      name: "Clínica Doctor",
      slug: "doctor",
      whatsappNumber: "5211234567890",
      businessInfo:
        "Somos una clínica de nutrición dedicada a mejorar tu salud y bienestar a través de planes personalizados.",
      theme: {
        create: {
          primaryColor: "#16a34a",
          secondaryColor: "#15803d",
          accentColor: "#4ade80",
        },
      },
    },
  });

  console.log(`✅ Tenant creado: ${tenant.name} (slug: ${tenant.slug})`);

  // Crear admin
  const admin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "smartflows.co@gmail.com" } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: "smartflows.co@gmail.com",
      name: "Admin Demo",
      role: "ADMIN",
      passwordHash: await bcrypt.hash("admin123", 10),
    },
  });

  console.log(`✅ Admin creado: ${admin.email}`);

  // Crear productos de ejemplo
  const productos = [
    {
      name: "Consulta Inicial",
      slug: "consulta-inicial",
      description: "Primera consulta de nutrición personalizada de 60 minutos.",
      price: 800,
      stock: 999,
      category: "Servicios",
      images: [],
    },
    {
      name: "Plan Detox 7 días",
      slug: "plan-detox-7-dias",
      description: "Plan nutricional detox de 7 días con seguimiento diario.",
      price: 1200,
      stock: 50,
      category: "Planes",
      images: [],
    },
    {
      name: "Suplemento Omega 3",
      slug: "suplemento-omega-3",
      description: "Omega 3 de alta pureza, 60 cápsulas.",
      price: 450,
      stock: 100,
      category: "Suplementos",
      images: [],
    },
    {
      name: "Plan Pérdida de Peso",
      slug: "plan-perdida-de-peso",
      description: "Plan nutricional mensual para pérdida de peso saludable.",
      price: 2500,
      stock: 30,
      category: "Planes",
      images: [],
    },
  ];

  for (const prod of productos) {
    await prisma.product.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: prod.slug } },
      update: {},
      create: { tenantId: tenant.id, ...prod },
    });
  }

  console.log(`✅ ${productos.length} productos creados`);

  // Carrusel de ejemplo
  await prisma.carouselImage.createMany({
    skipDuplicates: true,
    data: [
      { tenantId: tenant.id, url: "https://res.cloudinary.com/dbbjbwznc/image/upload/v1773868688/create_by_m9t3du.png", alt: "Banner principal", sortOrder: 0 }
    ],
  });

  console.log("✅ Imágenes del carrusel creadas");
  console.log("\n🎉 Seed completado!");
  console.log(`\n📋 Datos de acceso:\n   Email: admin@clinica-demo.com\n   Tenant slug: clinica-demo`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
