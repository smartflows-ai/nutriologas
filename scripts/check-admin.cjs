const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.findMany({
      where: { email: "admin@clinica-demo.com" },
      select: { id: true, email: true, role: true, tenantId: true, passwordHash: true },
      orderBy: { createdAt: "asc" },
    });

    console.log(JSON.stringify(users, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
