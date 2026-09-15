// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { prisma } from "@/lib/db";
import { getTenantSlug } from "@/lib/tenant";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LanguageProvider } from "@/i18n";
import { headers } from "next/headers";
import { Lang } from "@/i18n/types";
import { Toaster } from "sonner";

// El tenant se resuelve en v1 con el slug por defecto.
// En v2 se resolverá desde el subdominio via middleware.
async function getTenantTheme() {
  const tenantSlug = getTenantSlug();

  try {
    const tenant = await prisma.tenant.findFirst({
      where: { OR: [{ slug: tenantSlug }, { customDomain: tenantSlug }] },
      include: { theme: true },
    });
    return {
      name: tenant?.name ?? "NewAigent",
      theme: tenant?.theme ?? {
        primaryColor: "#16a34a",
        secondaryColor: "#15803d",
        accentColor: "#4ade80",
        fontFamily: "Inter, sans-serif",
      },
    };
  } catch {
    return {
      name: "NewAigent",
      theme: {
        primaryColor: "#16a34a",
        secondaryColor: "#15803d",
        accentColor: "#4ade80",
        fontFamily: "Inter, sans-serif",
      },
    };
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const { name } = await getTenantTheme();
  const slug = getTenantSlug();
  const isMarketing = !slug;

  const siteTitle = isMarketing ? "NewAigent" : name;
  const siteDescription = isMarketing
    ? "NewAigent gives your business a personal army of AI agents — automating social media, sales, appointments, and more. Start free today."
    : `Bienvenido a ${name}`;

  return {
    title: siteTitle,
    description: siteDescription,
    keywords: ["AI agents", "business automation", "social media AI", "WhatsApp AI", "multi-tenant SaaS"],
    icons: {
      icon: [
        { url: '/favicon/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
        { url: '/favicon/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      ],
      apple: '/favicon/apple-touch-icon.png',
    },
    manifest: '/favicon/site.webmanifest',
    openGraph: {
      title: siteTitle,
      description: siteDescription,
      type: "website",
      url: isMarketing ? "https://newaigent.com" : undefined,
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { name, theme } = await getTenantTheme();
  
  const headersList = headers();
  const acceptLanguage = headersList.get("accept-language")?.toLowerCase() || "";
  const primaryLang = acceptLanguage.split(",")[0]?.trim() || "";
  const initialLang: Lang = primaryLang.startsWith("es") ? "es" : "en";

  const fFamily = (theme as any)?.fontFamily || "Inter, sans-serif";

  return (
    <html
      lang={initialLang}
      suppressHydrationWarning
      style={{
        "--color-primary": theme.primaryColor,
        "--color-secondary": theme.secondaryColor,
        "--color-accent": theme.accentColor,
        "--font-family-base": fFamily,
      } as React.CSSProperties}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Montserrat:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Roboto:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-300"
        style={{ fontFamily: "var(--font-family-base), system-ui, sans-serif" }}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <LanguageProvider initialLang={initialLang as Lang}>
            {children}
            <Toaster richColors position="top-right" />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
