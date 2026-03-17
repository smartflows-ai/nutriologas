// prisma/seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Crear tenant inicial
  const tenant = await prisma.tenant.upsert({
    where: { slug: "clinica-demo" },
    update: {},
    create: {
      name: "Clínica Nutrición Demo",
      slug: "clinica-demo",
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
    where: { tenantId_email: { tenantId: tenant.id, email: "admin@clinica-demo.com" } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: "admin@clinica-demo.com",
      name: "Admin Demo",
      role: "ADMIN",
      passwordHash: "admin123", // en produccion usar bcrypt
      // passwordHash: "$2b$10$placeholder",
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
      { tenantId: tenant.id, url: "https://placehold.co/1200x500/16a34a/white?text=Bienvenidos", alt: "Banner principal", sortOrder: 0 },
      { tenantId: tenant.id, url: "https://placehold.co/1200x500/15803d/white?text=Planes+Nutricionales", alt: "Planes", sortOrder: 1 },
      { tenantId: tenant.id, url: "https://placehold.co/1200x500/4ade80/white?text=Suplementos", alt: "Suplementos", sortOrder: 2 },
    ],
  });

  console.log("✅ Imágenes del carrusel creadas");
  console.log("\n🎉 Seed completado!");
  console.log(`\n📋 Datos de acceso:\n   Email: admin@clinica-demo.com\n   Tenant slug: clinica-demo`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
