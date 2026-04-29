// src/app/(public)/layout.tsx
import { prisma } from "@/lib/db";
import Navbar from "@/components/shop/Navbar";
import WhatsAppButton from "@/components/shop/WhatsAppButton";
import SessionProviderWrapper from "@/components/shop/SessionProviderWrapper";
import { getTenantSlug } from "@/lib/tenant";

async function getTenantPublicData() {
  try {
    const slug = getTenantSlug();
    const tenant = await prisma.tenant.findFirst({ 
      where: { OR: [{ slug }, { customDomain: slug }] },
      include: { theme: true }
    });
    return { 
      whatsapp: tenant?.whatsappNumber ?? "", 
      name: tenant?.name ?? "Clínica",
      theme: tenant?.theme
    };
  } catch { return { whatsapp: "", name: "Clínica", theme: null }; }
}

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const slug = getTenantSlug();

  // ── Root domain (no subdomain) ─────────────────────────────────────────────
  // Marketing page (localhost:3000 / newaigent.com) handles its own layout.
  // Just wrap in SessionProvider and pass children through.
  if (!slug) {
    return (
      <SessionProviderWrapper>
        {children}
      </SessionProviderWrapper>
    );
  }

  // ── Tenant subdomain ───────────────────────────────────────────────────────
  // Full tenant layout with branding, Navbar, WhatsApp button, and footer.
  const { whatsapp, name, theme } = await getTenantPublicData();
  
  const pColor = (theme as any)?.primaryColor || "#16a34a";
  const sColor = (theme as any)?.secondaryColor || "#15803d"; 
  const fFamily = (theme as any)?.fontFamily || "Inter, sans-serif";
  
  const dynamicStyles = `
    :root {
      --color-primary: ${pColor};
      --color-secondary: ${sColor};
      --font-family-base: ${fFamily};
    }
    body {
      font-family: var(--font-family-base), system-ui, sans-serif !important;
    }
  `;

  return (
    <SessionProviderWrapper>
      <style dangerouslySetInnerHTML={{ __html: dynamicStyles }} />
      <div className="min-h-screen flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-300">
        <Navbar storeName={name} />
        <main className="flex-1">{children}</main>
        <footer className="bg-gray-900 border-t border-gray-800 text-gray-400 text-sm text-center py-6 mt-16 dark:bg-black">
          <p>© {new Date().getFullYear()} {name}. Todos los derechos reservados.</p>
        </footer>
        {whatsapp && <WhatsAppButton phone={whatsapp} />}
      </div>
    </SessionProviderWrapper>
  );
}
