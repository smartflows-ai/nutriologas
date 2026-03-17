// src/app/(public)/layout.tsx
import { prisma } from "@/lib/db";
import Navbar from "@/components/shop/Navbar";
import WhatsAppButton from "@/components/shop/WhatsAppButton";

async function getTenantPublicData() {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: "clinica-demo" } });
    return { whatsapp: tenant?.whatsappNumber ?? "", name: tenant?.name ?? "Clínica" };
  } catch { return { whatsapp: "", name: "Clínica" }; }
}

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const { whatsapp, name } = await getTenantPublicData();
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar storeName={name} />
      <main className="flex-1">{children}</main>
      <footer className="bg-gray-900 text-gray-400 text-sm text-center py-6 mt-16">
        <p>© {new Date().getFullYear()} {name}. Todos los derechos reservados.</p>
      </footer>
      {whatsapp && <WhatsAppButton phone={whatsapp} />}
    </div>
  );
}
