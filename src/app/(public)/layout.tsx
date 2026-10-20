// src/app/(public)/layout.tsx
import { prisma } from "@/lib/db";
import Link from "next/link";
import Navbar from "@/components/shop/Navbar";
import WhatsAppButton from "@/components/shop/WhatsAppButton";
import SessionProviderWrapper from "@/components/shop/SessionProviderWrapper";
import { getTenantSlug } from "@/lib/tenant";
import { themeColorVars } from "@/lib/theme-vars";
import { getTranslationServer } from "@/i18n/server";

async function getTenantPublicData() {
  const t = getTranslationServer();
  try {
    const slug = getTenantSlug();
    const tenant = await prisma.tenant.findFirst({ 
      where: { OR: [{ slug }, { customDomain: slug }] },
      include: { theme: true }
    });
    return { 
      whatsapp: tenant?.whatsappNumber ?? "", 
      name: tenant?.name ?? t.storefrontUi.storeFallback,
      logoUrl: tenant?.logoUrl ?? null,
      theme: tenant?.theme,
      vertical: (tenant?.vertical as string) ?? "ECOMMERCE"
    };
  } catch { return { whatsapp: "", name: t.storefrontUi.storeFallback, logoUrl: null, theme: null, vertical: "ECOMMERCE" }; }
}

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const t = getTranslationServer();
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
  const { whatsapp, name, logoUrl, theme, vertical } = await getTenantPublicData();
  
  const pColor = (theme as any)?.primaryColor || "#16a34a";
  const sColor = (theme as any)?.secondaryColor || "#15803d"; 
  const fFamily = (theme as any)?.fontFamily || "Inter, sans-serif";
  
  const dynamicStyles = `
    :root {
      ${Object.entries(themeColorVars({ primaryColor: pColor, secondaryColor: sColor }))
        .map(([key, value]) => `${key}: ${value};`)
        .join("\n      ")}
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
        <Navbar storeName={name} logoUrl={logoUrl} isEcommerce={vertical === "ECOMMERCE"} />
        <main className="flex-1">{children}</main>
        <footer className="bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 text-gray-500 text-sm text-center py-6 mt-16">
          <p>© {new Date().getFullYear()} {name}. {t.footer.rights}</p>
          <div className="flex items-center justify-center gap-4 mt-2 text-xs text-gray-500">
            <Link href="/privacy" className="hover:text-gray-300 transition-colors">
              {t.legal.privacyLong}
            </Link>
            <span>•</span>
            <Link href="/terms" className="hover:text-gray-300 transition-colors">
              {t.legal.termsLong}
            </Link>
          </div>
        </footer>
        {whatsapp && <WhatsAppButton phone={whatsapp} />}
      </div>
    </SessionProviderWrapper>
  );
}
